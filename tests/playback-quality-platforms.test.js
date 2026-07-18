const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKugouProvider } = require('../providers/kugou');

const root = path.join(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

[
  'id="quality-provider-control"',
  'id="quality-provider-btn"',
  'PLAYBACK_QUALITY_PROFILES_STORE_KEY',
  'function playbackQualityForProvider(provider)',
  'function setQualitySettingsProvider(',
].forEach(contract => {
  assert(uiSource.includes(contract), `missing platform quality UI contract: ${contract}`);
});

assert.doesNotMatch(uiSource, /api\/kugou\/song\/url[^\n]+quality=128/, 'Kugou playback must not be fixed to 128kbps');
assert.match(uiSource, /fetchBeatPrefetchAudioUrl[\s\S]{0,500}requestedQuality = 'standard'/, 'Beat analysis must not duplicate the selected lossless stream');
assert.match(serverSource, /QQ_QUALITY_CANDIDATE_TEMPLATES[\s\S]*br:\s*320000/);
assert.match(serverSource, /async function probeAudioUrl[\s\S]*bytes=0-63/, 'QQ quality URLs must be verified against the CDN before playback');
assert.match(serverSource, /for \(let index = 0; index < fileCandidates\.length; index\+\+\)/, 'QQ must walk every quality candidate in descending order');
assert.match(uiSource, /var order = \['hires', 'lossless', 'exhigh', 'standard'\]/, 'QQ decoder fallback must not skip lossless');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-quality-'));
const calls = [];
const fakeKugou = {
  song_url: async params => {
    calls.push(String(params.quality));
    if (String(params.quality) === 'flac') return { body: { data: { url: [] } } };
    return {
      body: {
        data: {
          url: ['https://example.invalid/song.mp3'],
          bitrate: 320000,
          format: 'mp3',
        },
      },
    };
  },
};

(async () => {
  const provider = createKugouProvider(path.join(temp, '.kugou-cookie'), fakeKugou);
  const result = await provider.songUrl({ hash: 'ABC', albumId: 1, albumAudioId: 2 }, 'lossless');
  assert.deepStrictEqual(calls, ['flac', '320'], 'Kugou must retry the next native quality after an unavailable FLAC URL');
  assert.strictEqual(result.requestedQuality, 'lossless');
  assert.strictEqual(result.level, 'exhigh');
  assert.strictEqual(result.br, 320000);
  assert.strictEqual(result.format, 'mp3');
  assert.strictEqual(result.degraded, true);

  const modernCalls = [];
  const modernProvider = createKugouProvider(path.join(temp, '.kugou-modern-cookie'), {
    song_url: async params => {
      modernCalls.push(String(params.quality));
      return { body: { data: { url: [] } } };
    },
    song_url_new: async () => ({
      body: {
        data: {
          qualities: [
            { quality: '128', tracker_url: ['https://example.invalid/song-128.mp3'], bitrate: 128000 },
            { quality: 'flac', tracker_url: ['https://example.invalid/song.flac'], bitrate: 1411000 },
          ],
        },
      },
    }),
  });
  const modernResult = await modernProvider.songUrl({ hash: 'DEF', albumId: 1, albumAudioId: 2 }, 'lossless');
  assert.deepStrictEqual(modernCalls, ['flac', '320', '128']);
  assert.strictEqual(modernResult.source, 'priv_url');
  assert.strictEqual(modernResult.level, 'lossless');
  assert.strictEqual(modernResult.format, 'flac');
  assert.strictEqual(modernResult.degraded, false);

  const sessionCookie = path.join(temp, '.kugou-session-cookie');
  fs.writeFileSync(sessionCookie, 'token=session-token; userid=42', 'utf8');
  let refreshCalls = 0;
  const sessionProvider = createKugouProvider(sessionCookie, {
    login_token: async () => {
      refreshCalls++;
      return { body: { status: 1, data: {} }, cookie: ['token=refreshed', 'userid=42', 'vip_type=1', 'vip_token=vip-ticket'] };
    },
    user_detail: async () => ({ body: { data: { nickname: 'tester', vip_type: 1 } } }),
  });
  const sessionStatus = await sessionProvider.status();
  const storedSession = sessionProvider.cookie.object();
  assert.strictEqual(refreshCalls, 1, 'Kugou login token should be exchanged once per app session');
  assert.strictEqual(sessionStatus.vipType, 1);
  assert.strictEqual(storedSession.vip_token, 'vip-ticket');
  assert.ok(storedSession.KUGOU_API_MID && storedSession.dfid, 'Kugou playback device identity must persist with the account ticket');
  console.log('platform playback quality tests passed');
})().finally(() => fs.rmSync(temp, { recursive: true, force: true }));

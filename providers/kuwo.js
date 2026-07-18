'use strict';

const { createCookieStore, parseCookieHeader } = require('./cookie-store');

const BASE = 'https://www.kuwo.cn';

async function fetchJson(url, cookie) {
  const parsed = parseCookieHeader(cookie);
  const csrf = parsed.kw_token || parsed.Hm_Iuvt || '';
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Cookie: cookie,
      Referer: `${BASE}/`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      csrf,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`KUWO_HTTP_${response.status}`);
  return response.json();
}

function createKuwoProvider(cookieFile) {
  const store = createCookieStore(cookieFile);

  async function status() {
    const cookie = store.get();
    const parsed = store.object();
    if (!cookie) return { provider: 'kuwo', loggedIn: false };
    try {
      const body = await fetchJson(`${BASE}/api/www/user/getUserInfo?httpsStatus=1`, cookie);
      const data = body.data || body;
      const user = data.userInfo || data.user || data;
      const uid = user.uid || user.userId || parsed.uid || parsed.userid || parsed.Hm_Iuvt;
      if (!uid) return { provider: 'kuwo', loggedIn: false, hasCookie: true, stale: true };
      return { provider: 'kuwo', loggedIn: true, userId: String(uid), nickname: String(user.nickName || user.nickname || user.userName || '酷我用户'), avatar: String(user.pic || user.avatar || ''), vipType: Number(user.vipType || 0), hasCookie: true };
    } catch (error) {
      return { provider: 'kuwo', loggedIn: false, hasCookie: true, stale: false, capability: 'session-only', error: error.message };
    }
  }

  async function playlists() {
    const login = await status();
    if (!login.loggedIn) return { ...login, playlists: [] };
    const url = `${BASE}/api/www/playlist/getMineList?uid=${encodeURIComponent(login.userId)}&pn=1&rn=100&httpsStatus=1`;
    try {
      const body = await fetchJson(url, store.get());
      const data = body.data || body;
      const list = data.list || data.playlist || data.data || [];
      return {
        ...login,
        capability: 'playlist-sync',
        playlists: (Array.isArray(list) ? list : []).map(raw => ({
          id: String(raw.id || raw.pid || raw.playlistId || ''), name: String(raw.name || raw.title || '酷我歌单'),
          cover: String(raw.img || raw.pic || raw.cover || ''), trackCount: Number(raw.total || raw.musicNum || raw.count || 0),
          creator: String(raw.uname || raw.userName || login.nickname), subscribed: !!raw.isCollected,
          provider: 'kuwo', source: 'kuwo',
        })).filter(item => item.id),
      };
    } catch (error) {
      return { ...login, capability: 'session-only', playlists: [], syncError: error.message };
    }
  }

  return { id: 'kuwo', status, playlists, saveCookie: value => store.set(value), logout: () => store.clear(), cookie: store };
}

module.exports = { createKuwoProvider };

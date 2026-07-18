'use strict';

const path = require('path');
const { createCookieStore, parseCookieHeader, serializeCookie } = require('./cookie-store');
const kugou = require(path.join(__dirname, '..', 'resources', 'vendor', 'kugoumusicapi', 'main'));
const { calculateMid, getGuid, randomString } = require(path.join(__dirname, '..', 'resources', 'vendor', 'kugoumusicapi', 'util', 'util'));

function bodyOf(result) {
  return result && result.body ? result.body : (result || {});
}

function dataOf(result) {
  const body = bodyOf(result);
  return body.data || body;
}

function text(value, fallback = '') {
  return value == null ? fallback : String(value);
}

const KUGOU_QUALITY_CANDIDATES = [
  { request: 'flac', level: 'lossless', label: '无损 FLAC', br: 1411000, format: 'flac' },
  { request: '320', level: 'exhigh', label: 'HQ 320kbps', br: 320000, format: 'mp3' },
  { request: '128', level: 'standard', label: '标准 128kbps', br: 128000, format: 'mp3' },
];

function normalizeKugouQualityPreference(value) {
  const raw = text(value).toLowerCase().trim();
  if (['jymaster', 'master', 'hires', 'hi-res', 'lossless', 'flac', 'sq', 'high'].includes(raw)) return 'lossless';
  if (['exhigh', '320', '320k', 'hq'].includes(raw)) return 'exhigh';
  return 'standard';
}

function kugouQualityCandidates(value) {
  const requested = normalizeKugouQualityPreference(value);
  const start = Math.max(0, KUGOU_QUALITY_CANDIDATES.findIndex(item => item.level === requested));
  return KUGOU_QUALITY_CANDIDATES.slice(start);
}

function firstAudioUrl(data) {
  const raw = data && (data.url || data.urls || data.play_url || data.playUrl);
  if (Array.isArray(raw)) return text(raw.find(Boolean));
  return text(raw);
}

function normalizedBitrate(data, fallback) {
  let value = Number(data && (data.bitrate || data.bit_rate || data.br || data.rate || 0)) || 0;
  if (value > 0 && value < 10000) value *= 1000;
  return value || fallback || 0;
}

function normalizedAudioFormat(data, audioUrl, fallback) {
  const raw = text(data && (data.format || data.ext || data.file_type || data.fileType)).toLowerCase();
  if (raw) return raw.replace(/^audio\//, '');
  const match = text(audioUrl).match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : fallback;
}

function kugouLevelFromVariant(data, audioUrl, fallbackLevel) {
  const raw = text(data && (data.quality || data.level || data.type || data.format || data.ext || data.file_type)).toLowerCase();
  const format = normalizedAudioFormat(data, audioUrl, '');
  const br = normalizedBitrate(data, 0);
  if (format === 'flac' || /flac|lossless|high|hires|hi-res/.test(raw)) return 'lossless';
  if (br >= 256000 || /(^|\D)320(\D|$)|exhigh|hq/.test(raw)) return 'exhigh';
  if (br > 0 && br < 192000 || /(^|\D)128(\D|$)|standard/.test(raw)) return 'standard';
  return fallbackLevel || 'standard';
}

function collectKugouAudioVariants(value, inherited, out, depth) {
  out = out || [];
  depth = depth || 0;
  inherited = inherited || {};
  if (depth > 6 || value == null) return out;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) out.push({ ...inherited, url: value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectKugouAudioVariants(item, inherited, out, depth + 1));
    return out;
  }
  if (typeof value !== 'object') return out;
  const meta = {
    ...inherited,
    quality: value.quality || value.level || value.type || inherited.quality,
    format: value.format || value.ext || value.file_type || inherited.format,
    bitrate: value.bitrate || value.bit_rate || value.br || value.rate || inherited.bitrate,
  };
  ['url', 'urls', 'play_url', 'playUrl', 'tracker_url', 'trackerUrl', 'backup_url', 'backupUrl'].forEach(key => {
    if (value[key] != null) collectKugouAudioVariants(value[key], meta, out, depth + 1);
  });
  ['data', 'info', 'files', 'qualities', 'audio', 'resource', 'resources', 'list'].forEach(key => {
    if (value[key] != null) collectKugouAudioVariants(value[key], meta, out, depth + 1);
  });
  return out;
}

function bestKugouAudioVariant(data, requestedQuality) {
  const rank = { standard: 1, exhigh: 2, lossless: 3 };
  const requestedRank = rank[requestedQuality] || 1;
  const variants = collectKugouAudioVariants(data);
  return variants
    .map(item => ({ ...item, level: kugouLevelFromVariant(item, item.url, requestedQuality) }))
    .filter(item => item.url && (rank[item.level] || 1) <= requestedRank)
    .sort((a, b) => (rank[b.level] || 1) - (rank[a.level] || 1))[0] || null;
}

function normalizeTrack(raw) {
  raw = raw || {};
  const album = raw.album_info || raw.albuminfo || raw.album || raw.Album || {};
  const transParam = raw.trans_param || raw.transParam || {};
  const singer = raw.singer_info || raw.singerinfo || raw.authors || raw.author_name || raw.singername || raw.singer || raw.SingerName || raw.AuthorName || '';
  const singerItems = Array.isArray(singer)
    ? singer
    : (singer && typeof singer === 'object' ? [singer] : []);
  const artist = singerItems.length
    ? singerItems.map(item => item && (item.name || item.singername || item.singer_name || item.author_name || item.authorName)).filter(Boolean).join(' / ')
    : text(singer, '未知歌手');
  const directArtistId = raw.author_id || raw.authorid || raw.singer_id || raw.singerid || raw.SingerId || raw.SingerID || raw.AuthorId || raw.AuthorID;
  const directArtistIdValue = Array.isArray(directArtistId) ? directArtistId[0] : directArtistId;
  const artistId = Number(directArtistIdValue || (singerItems[0] && (singerItems[0].id || singerItems[0].author_id || singerItems[0].authorid || singerItems[0].singer_id || singerItems[0].singerid)) || 0);
  let name = text(raw.songname || raw.song_name || raw.SongName || raw.audio_name || raw.audioName || raw.name || raw.filename || raw.FileName, '未知歌曲')
    .replace(/\.(mp3|flac|ogg|m4a|wav)$/i, '');
  if (artist) {
    const prefix = artist.split(' / ')[0] + ' - ';
    if (name.indexOf(prefix) === 0) name = name.slice(prefix.length);
  }
  return {
    id: text(raw.audio_id || raw.audioid || raw.AudioID || raw.id || raw.ID || raw.hash || raw.FileHash),
    fileId: Number(raw.fileid || raw.file_id || raw.FileID || raw.FileId || raw.audio_id || raw.audioid || raw.AudioID || 0),
    hash: text(raw.hash || raw.FileHash || raw.filehash || raw.Hash),
    albumAudioId: Number(raw.album_audio_id || raw.mixsongid || raw.MixSongID || raw.add_mixsongid || raw.audio_id || raw.audioid || raw.AudioID || raw.EMixSongID || 0),
    albumId: Number(raw.album_id || raw.AlbumID || album.album_id || album.id || 0),
    name,
    artist,
    artistId,
    artists: artist ? artist.split(/\s*\/\s*/).map((name, index) => ({ name, id: index === 0 ? artistId : 0 })) : [],
    album: text(raw.album_name || raw.AlbumName || album.album_name || album.name),
    cover: text(raw.img || raw.Image || raw.cover || raw.sizable_cover || transParam.union_cover || album.sizable_cover).replace('{size}', '300'),
    duration: Number(raw.duration || raw.Duration || raw.timelen || raw.timelength || raw.timelength_128 || 0),
    provider: 'kugou', source: 'kugou', type: 'kugou',
  };
}

function firstArray(source, keys) {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  for (const key of ['data', 'info', 'body']) {
    const nested = source[key];
    if (nested && nested !== source) {
      const found = firstArray(nested, keys);
      if (found.length) return found;
    }
  }
  return [];
}

function normalizePlaylist(raw) {
  raw = raw || {};
  return {
    id: text(raw.global_collection_id || raw.listid || raw.list_id || raw.id),
    listId: text(raw.listid || raw.list_id || raw.list_create_listid),
    name: text(raw.name || raw.listname || raw.list_name, '酷狗歌单'),
    cover: text(raw.pic || raw.img || raw.cover || raw.sizable_cover).replace('{size}', '300'),
    trackCount: Number(raw.count || raw.song_count || raw.total || 0),
    creator: text(raw.list_create_username || raw.username || raw.nickname || raw.user_name, '酷狗音乐'),
    subscribed: false,
    provider: 'kugou', source: 'kugou',
  };
}

function createKugouProvider(cookieFile, client = kugou, options = {}) {
  const store = createCookieStore(cookieFile);
  let sessionRefreshAttempted = false;
  const playlistCache = new Map();
  const playlistRequests = new Map();
  const playlistCacheMs = Math.max(1000, Number(options.playlistCacheMs) || 90000);
  const playlistRetryDelayMs = Math.max(0, Number(options.playlistRetryDelayMs) || 220);
  let favoritePlaylistCache = null;

  function ensureDeviceCookie(extra) {
    const current = { ...store.object(), ...(extra || {}) };
    const guid = current.KUGOU_API_GUID || getGuid();
    if (!current.KUGOU_API_GUID) current.KUGOU_API_GUID = guid;
    if (!current.KUGOU_API_MID) current.KUGOU_API_MID = calculateMid(guid);
    if (!current.KUGOU_API_DEV) current.KUGOU_API_DEV = randomString(10).toUpperCase();
    if (!current.KUGOU_API_MAC) current.KUGOU_API_MAC = '02:00:00:00:00:00';
    if (!current.dfid) current.dfid = randomString(24);
    store.set(current);
    return current;
  }

  function mergeSessionCookie(input) {
    const incoming = parseCookieHeader(serializeCookie(input));
    return ensureDeviceCookie(incoming);
  }

  async function refreshSession(force) {
    let cookie = ensureDeviceCookie();
    if (!cookie.userid || !cookie.token || typeof client.login_token !== 'function') return cookie;
    if (!force && sessionRefreshAttempted) return cookie;
    sessionRefreshAttempted = true;
    try {
      const result = await client.login_token({ cookie });
      const data = dataOf(result);
      if (Number(bodyOf(result).status || data.status || 0) === 1 || result.cookie) {
        cookie = mergeSessionCookie(result.cookie || data);
      }
    } catch (error) {
      // The original token can still serve public tracks when refresh is temporarily unavailable.
    }
    return cookie;
  }

  async function status() {
    const cookie = await refreshSession(false);
    if (!cookie.userid || !cookie.token) return { provider: 'kugou', loggedIn: false, hasCookie: !!store.get() };
    try {
      const result = await client.user_detail({ cookie });
      const data = dataOf(result);
      const profile = data.user_info || data.info || data;
      return {
        provider: 'kugou', loggedIn: true, userId: text(cookie.userid),
        nickname: text(profile.nickname || profile.username || profile.user_name, `酷狗用户 ${cookie.userid}`),
        avatar: text(profile.pic || profile.avatar || profile.user_img),
        vipType: Number(profile.vip_type || cookie.vip_type || 0), hasCookie: true,
      };
    } catch (error) {
      return { provider: 'kugou', loggedIn: true, userId: text(cookie.userid), nickname: `酷狗用户 ${cookie.userid}`, avatar: '', vipType: Number(cookie.vip_type || 0), hasCookie: true, stale: false, profileError: error.message };
    }
  }

  async function qrKey() {
    const result = await client.login_qr_key({ cookie: ensureDeviceCookie() });
    const data = dataOf(result);
    return { provider: 'kugou', key: data.qrcode, qrimg: data.qrcode_img };
  }

  async function qrCheck(key) {
    const result = await client.login_qr_check({ key, cookie: ensureDeviceCookie() });
    const data = dataOf(result);
    const statusCode = Number(data.status == null ? bodyOf(result).status : data.status);
    if (statusCode === 4) {
      mergeSessionCookie(result.cookie || { token: data.token, userid: data.userid });
      sessionRefreshAttempted = false;
      await refreshSession(true);
    }
    return { provider: 'kugou', code: statusCode, message: text(data.message || bodyOf(result).error), ...(statusCode === 4 ? await status() : {}) };
  }

  async function playlists(options = {}) {
    const login = await status();
    if (!login.loggedIn) return { ...login, playlists: [] };
    const result = await client.user_playlist({ cookie: store.object(), page: 1, pagesize: 100 });
    const data = dataOf(result);
    const list = data.info || data.list || data.lists || data.data || [];
    const normalized = (Array.isArray(list) ? list : []).map(normalizePlaylist).filter(item => item.id);
    const missing = options.hydrateCovers === false
      ? []
      : normalized.filter(item => !item.cover && item.trackCount > 0).slice(0, 12);
    await Promise.all(missing.map(async item => {
      try {
        const detail = await fetchPlaylist(item.id, 1);
        const first = detail && detail.tracks && detail.tracks[0];
        if (first && first.cover) item.cover = first.cover;
      } catch (error) {
        // A missing fallback cover must not block the rest of the user's library.
      }
    }));
    return { ...login, playlists: normalized };
  }

  async function fetchPlaylist(id, requestedLimit) {
    const cookie = store.object();
    const limit = Math.max(1, Math.min(500, Number(requestedLimit) || 500));
    const collectionMatch = text(id).match(/^collection_\d+_\d+_(\d+)_\d+$/);
    const listId = collectionMatch ? collectionMatch[1] : id;
    const [detailResult, oldTracksResult, newTracksResult] = await Promise.all([
      client.playlist_detail({ ids: id, cookie }).catch(() => null),
      client.playlist_track_all({ id, page: 1, pagesize: limit, cookie }).catch(() => null),
      client.playlist_track_all_new({ listid: listId, page: 1, pagesize: limit, cookie }).catch(() => null),
    ]);
    const detailData = dataOf(detailResult);
    const detailList = firstArray(detailData, ['info', 'list', 'lists']);
    const oldTracks = firstArray(bodyOf(oldTracksResult), ['songs', 'info', 'list', 'lists']);
    const newTracks = firstArray(bodyOf(newTracksResult), ['songs', 'info', 'list', 'lists']);
    const tracks = oldTracks.length ? oldTracks : newTracks;
    return {
      provider: 'kugou', playlist: normalizePlaylist(Array.isArray(detailList) ? detailList[0] : detailList),
      tracks: (Array.isArray(tracks) ? tracks.slice(0, limit) : []).map(normalizeTrack),
    };
  }

  async function playlist(id, options) {
    const key = text(id).replace(/^kugou:/, '');
    const requestedLimit = Math.max(1, Math.min(500, Number(options && options.limit) || 500));
    if (requestedLimit < 500) return fetchPlaylist(key, requestedLimit);
    const cached = playlistCache.get(key);
    if (cached && cached.expiresAt > Date.now() && (cached.value.tracks.length || cached.confirmedEmpty)) return cached.value;
    if (playlistRequests.has(key)) return playlistRequests.get(key);

    const request = (async () => {
      let result = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        result = await fetchPlaylist(key, 500);
        if (result.tracks.length) {
          playlistCache.set(key, { value: result, expiresAt: Date.now() + playlistCacheMs });
          return result;
        }
        if (attempt < 2 && playlistRetryDelayMs) {
          await new Promise(resolve => setTimeout(resolve, playlistRetryDelayMs * (attempt + 1)));
        }
      }
      return result || { provider: 'kugou', playlist: normalizePlaylist({ id: key }), tracks: [] };
    })();
    playlistRequests.set(key, request);
    try {
      return await request;
    } finally {
      playlistRequests.delete(key);
    }
  }

  function clearPlaylistCache() {
    playlistCache.clear();
    playlistRequests.clear();
  }

  function invalidatePlaylistCache(target) {
    const ids = new Set([target && target.id, target && target.listId].filter(Boolean).map(value => text(value).replace(/^kugou:/, '')));
    for (const key of playlistCache.keys()) {
      const value = playlistCache.get(key);
      const playlistInfo = value && value.value && value.value.playlist;
      if (ids.has(text(key)) || ids.has(text(playlistInfo && playlistInfo.id)) || ids.has(text(playlistInfo && playlistInfo.listId))) {
        playlistCache.delete(key);
        playlistRequests.delete(key);
      }
    }
  }

  function removeTrackFromPlaylistCache(target, track, fileId) {
    const hash = text(track && track.hash).toUpperCase();
    const ids = new Set([target && target.id, target && target.listId].filter(Boolean).map(value => text(value).replace(/^kugou:/, '')));
    for (const [key, cached] of playlistCache.entries()) {
      const value = cached && cached.value;
      const playlistInfo = value && value.playlist;
      if (!value || (!ids.has(text(key)) && !ids.has(text(playlistInfo && playlistInfo.id)) && !ids.has(text(playlistInfo && playlistInfo.listId)))) continue;
      value.tracks = (value.tracks || []).filter(item => {
        if (hash && text(item.hash).toUpperCase() === hash) return false;
        return Number(item.fileId || 0) !== Number(fileId || 0);
      });
      cached.confirmedEmpty = value.tracks.length === 0;
    }
  }

  async function writablePlaylist(id) {
    const result = await playlists({ hydrateCovers: false });
    if (!result.loggedIn) throw new Error('LOGIN_REQUIRED');
    const requested = text(id).replace(/^kugou:/, '');
    const match = (result.playlists || []).find(item => item.id === requested || item.listId === requested);
    if (!match) throw new Error('KUGOU_PLAYLIST_NOT_FOUND');
    const listId = text(match.listId || (requested.match(/^collection_\d+_\d+_(\d+)_\d+$/) || [])[1] || requested);
    if (!listId) throw new Error('KUGOU_PLAYLIST_NOT_WRITABLE');
    return { ...match, listId };
  }

  async function favoritePlaylist() {
    if (favoritePlaylistCache) return favoritePlaylistCache;
    const result = await playlists({ hydrateCovers: false });
    if (!result.loggedIn) throw new Error('LOGIN_REQUIRED');
    const list = result.playlists || [];
    const nameOf = item => text(item && item.name).replace(/\s+/g, '').toLowerCase();
    const favorite = list.find(item => nameOf(item) === '我喜欢') ||
      list.find(item => /^我喜欢(?:的音乐|的歌曲)?$/.test(nameOf(item))) ||
      list.find(item => nameOf(item).includes('我喜欢')) ||
      list.find(item => /喜欢|收藏/i.test(nameOf(item))) || list[0];
    if (!favorite) throw new Error('KUGOU_FAVORITE_PLAYLIST_NOT_FOUND');
    const requested = text(favorite.id).replace(/^kugou:/, '');
    const listId = text(favorite.listId || (requested.match(/^collection_\d+_\d+_(\d+)_\d+$/) || [])[1] || requested);
    if (!listId) throw new Error('KUGOU_PLAYLIST_NOT_WRITABLE');
    favoritePlaylistCache = { ...favorite, listId };
    return favoritePlaylistCache;
  }

  function kugouWriteSucceeded(result) {
    const body = bodyOf(result);
    const data = dataOf(result);
    const code = Number(body.status ?? body.code ?? data.status ?? data.code ?? 1);
    return code === 0 || code === 1 || code === 200;
  }

  async function addSongToPlaylist(id, track, resolvedTarget) {
    if (!track || !text(track.hash || track.FileHash)) throw new Error('KUGOU_TRACK_HASH_REQUIRED');
    const target = resolvedTarget || await writablePlaylist(id);
    const normalized = normalizeTrack(track);
    const data = [
      track.name || normalized.name,
      track.hash || normalized.hash,
      Number(track.albumId || track.album_id || normalized.albumId || 0),
      Number(track.albumAudioId || track.album_audio_id || track.mixsongid || normalized.albumAudioId || 0),
    ].join('|');
    const result = await client.playlist_tracks_add({ listid: target.listId, data, cookie: store.object() });
    if (!kugouWriteSucceeded(result)) throw new Error(text(bodyOf(result).error || bodyOf(result).message, 'KUGOU_PLAYLIST_ADD_FAILED'));
    invalidatePlaylistCache(target);
    return { success: true, provider: 'kugou', playlist: target, body: bodyOf(result) };
  }

  async function removeSongFromPlaylist(id, track, resolvedTarget) {
    const target = resolvedTarget || await writablePlaylist(id);
    const detail = await playlist(target.id);
    const hash = text(track && track.hash).toUpperCase();
    const actionId = text(track && track.id).toUpperCase();
    const match = (detail.tracks || []).find(item =>
      (hash && text(item.hash).toUpperCase() === hash) ||
      (actionId && text(item.id).toUpperCase() === actionId)
    );
    let fileId = Number(match && match.fileId) || 0;
    if (!fileId && !hash && !actionId) fileId = Number(track && (track.fileId || track.fileid)) || 0;
    if (!fileId) throw new Error('KUGOU_TRACK_FILE_ID_REQUIRED');
    const result = await client.playlist_tracks_del({ listid: target.listId, fileids: String(fileId), cookie: store.object() });
    if (!kugouWriteSucceeded(result)) throw new Error(text(bodyOf(result).error || bodyOf(result).message, 'KUGOU_PLAYLIST_REMOVE_FAILED'));
    removeTrackFromPlaylistCache(target, track, fileId);
    return { success: true, provider: 'kugou', playlist: target, body: bodyOf(result) };
  }

  async function likedStatus(ids) {
    const favorite = await favoritePlaylist();
    const detail = await playlist(favorite.id);
    const present = new Set();
    (detail.tracks || []).forEach(track => {
      [track.hash, track.id].filter(Boolean).forEach(value => present.add(text(value).toUpperCase()));
    });
    const liked = {};
    (ids || []).forEach(id => { liked[text(id)] = present.has(text(id).toUpperCase()); });
    return { loggedIn: true, provider: 'kugou', liked };
  }

  async function likedSnapshot() {
    const favorite = await favoritePlaylist();
    const detail = await playlist(favorite.id, { limit: 5000 });
    const ids = [];
    const seen = new Set();
    (detail.tracks || []).forEach(track => {
      const id = text(track.hash || track.id).toUpperCase();
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });
    const expected = Number(detail.playlist && detail.playlist.trackCount) || 0;
    return { loggedIn: true, provider: 'kugou', complete: !expected || ids.length >= expected, playlistId: favorite.id, ids };
  }

  async function setLiked(track, liked) {
    const favorite = await favoritePlaylist();
    return liked ? addSongToPlaylist(favorite.id, track, favorite) : removeSongFromPlaylist(favorite.id, track, favorite);
  }

  async function search(keywords, limit = 18) {
    const result = await client.search({ keywords, type: 'song', page: 1, pagesize: limit, cookie: store.object() });
    const songs = firstArray(bodyOf(result), ['lists', 'songs', 'info', 'list']);
    return { provider: 'kugou', songs: songs.map(normalizeTrack).filter(song => song.id || song.hash) };
  }

  function normalizedArtistName(value) {
    return text(value).toLowerCase().replace(/[\s·・,，、/\\|&＋+_-]+/g, '').replace(/[()（）\[\]【】"'“”‘’]/g, '');
  }

  function trackMatchesArtist(track, artistName) {
    const expected = normalizedArtistName(artistName);
    if (!expected) return true;
    return text(track && track.artist).split(/\s*\/\s*|\s*,\s*|、|&/).some(name => {
      const actual = normalizedArtistName(name);
      return actual && (actual === expected || actual.includes(expected) || expected.includes(actual));
    });
  }

  async function artistDetail(params = {}) {
    const requestedName = text(params.name);
    const limit = Math.max(10, Math.min(80, Number(params.limit) || 36));
    let artistId = Number(params.id || 0);
    let fallbackSongs = [];

    if (requestedName) {
      try {
        const searched = await search(requestedName, Math.max(limit, 36));
        fallbackSongs = searched.songs.filter(song => trackMatchesArtist(song, requestedName)).slice(0, limit);
        if (!artistId) {
          const identified = fallbackSongs.find(song => Number(song.artistId));
          if (identified) artistId = Number(identified.artistId);
        }
      } catch (_) {}
    }

    let detail = {};
    let songs = [];
    if (artistId && typeof client.artist_detail === 'function') {
      try { detail = dataOf(await client.artist_detail({ id: artistId, cookie: ensureDeviceCookie() })) || {}; }
      catch (_) {}
    }
    if (artistId && typeof client.artist_audios === 'function') {
      try {
        const result = await client.artist_audios({ id: artistId, page: 1, pagesize: limit, sort: 'hot', cookie: ensureDeviceCookie() });
        songs = firstArray(bodyOf(result), ['songs', 'audios', 'audio', 'lists', 'list', 'info'])
          .map(normalizeTrack).filter(song => song.id || song.hash).slice(0, limit)
          .map(song => ({
            ...song,
            artistId: Number(song.artistId || artistId || 0),
            artists: song.artists && song.artists.length
              ? song.artists.map((item, index) => ({ ...item, id: Number(item.id || (index === 0 ? artistId : 0)) }))
              : [{ name: requestedName || '未知歌手', id: artistId }],
          }));
      } catch (_) {}
    }
    if (!songs.length) songs = fallbackSongs;

    const base = detail.author_info || detail.author || detail.base || detail.info || detail;
    const firstSong = songs[0] || {};
    const artistName = text(base.author_name || base.name || base.singername || requestedName || firstSong.artist, '未知歌手');
    const avatar = text(base.avatar || base.sizable_avatar || base.image || base.pic || params.cover || firstSong.cover).replace('{size}', '300');
    return {
      provider: 'kugou',
      artist: { provider: 'kugou', id: artistId || '', name: artistName, avatar },
      total: Number(detail.total || detail.total_count || detail.count || 0) || songs.length,
      songs: songs.map(song => ({ ...song, provider: 'kugou', source: 'kugou', type: 'kugou' })),
      error: songs.length || artistName !== '未知歌手' ? '' : 'KUGOU_ARTIST_NOT_FOUND',
    };
  }

  function scoreLyricCandidate(candidate, track) {
    let score = Number(candidate && candidate.score) || 0;
    const songName = normalizedArtistName(track && track.name);
    const artistName = normalizedArtistName(track && track.artist);
    if (songName && normalizedArtistName(candidate && candidate.song) === songName) score += 100;
    if (artistName && normalizedArtistName(candidate && candidate.singer).includes(artistName)) score += 80;
    const expectedDuration = Number(track && track.duration) || 0;
    const candidateDuration = Number(candidate && candidate.duration) || 0;
    if (expectedDuration && candidateDuration) {
      const expectedMs = expectedDuration > 10000 ? expectedDuration : expectedDuration * 1000;
      if (Math.abs(expectedMs - candidateDuration) < 2500) score += 40;
    }
    return score;
  }

  async function lyrics(track = {}) {
    const hash = text(track.hash || track.id).toUpperCase();
    if (!hash) return { provider: 'kugou', lyric: '', error: 'MISSING_HASH' };
    const searchResult = await client.search_lyric({
      hash,
      album_audio_id: Number(track.albumAudioId || track.album_audio_id || 0),
      keywords: [track.name, track.artist].filter(Boolean).join(' - '),
      cookie: ensureDeviceCookie(),
    });
    const candidates = firstArray(bodyOf(searchResult), ['candidates', 'lists', 'list'])
      .filter(item => item && item.id && item.accesskey)
      .sort((a, b) => scoreLyricCandidate(b, track) - scoreLyricCandidate(a, track));
    if (!candidates.length) return { provider: 'kugou', lyric: '', error: 'KUGOU_LYRIC_NOT_FOUND' };
    const selected = candidates[0];
    const result = await client.lyric({ id: selected.id, accesskey: selected.accesskey, fmt: 'lrc', decode: true, cookie: ensureDeviceCookie() });
    const body = bodyOf(result);
    let lyricText = text(body.decodeContent);
    if (!lyricText && body.content && Number(body.contenttype) !== 0) {
      try { lyricText = Buffer.from(body.content, 'base64').toString('utf8'); } catch (_) {}
    }
    return {
      provider: 'kugou', hash, lyric: lyricText, tlyric: '', yrc: '',
      lyricId: text(selected.id), source: 'kugou-lyrics',
      error: lyricText ? '' : 'KUGOU_LYRIC_DECODE_FAILED',
    };
  }

  async function resolvePlaybackTrack(track) {
    const resolved = { ...(track || {}) };
    if (resolved.albumAudioId || !resolved.hash || typeof client.audio !== 'function') return resolved;
    try {
      const result = await client.audio({ hash: resolved.hash, cookie: store.object() });
      const body = bodyOf(result);
      const data = dataOf(result);
      const list = firstArray(body, ['data', 'info', 'list', 'songs']);
      const raw = list[0] || data.audio_info || data.info || data;
      const detail = normalizeTrack(raw);
      if (detail.albumAudioId) resolved.albumAudioId = detail.albumAudioId;
      if (detail.albumId) resolved.albumId = detail.albumId;
      if (detail.hash) resolved.hash = detail.hash;
    } catch (error) {
      // The legacy hash-only URL endpoint remains available as a fallback.
    }
    return resolved;
  }

  async function songUrl(track, quality = 'lossless') {
    await refreshSession(false);
    track = await resolvePlaybackTrack(track);
    const requestedQuality = normalizeKugouQualityPreference(quality);
    const tried = [];
    let lastError = null;
    for (const candidate of kugouQualityCandidates(requestedQuality)) {
      tried.push(candidate.request);
      try {
        const result = await client.song_url({
          hash: track.hash, album_id: track.albumId, album_audio_id: track.albumAudioId,
          quality: candidate.request, cookie: store.object(),
        });
        const data = dataOf(result);
        const audioUrl = firstAudioUrl(data);
        if (!audioUrl) continue;
        const format = normalizedAudioFormat(data, audioUrl, candidate.format);
        const reportedBr = normalizedBitrate(data, 0);
        const br = reportedBr || (format === 'flac' ? candidate.br : (candidate.level === 'lossless' ? 320000 : candidate.br));
        const actualLevel = format === 'flac' ? 'lossless' : (br >= 256000 ? 'exhigh' : candidate.level);
        return {
          provider: 'kugou',
          url: audioUrl,
          playable: true,
          trial: false,
          requestedQuality,
          level: actualLevel,
          quality: actualLevel === 'lossless' ? '无损 FLAC' : (actualLevel === 'exhigh' ? 'HQ 320kbps' : '标准 128kbps'),
          br,
          format,
          degraded: actualLevel !== requestedQuality,
          tried,
          raw: data,
        };
      } catch (error) {
        lastError = error;
      }
    }
    if (typeof client.song_url_new === 'function') {
      tried.push('priv_url');
      try {
        const result = await client.song_url_new({
          hash: track.hash,
          album_audio_id: track.albumAudioId,
          cookie: store.object(),
        });
        const data = dataOf(result);
        const variant = bestKugouAudioVariant(data, requestedQuality);
        if (variant) {
          const format = normalizedAudioFormat(variant, variant.url, variant.level === 'lossless' ? 'flac' : 'mp3');
          const br = normalizedBitrate(variant, variant.level === 'lossless' ? 1411000 : (variant.level === 'exhigh' ? 320000 : 128000));
          return {
            provider: 'kugou',
            url: variant.url,
            playable: true,
            trial: false,
            requestedQuality,
            level: variant.level,
            quality: variant.level === 'lossless' ? '无损 FLAC' : (variant.level === 'exhigh' ? 'HQ 320kbps' : '标准 128kbps'),
            br,
            format,
            degraded: variant.level !== requestedQuality,
            tried,
            source: 'priv_url',
          };
        }
      } catch (error) {
        lastError = error;
      }
    }
    return {
      provider: 'kugou', url: '', playable: false, requestedQuality,
      degraded: false, tried, error: lastError && lastError.message,
    };
  }

  return {
    id: 'kugou', status, qrKey, qrCheck, playlists, playlist, search, artistDetail, lyrics, songUrl,
    addSongToPlaylist, removeSongFromPlaylist, likedStatus, likedSnapshot, setLiked,
    logout: () => { sessionRefreshAttempted = false; favoritePlaylistCache = null; clearPlaylistCache(); store.clear(); },
    cookie: store,
  };
}

module.exports = {
  createKugouProvider,
  normalizePlaylist,
  normalizeTrack,
  normalizeKugouQualityPreference,
  kugouQualityCandidates,
  serializeCookie,
};

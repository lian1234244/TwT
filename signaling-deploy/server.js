const http = require('http');
const fs = require('fs');
const PORT = process.env.PORT || 8080;

const clients = new Map();
const clientQueues = new Map();
const pollingRequests = new Map();
const LOG_FILE = require('path').join(__dirname, 'server-debug.log');
fs.writeFileSync(LOG_FILE, `=== TwT Signaling Server started ${new Date().toISOString()} ===\n`);

function log(msg) {
  const line = `[${new Date().toISOString().substring(11, 23)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function deliverMessage(friendCode, msg) {
  const pollRes = pollingRequests.get(friendCode);
  if (pollRes) {
    pollingRequests.delete(friendCode);
    clearTimeout(pollRes.timeout);
    pollRes.res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    pollRes.res.end(JSON.stringify([msg]));
    log(`[delivered-poll] ${msg.type} -> ${friendCode}`);
    return true;
  }
  if (!clientQueues.has(friendCode)) clientQueues.set(friendCode, []);
  clientQueues.get(friendCode).push(msg);
  log(`[queued] ${msg.type} -> ${friendCode} (queue size=${clientQueues.get(friendCode).length})`);
  return false;
}

function broadcastOffline(friendCode) {
  deliverMessage(friendCode, { type: 'friendOffline', fromCode: friendCode });
  for (const code of clients.keys()) {
    if (code !== friendCode) deliverMessage(code, { type: 'friendOffline', fromCode: friendCode });
  }
}

function processMessage(msg, senderCode) {
  switch (msg.type) {
    case 'register':
      clients.set(msg.friendCode, { myId: msg.myId, name: msg.name || 'anon', lastSeen: Date.now() });
      log(`[register] friendCode=${msg.friendCode} myId=${msg.myId} name=${msg.name || 'anon'} | total clients=${clients.size}`);
      log(`[clients] ${Array.from(clients.keys()).join(', ')}`);
      return;
    case 'debug_log':
      log(`[frontend:${senderCode || '?'}] ${msg.text || ''}`);
      return;
    case 'friendRequest':
      log(`[friendRequest] from=${msg.fromCode} to=${msg.to} name=${msg.name || '?'}`);
      break;
    case 'friendAccept':
      log(`[friendAccept] from=${msg.fromCode} to=${msg.to} name=${msg.name || '?'}`);
      break;
    case 'friendReject':
      log(`[friendReject] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'friendRemove':
      log(`[friendRemove] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'webrtc_offer':
      log(`[webrtc_offer] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'webrtc_answer':
      log(`[webrtc_answer] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'webrtc_ice':
      break;
    case 'status_update':
      log(`[status_update] from=${msg.fromCode} to=${msg.to} status=${msg.status || '?'}`);
      break;
    case 'friendOffline':
      log(`[friendOffline] from=${msg.fromCode}`);
      break;
    case 'heartbeat':
      if (senderCode && clients.has(senderCode)) {
        clients.get(senderCode).lastSeen = Date.now();
      }
      return;
    case 'lt_invite':
      log(`[lt_invite] from=${msg.fromCode} to=${msg.to} host=${msg.host || '?'}`);
      break;
    case 'lt_accept':
      log(`[lt_accept] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'lt_reject':
      log(`[lt_reject] from=${msg.fromCode} to=${msg.to}`);
      break;
    case 'lt_sync':
    case 'lt_play':
    case 'lt_pause':
    case 'lt_switch':
    case 'lt_state':
    case 'lt_chat':
    case 'lt_leave':
      break;
    default:
      log(`[unknown] type=${msg.type} from=${msg.fromCode || '?'} to=${msg.to || '?'}`);
      break;
  }

  if (msg.type !== 'register' && msg.to) {
    if (clients.has(msg.to)) {
      deliverMessage(msg.to, msg);
      log(`[routed] ${msg.type}: ${msg.fromCode} -> ${msg.to} OK`);
    } else {
      log(`[routed] ${msg.type}: ${msg.fromCode} -> ${msg.to} FAILED (target not found, online codes: ${Array.from(clients.keys()).join(', ')})`);
    }
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'twt-signaling', clients: clients.size }));
    return;
  }

  if (url.pathname === '/send' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        processMessage(msg, msg.fromCode);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        log(`[send-error] ${e.message}`);
        res.writeHead(400); res.end('Bad Request');
      }
    });
    return;
  }

  if (url.pathname === '/poll' && req.method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) { res.writeHead(400); res.end('Missing code'); return; }

    const queue = clientQueues.get(code) || [];
    if (queue.length > 0) {
      clientQueues.set(code, []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(queue));
      return;
    }

    const timeout = setTimeout(() => {
      pollingRequests.delete(code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }, 25000);

    pollingRequests.set(code, { res, timeout });
    return;
  }

  if (url.pathname === '/offline' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.code && clients.has(data.code)) {
          log(`[offline] ${data.code}`);
          clients.delete(data.code);
          broadcastOffline(data.code);
        }
      } catch (e) {}
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  res.writeHead(404); res.end('Not Found');
});

server.listen(PORT, () => {
  log(`[TwT Signaling] listening on :${PORT} (HTTP long-polling mode)`);
});

setInterval(() => {
  const now = Date.now();
  for (const [code, client] of clients) {
    if (now - client.lastSeen > 60000) {
      log(`[timeout] ${code} (inactive ${Math.round((now - client.lastSeen)/1000)}s)`);
      clients.delete(code);
      broadcastOffline(code);
    }
  }
}, 30000);

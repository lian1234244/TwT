const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Map();

console.log(`[TwT Signaling] listening on :${PORT}`);

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    switch (msg.type) {
      case 'register':
        clients.set(msg.friendCode, ws);
        ws.friendCode = msg.friendCode;
        ws.myId = msg.myId;
        console.log(`[register] ${msg.friendCode} (${msg.name || 'anon'})`);
        break;

      case 'friendRequest':
      case 'friendAccept':
      case 'friendReject':
      case 'webrtc_offer':
      case 'webrtc_answer':
      case 'webrtc_ice':
      case 'status_update': {
        const target = clients.get(msg.to);
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(data);
        }
        break;
      }

      case 'friendOffline': {
        const target = clients.get(msg.to);
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(data);
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.friendCode) {
      console.log(`[offline] ${ws.friendCode}`);
      clients.delete(ws.friendCode);
      for (const [code, client] of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'friendOffline',
            fromCode: ws.friendCode
          }));
        }
      }
    }
  });

  ws.on('error', () => {});
});
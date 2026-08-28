const http = require('http');
const fs = require('fs');
const FRIEND_CODE = 'TEST42';
const MY_ID = 'twt_bot_test';
const MY_NAME = '测试机器人';
const SERVER_URL = 'http://localhost:8080';
const LOG_FILE = require('path').join(__dirname, 'bot-debug.log');

function log(msg) {
  const line = `[${new Date().toISOString().substring(11, 23)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function sendMsg(msg) {
  const body = JSON.stringify(msg);
  const req = http.request(SERVER_URL + '/send', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, () => {});
  req.on('error', () => {});
  req.write(body);
  req.end();
}

function poll() {
  http.get(SERVER_URL + '/poll?code=' + FRIEND_CODE + '&t=' + Date.now(), (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const msgs = JSON.parse(data);
        if (msgs && msgs.length) {
          for (const msg of msgs) {
            log('recv: type=' + msg.type + ' from=' + (msg.fromCode||'?'));
            handleMessage(msg);
          }
        }
      } catch (e) {}
      setTimeout(poll, 100);
    });
  }).on('error', () => { setTimeout(poll, 3000); });
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'friendRequest':
      log('>>> 收到好友请求: ' + msg.name + ' (' + msg.fromCode + ')');
      sendMsg({ type: 'friendAccept', to: msg.fromCode, fromCode: FRIEND_CODE, fromId: MY_ID, name: MY_NAME, avatar: '' });
      log('>>> 已发送 friendAccept to=' + msg.fromCode);
      break;
    case 'friendAccept':
      log('>>> 好友已接受: ' + msg.name);
      break;
    case 'friendReject':
      log('>>> 好友被拒绝');
      break;
    case 'status_update':
      log('状态更新: ' + msg.fromCode + ' status=' + (msg.status||'?'));
      break;
    case 'friendOffline':
      log('好友离线: ' + msg.fromCode);
      break;
    case 'webrtc_offer':
    case 'webrtc_answer':
    case 'webrtc_ice':
      log('WebRTC: ' + msg.type + ' from=' + msg.fromCode);
      break;
    case 'lt_invite':
      log('>>> 收到一起听邀请: ' + msg.host + ' room=' + msg.roomCode);
      sendMsg({ type: 'lt_accept', to: msg.fromCode, fromCode: FRIEND_CODE, roomCode: msg.roomCode });
      log('>>> 已发送 lt_accept to=' + msg.fromCode);
      break;
    case 'lt_accept':
      log('>>> 一起听已接受: ' + msg.fromCode);
      break;
    case 'lt_reject':
      log('>>> 一起听被拒绝: ' + msg.fromCode);
      break;
    case 'lt_sync':
      log('一起听同步: ' + msg.fromCode + ' time=' + msg.currentTime + ' playing=' + msg.playing);
      break;
    case 'lt_play':
    case 'lt_pause':
    case 'lt_switch':
    case 'lt_state':
      log('一起听控制: ' + msg.type + ' from=' + msg.fromCode);
      break;
    case 'lt_chat':
      log('一起听聊天: ' + msg.fromCode + ': ' + msg.text);
      break;
    case 'lt_leave':
      log('>>> 好友离开一起听: ' + msg.fromCode);
      break;
  }
}

fs.writeFileSync(LOG_FILE, `=== Test Bot started ${new Date().toISOString()} ===\n`);
log('connecting to ' + SERVER_URL);
sendMsg({ type: 'register', friendCode: FRIEND_CODE, myId: MY_ID, name: MY_NAME });
log('registered as ' + FRIEND_CODE);
log('========================================');
log('  测试机器人已上线! 好友码: ' + FRIEND_CODE);
log('  会自动同意好友申请');
log('========================================');
poll();
setInterval(() => { sendMsg({ type: 'heartbeat', fromCode: FRIEND_CODE }); }, 30000);

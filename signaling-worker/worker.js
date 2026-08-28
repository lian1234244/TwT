// TwT 信令服务器 - Cloudflare Worker + Durable Object 版
// 协议与 signaling-deploy/server.js 完全一致（POST /send、GET /poll?code=、GET / 健康检查），
// 客户端 public/index.html 无需任何改动。
//
// 为什么需要 Durable Object：好友在线表、消息队列必须常驻内存/存储；
// 普通 Worker 无状态（多次请求可能落在不同实例），DO 保证所有请求命中同一实例。
// 免费版要求 SQLite 存储类（new_sqlite_classes，见 wrangler.toml）。

const HEARTBEAT_TIMEOUT_MS = 60000; // 与原服务器一致：60 秒无心跳视为掉线
const ALARM_INTERVAL_MS = 30000;    // 每 30 秒清扫一次超时客户端
const QUEUE_CAP = 200;              // 单客户端离线消息队列上限，防止无限膨胀

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function jsonRes(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
  });
}

export default {
  async fetch(request, env) {
    // 所有请求交给单例 Durable Object，保证状态集中
    const id = env.SIGNALING.idFromName('global');
    const stub = env.SIGNALING.get(id);
    return stub.fetch(request);
  },
};

export class SignalingDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.queues = new Map(); // friendCode -> [msg]（内存队列，短期消息，DO 重启后允许丢失）
  }

  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/health') {
      const count = await this.countClients();
      return jsonRes({ status: 'ok', service: 'twt-signaling-worker', clients: count });
    }

    if (path === '/send' && request.method === 'POST') {
      let msg;
      try {
        msg = await request.json();
      } catch (e) {
        return new Response('Bad Request', { status: 400, headers: corsHeaders() });
      }
      await this.processMessage(msg);
      return jsonRes({ ok: true });
    }

    if (path === '/poll' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Missing code', { status: 400, headers: corsHeaders() });
      const q = this.queues.get(code);
      const msgs = q && q.length ? q.slice() : [];
      if (q) this.queues.set(code, []);
      return jsonRes(msgs);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  }

  async processMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'register') {
      await this.state.storage.put('c:' + msg.friendCode, {
        myId: msg.myId || '',
        name: msg.name || 'anon',
        lastSeen: Date.now(),
      });
      await this.touchAlarm();
      return;
    }

    if (msg.type === 'heartbeat') {
      const key = 'c:' + msg.fromCode;
      const rec = await this.state.storage.get(key);
      if (rec) {
        // 心跳同时充当“重新在线”：DO 重启后靠心跳恢复在线状态
        rec.lastSeen = Date.now();
        await this.state.storage.put(key, rec);
        await this.touchAlarm();
      }
      return;
    }

    if (msg.type === 'debug_log') return; // 调试日志不落盘，直接忽略

    // 定向投递：目标只要注册过（含重启后仅存在于存储中的）就入队
    if (msg.to) {
      const target = await this.state.storage.get('c:' + msg.to);
      if (target) {
        this.deliver(msg.to, msg);
      }
    }
  }

  deliver(code, msg) {
    if (!this.queues.has(code)) this.queues.set(code, []);
    const q = this.queues.get(code);
    q.push(msg);
    if (q.length > QUEUE_CAP) q.splice(0, q.length - QUEUE_CAP);
  }

  async countClients() {
    const list = await this.state.storage.list({ prefix: 'c:' });
    return list.size;
  }

  async touchAlarm() {
    const current = await this.state.storage.getAlarm();
    if (current === null) {
      await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
  }

  // 周期清扫：超时未心跳的客户端标记掉线并广播给所有人（与原服务器一致）
  async alarm() {
    const now = Date.now();
    const expired = [];
    const list = await this.state.storage.list({ prefix: 'c:' });
    for (const [key, rec] of list) {
      if (now - (rec.lastSeen || 0) > HEARTBEAT_TIMEOUT_MS) expired.push(key);
    }
    for (const key of expired) {
      const code = key.substring(2);
      await this.state.storage.delete(key);
      this.queues.delete(code);
      const remaining = await this.state.storage.list({ prefix: 'c:' });
      for (const [otherKey] of remaining) {
        this.deliver(otherKey.substring(2), { type: 'friendOffline', fromCode: code });
      }
    }
    if (list.size - expired.length > 0) {
      await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
  }
}

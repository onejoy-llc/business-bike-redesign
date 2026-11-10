// ビジネスバイクGOGO サイトサーバー（外部ライブラリ不要 / Node.js 18+）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const views = require('./views');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PUBLIC = path.join(ROOT, 'public');
const ADMIN = path.join(ROOT, 'admin');
const UPLOADS = path.join(PUBLIC, 'uploads');

// ---------- データ ----------
function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); } catch { return fallback; }
}
function writeJSON(name, value) {
  const file = path.join(DATA, name);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
const getContent = () => readJSON('content.json', {});

// ---------- 管理者認証 ----------
function hashPassword(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}
function ensureAdmin() {
  if (readJSON('admin.json', null)) return;
  const salt = crypto.randomBytes(16).toString('hex');
  const initial = process.env.ADMIN_PASSWORD || 'atoz-admin';
  writeJSON('admin.json', { salt, hash: hashPassword(initial, salt), initial: true });
  console.log(`[admin] 初期パスワード: ${initial}  （ログイン後に必ず変更してください）`);
}
function checkPassword(pw) {
  const a = readJSON('admin.json', null);
  if (!a || typeof pw !== 'string') return false;
  const h = Buffer.from(hashPassword(pw, a.salt), 'hex');
  const ref = Buffer.from(a.hash, 'hex');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
}
const sessions = new Map(); // token -> expires
const SESSION_MS = 1000 * 60 * 60 * 8;
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function isAuthed(req) {
  const t = parseCookies(req).atoz_admin;
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  sessions.set(t, Date.now() + SESSION_MS);
  return true;
}

// ログイン試行の簡易制限
const attempts = new Map();
function tooMany(key, limit, windowMs) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  return list.length > limit;
}

// ---------- HTTPユーティリティ ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};
function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}
function json(res, status, obj, extra = {}) {
  send(res, status, JSON.stringify(obj), MIME['.json'], { 'Cache-Control': 'no-store', ...extra });
}
function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
function serveStatic(res, baseDir, rel, cache = 'public, max-age=3600') {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir + path.sep)) return false;
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
  return true;
}
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

// ---------- フォーム受付 ----------
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateReservation(b, content) {
  const bikeNames = (content.bikes || []).map(x => x.name);
  const r = {
    start: str(b.start, 40), end: str(b.end, 40), bike: str(b.bike, 80), quantity: str(b.quantity, 20), accessory: str(b.accessory, 20),
    name: str(b.name, 100), kana: str(b.kana, 100), zip: str(b.zip, 10), pref: str(b.pref, 20), city: str(b.city, 100), street: str(b.street, 200),
    email: str(b.email, 200), phone: str(b.phone, 30),
    deliveryZip: str(b.deliveryZip, 10), deliveryPref: str(b.deliveryPref, 20), deliveryCity: str(b.deliveryCity, 100), deliveryStreet: str(b.deliveryStreet, 200),
    note: str(b.note, 2000)
  };
  const errors = {};
  const req = { start: '貸出日', end: '返却日', bike: '車種', quantity: '台数', accessory: '付属品', name: 'お名前', kana: 'フリガナ', zip: '郵便番号', pref: '都道府県', city: '市区町村', street: '番地', email: 'メールアドレス', phone: '携帯電話番号' };
  for (const [k, label] of Object.entries(req)) if (!r[k]) errors[k] = `${label}を入力してください`;
  if (r.bike && !bikeNames.includes(r.bike)) errors.bike = '車種を選択してください';
  if (r.email && !EMAIL_RE.test(r.email)) errors.email = 'メールアドレスの形式をご確認ください';
  if (r.email && str(b.emailConfirm, 200) !== r.email) errors.emailConfirm = 'メールアドレスが一致しません';
  if (r.zip && !/^\d{3}-?\d{4}$/.test(r.zip)) errors.zip = '郵便番号は7桁の数字で入力してください';
  if (r.phone && !/^[0-9\-]{10,14}$/.test(r.phone)) errors.phone = '電話番号の形式をご確認ください';
  if (r.start && r.end && r.end < r.start) errors.end = '返却日は貸出日以降を指定してください';
  if (b.agree !== true) errors.agree = '貸渡約款・個人情報保護方針への同意が必要です';
  return { r, errors };
}
function validateContact(b) {
  const r = { name: str(b.name, 100), email: str(b.email, 200), subject: str(b.subject, 200), message: str(b.message, 5000) };
  const errors = {};
  if (!r.name) errors.name = 'お名前を入力してください';
  if (!EMAIL_RE.test(r.email)) errors.email = 'メールアドレスの形式をご確認ください';
  if (!r.message) errors.message = 'お問い合わせ内容を入力してください';
  if (b.agree !== true) errors.agree = '内容確認のチェックを入れてください';
  return { r, errors };
}
function appendRecord(file, record) {
  const list = readJSON(file, []);
  list.unshift({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: '新規', memo: '', ...record });
  writeJSON(file, list);
}

// ---------- 旧URLのリダイレクト ----------
const LEGACY = {
  canopylist: 'canopy', canopy4st: 'canopy', canopy4stminicar: 'canopy', xlis: 'gyro-x', x4st: 'gyro-x', x4stminicar: 'gyro-x',
  uplist: 'gyro-up', up2st: 'gyro-up', up2stminicar: 'gyro-up', gearlist: 'gear', gear4st: 'gear', cub4st: 'cub',
  zoomer4st: 'zoomer', majesty2504st: 'majesty', trike: 'trike', bicycle: 'bicycle'
};

// ---------- ルーティング ----------
const PAGES = ['howto', 'price', 'service', 'faq', 'shop', 'contact', 'company', 'covenant', 'privacy', 'sitemap', 'reservation'];

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);

  // 静的ファイル
  if (/^\/(css|js|img|uploads)\//.test(p) && req.method === 'GET') {
    if (serveStatic(res, PUBLIC, p.slice(1))) return;
    return send(res, 404, 'Not Found', MIME['.txt']);
  }
  if (p === '/favicon.ico') return send(res, 204, '');

  // ---------- 公開API ----------
  if (p === '/api/reservation' && req.method === 'POST') {
    if (tooMany('r:' + clientIp(req), 10, 60 * 60 * 1000)) return json(res, 429, { error: '送信回数が多すぎます。しばらくしてからお試しください。' });
    const b = await readBody(req, 64 * 1024).catch(() => null);
    if (!b) return json(res, 400, { error: '送信内容を読み取れませんでした' });
    if (b.website) return json(res, 200, { ok: true }); // スパム対策（ハニーポット）
    const { r, errors } = validateReservation(b, getContent());
    if (Object.keys(errors).length) return json(res, 422, { errors });
    appendRecord('reservations.json', r);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/contact' && req.method === 'POST') {
    if (tooMany('c:' + clientIp(req), 10, 60 * 60 * 1000)) return json(res, 429, { error: '送信回数が多すぎます。しばらくしてからお試しください。' });
    const b = await readBody(req, 64 * 1024).catch(() => null);
    if (!b) return json(res, 400, { error: '送信内容を読み取れませんでした' });
    if (b.website) return json(res, 200, { ok: true });
    const { r, errors } = validateContact(b);
    if (Object.keys(errors).length) return json(res, 422, { errors });
    appendRecord('contacts.json', r);
    return json(res, 200, { ok: true });
  }

  // ---------- 管理画面 ----------
  if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (p === '/admin/') return serveStatic(res, ADMIN, 'index.html', 'no-cache') || send(res, 404, 'Not Found');
  if (p.startsWith('/admin/') && req.method === 'GET') {
    if (serveStatic(res, ADMIN, p.slice('/admin/'.length), 'no-cache')) return;
    return send(res, 404, 'Not Found', MIME['.txt']);
  }
  if (p.startsWith('/api/admin/')) return handleAdminApi(req, res, p.slice('/api/admin/'.length));

  // ---------- 公開ページ ----------
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', MIME['.txt']);
  const legacy = p.match(/^\/cartypeprice\/([^/]+)\/?$/);
  if (legacy && LEGACY[legacy[1]]) { res.writeHead(301, { Location: `/bikes/${LEGACY[legacy[1]]}/` }); return res.end(); }
  if (p === '/reservation/reservation/' || p === '/reservation/reservation') { res.writeHead(301, { Location: '/reservation/' }); return res.end(); }

  const content = getContent();
  if (p === '/' || p === '/index.html') return send(res, 200, views.home(content));
  const m = p.match(/^\/([a-z]+)\/?$/);
  if (m && PAGES.includes(m[1])) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    const query = Object.fromEntries(url.searchParams);
    return send(res, 200, views[m[1]](content, query));
  }
  const bm = p.match(/^\/bikes\/([a-z0-9-]+)\/?$/);
  if (bm) {
    const bike = (content.bikes || []).find(b => b.slug === bm[1]);
    if (bike) return send(res, 200, views.bike(content, bike));
  }
  return send(res, 404, views.notFound(content));
}

async function handleAdminApi(req, res, route) {
  if (route === 'login' && req.method === 'POST') {
    if (tooMany('login:' + clientIp(req), 8, 15 * 60 * 1000)) return json(res, 429, { error: 'ログイン試行が多すぎます。15分ほど待ってから再度お試しください。' });
    const b = await readBody(req, 4096).catch(() => ({}));
    if (!checkPassword(b.password)) return json(res, 401, { error: 'パスワードが違います' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_MS);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `atoz_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}` });
  }
  if (route === 'logout' && req.method === 'POST') {
    const t = parseCookies(req).atoz_admin;
    if (t) sessions.delete(t);
    return json(res, 200, { ok: true }, { 'Set-Cookie': 'atoz_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (!isAuthed(req)) return json(res, 401, { error: 'ログインしてください' });
  // 書き込み系はCSRF対策として独自ヘッダー必須
  if (req.method !== 'GET' && req.headers['x-admin-request'] !== '1') return json(res, 403, { error: 'forbidden' });

  if (route === 'session' && req.method === 'GET') {
    const a = readJSON('admin.json', {});
    return json(res, 200, { ok: true, initialPassword: !!a.initial });
  }
  if (route === 'content' && req.method === 'GET') return json(res, 200, getContent());
  if (route === 'content' && req.method === 'PUT') {
    const b = await readBody(req, 2 * 1024 * 1024).catch(() => null);
    if (!b || typeof b !== 'object' || !b.site || !Array.isArray(b.bikes)) return json(res, 400, { error: 'データ形式が正しくありません' });
    const slugs = new Set();
    for (const bike of b.bikes) {
      if (!/^[a-z0-9-]+$/.test(bike.slug || '')) return json(res, 400, { error: `車種「${bike.name || '(無名)'}」のURL名は半角英小文字・数字・ハイフンで入力してください` });
      if (slugs.has(bike.slug)) return json(res, 400, { error: `URL名「${bike.slug}」が重複しています` });
      slugs.add(bike.slug);
    }
    // 変更前をバックアップ（直近20件）
    const bdir = path.join(DATA, 'backups');
    fs.mkdirSync(bdir, { recursive: true });
    fs.copyFileSync(path.join(DATA, 'content.json'), path.join(bdir, `content-${Date.now()}.json`));
    fs.readdirSync(bdir).sort().reverse().slice(20).forEach(f => fs.unlinkSync(path.join(bdir, f)));
    writeJSON('content.json', b);
    return json(res, 200, { ok: true });
  }
  if (route === 'upload' && req.method === 'POST') {
    const b = await readBody(req, 12 * 1024 * 1024).catch(() => null);
    const m = b && typeof b.data === 'string' && b.data.match(/^data:image\/(jpeg|png|webp|gif);base64,(.+)$/);
    if (!m) return json(res, 400, { error: '画像ファイル（JPG / PNG / WebP / GIF）を選択してください' });
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return json(res, 400, { error: '画像は8MB以下にしてください' });
    fs.mkdirSync(UPLOADS, { recursive: true });
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return json(res, 200, { url: `/uploads/${name}` });
  }
  const listMatch = route.match(/^(reservations|contacts)(?:\/([0-9a-f-]+))?$/);
  if (listMatch) {
    const file = `${listMatch[1]}.json`;
    const list = readJSON(file, []);
    if (!listMatch[2] && req.method === 'GET') return json(res, 200, list);
    const idx = list.findIndex(x => x.id === listMatch[2]);
    if (idx < 0) return json(res, 404, { error: '見つかりません' });
    if (req.method === 'PATCH') {
      const b = await readBody(req, 16 * 1024).catch(() => ({}));
      if (['新規', '対応中', '完了'].includes(b.status)) list[idx].status = b.status;
      if (typeof b.memo === 'string') list[idx].memo = b.memo.slice(0, 2000);
      writeJSON(file, list);
      return json(res, 200, list[idx]);
    }
    if (req.method === 'DELETE') {
      list.splice(idx, 1);
      writeJSON(file, list);
      return json(res, 200, { ok: true });
    }
  }
  if (route === 'password' && req.method === 'POST') {
    const b = await readBody(req, 4096).catch(() => ({}));
    if (!checkPassword(b.current)) return json(res, 400, { error: '現在のパスワードが違います' });
    if (typeof b.next !== 'string' || b.next.length < 8) return json(res, 400, { error: '新しいパスワードは8文字以上にしてください' });
    const salt = crypto.randomBytes(16).toString('hex');
    writeJSON('admin.json', { salt, hash: hashPassword(b.next, salt), initial: false });
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'not found' });
}

ensureAdmin();
http.createServer((req, res) => {
  handle(req, res).catch(err => {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Internal Server Error', MIME['.txt']);
  });
}).listen(PORT, () => console.log(`ビジネスバイクGOGO: http://localhost:${PORT}  管理画面: http://localhost:${PORT}/admin/`));

// ล็อกอินแผงผู้ดูแล — สำหรับเปิดให้เข้าจากอินเทอร์เน็ต (อุโมงค์ Cloudflare) หรือเครื่องอื่นในวง Wi-Fi
// - เครื่องนี้เอง (localhost ตรงๆ ไม่ผ่านอุโมงค์) → ไม่ต้องล็อกอิน เหมือนเดิม
// - ที่อื่น → ดูหน้าเกมได้ แต่แผงผู้ดูแล/คำสั่ง/ข้อมูลผู้ชม ต้องล็อกอินด้วย adminPassword ใน config.json
const crypto = require('crypto');
const { config } = require('../config/index');

const COOKIE = 'mtb_admin';
const MAX_AGE = 30 * 24 * 3600;           // จำการล็อกอิน 30 วัน
const sessions = new Map();               // token → หมดอายุเมื่อไหร่ (รีสตาร์ทเซิร์ฟเวอร์ = ต้องล็อกอินใหม่)
const fails = new Map();                  // IP → { n, until } กันเดารหัสผ่าน

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
// มาจากอุโมงค์/พร็อกซี (Cloudflare ใส่ header พวกนี้) → ไม่นับว่าเป็นเครื่องนี้ แม้จะต่อมาจาก 127.0.0.1
function viaProxy(req) { const h = req.headers; return !!(h['cf-connecting-ip'] || h['cf-ray'] || h['x-forwarded-for'] || h['x-forwarded-host'] || h['forwarded']); }
function isLocal(req) { return LOOPBACK.has(req.socket.remoteAddress) && !viaProxy(req); }
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function isHttps(req) { return req.headers['x-forwarded-proto'] === 'https' || /"scheme":"https"/.test(req.headers['cf-visitor'] || ''); }

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function loggedIn(req) {
  const t = cookies(req)[COOKIE];
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
// มีสิทธิ์ผู้ดูแลไหม
function isAdmin(req) { return isLocal(req) || loggedIn(req); }

// เทียบรหัสผ่านแบบเวลาคงที่ (กันเดาจากเวลาตอบ)
function samePassword(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest(), hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
// ล็อกอิน: คืน { ok, msg } และตั้งคุกกี้ให้ถ้าถูก
function login(req, res, password) {
  const ip = clientIp(req), now = Date.now();
  const f = fails.get(ip) || { n: 0, until: 0 };
  if (f.until > now) return { ok: false, status: 429, msg: `ใส่รหัสผิดหลายครั้ง — รออีก ${Math.ceil((f.until - now) / 60000)} นาที` };
  const want = String(config.adminPassword || '');
  if (want.length < 8) return { ok: false, status: 403, msg: 'ยังไม่ได้ตั้งรหัสผ่าน (adminPassword ใน config.json อย่างน้อย 8 ตัว) — ล็อกอินจากที่อื่นไม่ได้' };
  if (!samePassword(password, want)) {
    f.n++; if (f.n >= 8) { f.until = now + 10 * 60000; f.n = 0; }
    fails.set(ip, f);
    console.warn(`🔒 ล็อกอินแผงผู้ดูแลผิดจาก ${ip}`);
    return { ok: false, status: 401, msg: 'รหัสผ่านไม่ถูกต้อง' };
  }
  fails.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, now + MAX_AGE * 1000);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isHttps(req) ? '; Secure' : ''}`);
  console.log(`🔓 ล็อกอินแผงผู้ดูแลจาก ${ip}`);
  return { ok: true, status: 200, msg: 'ล็อกอินแล้ว' };
}
function logout(req, res) {
  const t = cookies(req)[COOKIE];
  if (t) sessions.delete(t);
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

module.exports = { isLocal, isAdmin, login, logout, clientIp };

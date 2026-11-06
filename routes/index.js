// Routes: ที่อยู่ (URL) → controller
// รูปแบบ 'METHOD /path' · ไม่ตรงกับอันไหน → ส่งไฟล์หน้าเว็บจาก views/
//
// สิทธิ์ (ตอนเข้าจากที่อื่น เช่น ลิงก์ public ผ่านอุโมงค์ / มือถือในวง Wi-Fi):
//   PUBLIC     ทุกคนเข้าได้ (หน้าเกมต้องใช้)
//   GAME_WRITE หน้าเกมส่งมา — ผู้ดูแลเท่านั้นที่มีผล คนอื่นตอบ "ไม่มีผล" (หน้าเกมของผู้ชมยังเล่นต่อได้)
//   อื่นๆ      ผู้ดูแลเท่านั้น (ล็อกอิน) · เครื่องที่รันเกมเอง (localhost) ไม่ต้องล็อกอิน
const live = require('../controllers/liveController');
const gift = require('../controllers/giftController');
const race = require('../controllers/raceController');
const admin = require('../controllers/adminController');
const stats = require('../controllers/statsController');
const eventlog = require('../controllers/eventlogController');
const authCtl = require('../controllers/authController');
const tts = require('../controllers/ttsController');
const page = require('../controllers/pageController');
const auth = require('../lib/auth');
const { json, text } = require('../lib/http');

const ROUTES = {
  // ล็อกอิน
  'POST /login': authCtl.login,
  'POST /logout': authCtl.logout,
  'GET /whoami': authCtl.whoami,
  // ไลฟ์ + การตั้งค่า
  'GET /events': live.events,
  'GET /events/poll': live.poll,
  'POST /connect': live.connect,
  'POST /disconnect': live.disconnect,
  'GET /config': live.publicConfig,
  // ของขวัญ
  'GET /gifts': gift.list,
  'GET /test': gift.test,
  // โหมดแข่งผู้ติดตาม
  'GET /race': race.state,
  'POST /race/finish': race.finish,
  'POST /race/follow': race.testFollow,
  'POST /race/restart': race.restart,
  'POST /race/minutes': race.setMinutes,
  'POST /race/clear': race.clear,
  'GET /race/history': race.history,
  'POST /test/event': race.testEvent,
  // แผงผู้ดูแล
  'POST /admin/cmd': admin.command,
  'POST /admin/state': admin.postState,
  'GET /admin/state': admin.getState,
  // สถิติ
  'GET /db/status': stats.dbStatus,
  'GET /db/top': stats.top,
  'GET /followers/recent': stats.followers,
  'GET /sys/stats': stats.sys,
  // log เหตุการณ์ TikTok
  'GET /eventlog/recent': eventlog.recent,
  'GET /eventlog/download': eventlog.download,
  'POST /eventlog/clear': eventlog.clear,
  // เสียงพูดภาษาไทยออนไลน์ (ผู้ประกาศ เมื่อเครื่องไม่มีเสียงไทย)
  'GET /tts': tts.speak,
};
const PUBLIC = new Set(['POST /login', 'POST /logout', 'GET /whoami', 'GET /events', 'GET /events/poll','GET /config', 'GET /gifts', 'GET /race', 'GET /race/history', 'GET /tts']);
const GAME_WRITE = new Set(['POST /race/finish', 'POST /admin/state']);
// หน้าเว็บของผู้ดูแล → ยังไม่ล็อกอินแสดงหน้าล็อกอินแทน
const ADMIN_PAGES = new Set(['/admin', '/monitor', '/followers', '/eventlog', '/monitor.html', '/followers.html', '/eventlog.html']);

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let urlPath;
  try { urlPath = decodeURIComponent(url.pathname); } catch (e) { return text(res, 'Bad request', 400); }
  const key = `${req.method === 'HEAD' ? 'GET' : req.method} ${urlPath}`;
  const fn = ROUTES[key];
  if (fn) {
    if (!PUBLIC.has(key) && !auth.isAdmin(req)) {
      if (GAME_WRITE.has(key)) return json(res, { ok: false, viewer: true });   // หน้าเกมของผู้ชมทั่วไป: ไม่มีผลกับเซิร์ฟเวอร์
      return json(res, { ok: false, login: true, msg: 'ต้องล็อกอินแผงผู้ดูแลก่อน' }, { status: 401 });
    }
    Promise.resolve(fn(req, res, url)).catch(e => {
      console.warn(`⚠️  ${req.method} ${urlPath}: ${e.message}`);
      if (!res.headersSent) text(res, 'Server error', 500);
    });
    return;
  }
  if (ADMIN_PAGES.has(urlPath.replace(/\/+$/, '') || '/') && !auth.isAdmin(req)) return page.serve(req, res, url, '/login.html');
  page.serve(req, res, url, urlPath);
}

module.exports = { handle, ROUTES };

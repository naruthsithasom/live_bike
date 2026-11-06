// Routes: ที่อยู่ (URL) → controller
// รูปแบบ 'METHOD /path' · ไม่ตรงกับอันไหน → ส่งไฟล์หน้าเว็บจาก views/
const live = require('../controllers/liveController');
const gift = require('../controllers/giftController');
const race = require('../controllers/raceController');
const admin = require('../controllers/adminController');
const stats = require('../controllers/statsController');
const eventlog = require('../controllers/eventlogController');
const page = require('../controllers/pageController');
const { text } = require('../lib/http');

const ROUTES = {
  // ไลฟ์ + การตั้งค่า
  'GET /events': live.events,
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
};

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let urlPath;
  try { urlPath = decodeURIComponent(url.pathname); } catch (e) { return text(res, 'Bad request', 400); }
  const fn = ROUTES[`${req.method} ${urlPath}`] || (req.method === 'HEAD' && ROUTES[`GET ${urlPath}`]);
  if (fn) {
    Promise.resolve(fn(req, res, url)).catch(e => {
      console.warn(`⚠️  ${req.method} ${urlPath}: ${e.message}`);
      if (!res.headersSent) text(res, 'Server error', 500);
    });
    return;
  }
  page.serve(req, res, url, urlPath);
}

module.exports = { handle, ROUTES };

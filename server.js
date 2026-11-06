// MTB Endless Ride — เซิร์ฟเวอร์เกม + สะพาน TikTok LIVE
//
// รัน:  npm start                 (ไม่เชื่อม TikTok ใช้ปุ่มทดสอบ/ลิงก์ /test)
//       npm start -- @username     (เชื่อม TikTok Live ของ @username)
//       หรือใส่ "tiktokUsername" ใน config.json
//
// โครงสร้างแบบ MVC
//   config/       การตั้งค่า (config.json)
//   models/       ข้อมูล: ตารางฐานข้อมูล (Sequelize), สถานะไลฟ์/การแข่ง, log
//   controllers/  การทำงานแต่ละส่วน: TikTok, ของขวัญ, การแข่ง, แผงผู้ดูแล, สถิติ
//   routes/       ที่อยู่ URL → controller
//   views/        หน้าเว็บ + ตัวเกม (เปิดในเบราว์เซอร์)
//   lib/          ตัวช่วยที่ใช้ร่วมกัน (ส่งข่าวสด SSE, HTTP)
const http = require('http');
const os = require('os');
const { config } = require('./config/index');
const db = require('./models/index');
const stage = require('./models/stage');
const viewer = require('./models/viewer');
const raceModel = require('./models/race');
const evlog = require('./models/eventlog');
const perf = require('./models/perf');
const tiktok = require('./controllers/tiktokController');
const { broadcast } = require('./lib/hub');
const { cleanUsername } = require('./lib/tiktokUser');
const routes = require('./routes');

const PORT = process.env.PORT || 3000;

evlog.configure(config.eventLog);
// แก้ config.json ระหว่างรัน → ใช้ค่าใหม่ทันที
config.onReload(c => { broadcast({ type: 'config' }); db.init(c.db, c.dbRemote); evlog.configure(c.eventLog); });

// ปิดโปรแกรม → ปิดตัววัดเครื่อง + ส่งข้อมูลที่ค้างขึ้นโฮสต์ก่อน
process.on('exit', perf.stopSampler);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    perf.stopSampler();
    Promise.race([db.close(), new Promise(r => setTimeout(r, 3000))]).finally(() => process.exit(0));
  });
}

const server = http.createServer(routes.handle);
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ พอร์ต ${PORT} ถูกใช้อยู่แล้ว — ปิดโปรแกรมเดิมก่อน หรือรันด้วยพอร์ตอื่น เช่น  $env:PORT=4000; npm start\n`);
    process.exit(1);
  }
  throw err;
});

// เชื่อมฐานข้อมูล (ในเครื่อง + โฮสต์) แล้วโหลดเลขด่านล่าสุด + ทีมที่ผู้ชมเคยเลือกไว้ (จำข้ามไลฟ์)
db.init(config.db, config.dbRemote).then(() => stage.lastNo()).then(n => {
  if (n >= raceModel.race.stageNo) raceModel.race.stageNo = n + 1;
  return viewer.loadTeams();
}).then(rows => {
  for (const r of rows) if (r.team >= 0 && r.team < raceModel.CHARS.length && !raceModel.teams.has(r.unique_id)) raceModel.teams.set(r.unique_id, r.team);
  if (rows.length) console.log(`🗄️  โหลดทีมผู้ชมจากฐานข้อมูล ${rows.length} คน`);
});

const argUser = process.argv.slice(2).find(a => !a.startsWith('-'));
const username = cleanUsername(argUser || process.env.TIKTOK_USERNAME || config.tiktokUsername || '');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚵 MTB Endless Ride พร้อมแล้ว`);
  console.log(`   เครื่องนี้:   http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`   มือถือ (Wi-Fi เดียวกัน): http://${n.address}:${PORT}`);
  }
  console.log(`   ทดสอบของขวัญ: http://localhost:${PORT}/test?action=jump`);
  if (username) { console.log(`   TikTok Live: @${username}\n`); tiktok.start(username); }
  else console.log('   TikTok Live: ยังไม่ได้ตั้งค่า (npm start -- @username หรือแก้ config.json)\n');
});

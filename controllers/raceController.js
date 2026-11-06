// Controller: โหมดแข่งผู้ติดตาม (ด่าน ผลด่าน รายชื่อ) + ปุ่มทดสอบเหตุการณ์
const { config } = require('../config/index');
const { broadcast } = require('../lib/hub');
const { json, readJson } = require('../lib/http');
const raceModel = require('../models/race');
const stage = require('../models/stage');
const live = require('../models/live');
const db = require('../models/index');
const evlog = require('../models/eventlog');

// GET /race — สถานะด่าน + รายชื่อนักปั่นผู้ติดตาม
function state(req, res) { json(res, raceModel.state()); }

// POST /race/finish {stageNo, results, rtype} — หน้าเกมส่งผลตอนจบด่าน
function finish(req, res) {
  readJson(req, j => {
    const r = raceModel.race;
    if ((j.stageNo | 0) !== r.stageNo) return json(res, { ok: false, stage: raceModel.stageInfo() });   // อีกจอส่งไปแล้ว
    const results = Array.isArray(j.results) ? j.results : [];
    stage.save({ stageNo: r.stageNo, startedAt: r.startedAt, streamer: live.username || config.tiktokUsername || '', results, rtype: String(j.rtype || '').slice(0, 12) });
    console.log(`🏁 จบด่าน ${r.stageNo}: ` + results.slice(0, 3).map(x => `${x.rank}. ${x.name}`).join('  '));
    raceModel.newStage();
    json(res, { ok: true, stage: raceModel.stageInfo() });
  });
}

// POST /race/follow — ปุ่มทดสอบ: จำลองคนกดติดตาม
function testFollow(req, res) {
  readJson(req, j => {
    const nick = String(j.nickname || '').slice(0, 40) || 'ผู้ติดตาม' + Math.floor(Math.random() * 1000);
    const uid = 'test_' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    raceModel.addFollower({ uniqueId: uid, nickname: nick, avatar: String(j.avatar || '') }, true, !!j.already);
    json(res, { ok: true, uniqueId: uid });
  });
}

// POST /race/restart — เริ่มด่านเดิมใหม่ (ไม่บันทึกผล)
function restart(req, res) {
  raceModel.restartStage();
  console.log(`🔄 เริ่มด่าน ${raceModel.race.stageNo} ใหม่`);
  json(res, { ok: true, stage: raceModel.stageInfo() });
}

// POST /race/clear — ล้างรายชื่อผู้ติดตามในสนาม
function clear(req, res) { raceModel.clearRoster(); json(res, { ok: true }); }

// GET /race/history?limit= — อันดับ 1-3 ของแต่ละรอบล่าสุด
async function history(req, res, url) {
  const rows = await stage.history(parseInt(url.searchParams.get('limit'), 10) || 10);
  json(res, { ok: db.state.ok, stages: rows });
}

// POST /test/event — ปุ่มทดสอบ: จำลองเคาะจอ / เข้าห้อง / แชท โดยไม่ต้องไลฟ์
function testEvent(req, res) {
  readJson(req, j => {
    const type = ['like', 'join', 'chat'].includes(j.type) ? j.type : 'like';
    const uid = String(j.uniqueId || '').slice(0, 64);
    const f = uid && raceModel.race.roster.get(uid);
    const nick = String(j.nickname || (f && f.nickname) || 'ทดสอบ').slice(0, 40), cnt = Math.max(1, Math.min(200, j.count | 0 || 1));
    broadcast({ type, uniqueId: uid, nickname: nick, avatar: (f && f.avatar) || '',
      count: cnt, text: String(j.text || '').slice(0, 120), donor: !!j.donor, follower: !!f, test: true });
    evlog.add(type === 'join' ? 'member' : type, { user: { uniqueId: uid, nickname: nick }, likeCount: cnt, comment: j.text || '' }, { test: true });
    json(res, '{"ok":true}');
  });
}

module.exports = { state, finish, testFollow, restart, clear, history, testEvent };

// Controller: สถิติ — ฐานข้อมูล, Top ผู้ส่งเพชร, ผู้ติดตามล่าสุด, ประสิทธิภาพเครื่อง
const { json } = require('../lib/http');
const db = require('../models/index');
const viewer = require('../models/viewer');
const gift = require('../models/gift');
const raceModel = require('../models/race');
const perf = require('../models/perf');

// GET /db/status — สถานะฐานข้อมูลทั้ง 2 ที่ + การซิงก์ + จำนวนข้อมูล
async function dbStatus(req, res) {
  const [viewers, totals] = await Promise.all([viewer.count(), gift.totals()]);
  const ok = db.state.ok && viewers !== undefined && totals !== undefined;
  json(res, { ok, ...(ok ? { viewers, gifts: totals.gifts, diamonds: totals.diamonds } : { error: db.state.error }), db: db.info() });
}

// GET /db/top?minutes=10&limit=3 — Top ผู้ส่งเพชรในช่วง N นาทีล่าสุด
async function top(req, res, url) {
  const minutes = parseInt(url.searchParams.get('minutes'), 10) || 10;
  const limit = parseInt(url.searchParams.get('limit'), 10) || 3;
  const rows = await gift.topGifters({ minutes, limit, includeTest: url.searchParams.get('test') === '1' });
  json(res, { ok: db.state.ok, minutes, top: rows });
}

// GET /followers/recent?limit= — ผู้ติดตามล่าสุด (ไลฟ์นี้ + ประวัติ)
async function followers(req, res, url) {
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit'), 10) || 10, 300));
  json(res, await raceModel.followersList(limit));
}

// GET /sys/stats — หน้า /monitor
function sys(req, res) { json(res, perf.stats()); }

module.exports = { dbStatus, top, followers, sys };

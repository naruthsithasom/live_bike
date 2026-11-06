// Model: การแข่ง (ด่าน, รายชื่อนักปั่นผู้ติดตาม, ทีมที่ผู้ชมเชียร์, ประเภทของขวัญ)
const { config } = require('../config/index');
const { broadcast } = require('../lib/hub');
const live = require('./live');
const viewer = require('./viewer');
const { viewerOf, isFollowerUser } = require('../lib/tiktokUser');
const db = require('./index');

// ตัวละครโหมดจำลอง: 0 = ผู้เล่น (คุณ), 1-5 = คู่แข่ง — ผู้ชมพิมพ์เลข 1-6 ในแชทเพื่อเลือกเชียร์
const CHARS = ['คุณ', 'สมชาย', 'มานี', 'ปิติ', 'ชูใจ', 'วีระ'];
const teams = new Map();   // uniqueId -> char index
function parseTeam(text) {
  const t = String(text || '').trim().replace(/^[!#]/, '');
  if (/^[1-6]$/.test(t)) return parseInt(t, 10) - 1;
  const i = CHARS.findIndex(n => t === n || t === '!' + n);
  if (i >= 0) return i;
  if (t === 'ผู้เล่น' || t.toLowerCase() === 'me') return 0;
  return -1;
}

// ประเภทของขวัญ: self = ช่วยตัวเอง, help = ให้คนอื่น, prank = แกล้งคนอื่น, scene = เปลี่ยนฉาก, mood = เปลี่ยนบรรยากาศ
const RACE_CATS = ['self', 'help', 'prank', 'scene', 'mood'];
const CAT_TH = { self: 'ช่วยตัวเอง', help: 'ให้คนอื่น', prank: 'แกล้งคนอื่น', scene: 'เปลี่ยนฉาก', mood: 'เปลี่ยนบรรยากาศ' };
const DEFAULT_RACE_TIERS = [{ min: 1, cat: 'self' }, { min: 5, cat: 'help' }, { min: 20, cat: 'prank' }, { min: 99, cat: 'mood' }, { min: 299, cat: 'scene' }];
function tiers() { const t = config.raceGifts && config.raceGifts.tiers; return Array.isArray(t) && t.length ? t : DEFAULT_RACE_TIERS; }
function category(name, diamonds) {
  const byName = (config.raceGifts && config.raceGifts.byName) || {};
  const hit = Object.entries(byName).find(([k]) => k.toLowerCase() === String(name || '').toLowerCase());
  if (hit && RACE_CATS.includes(hit[1])) return hit[1];
  const t = tiers().slice().sort((a, b) => b.min - a.min).find(x => (diamonds || 0) >= x.min);
  return t && RACE_CATS.includes(t.cat) ? t.cat : 'self';
}

const race = { stageNo: 1, startedAt: Date.now(), roster: new Map() };
const recentFollows = [];   // ผู้ติดตามล่าสุดในไลฟ์นี้ (ใหม่สุดก่อน)
const donors = new Set();   // คนที่ส่งของขวัญในไลฟ์นี้ → แชทของคนนี้แสดงบนจอ

function stageMs() { return Math.max(1, Number(config.stageMinutes) || 60) * 60000; }
function stageInfo() { return { no: race.stageNo, startedAt: race.startedAt, durationMs: stageMs(), serverNow: Date.now() }; }
function newStage() { race.stageNo++; race.startedAt = Date.now(); for (const f of race.roster.values()) f.diamonds = 0; broadcast({ type: 'stage', stage: stageInfo() }); }
// เริ่มด่านเดิมใหม่ (ไม่บันทึกผล ไม่ขึ้นด่านใหม่) · รายชื่อผู้ติดตามยังอยู่
function restartStage() { race.startedAt = Date.now(); for (const f of race.roster.values()) f.diamonds = 0; broadcast({ type: 'stage', stage: stageInfo() }); }
function state() {
  // ไม่มีหน้าเกมเปิดอยู่ตอนหมดเวลา (เลยไปเกิน 5 นาที) → เริ่มด่านใหม่เลย
  if (Date.now() - race.startedAt > stageMs() + 5 * 60000) newStage();
  return {
    stage: stageInfo(), maxRiders: config.maxRiders || 30,
    owner: { username: live.username || config.tiktokUsername || '', nickname: live.ownerNick || '', avatar: live.ownerAvatar || '' },
    roster: [...race.roster.values()],
    tiers: tiers(), byName: (config.raceGifts && config.raceGifts.byName) || {},
  };
}

// already = เป็นผู้ติดตามอยู่แล้ว (เห็นจากแชท/ไลก์/เข้าห้อง/ของขวัญ) → เข้าร่วมแข่งเลย ไม่ต้องกดติดตามใหม่
function addFollower({ uniqueId, nickname, avatar }, isTest, already) {
  if (!uniqueId) return;
  const ex = race.roster.get(uniqueId);
  if (ex) { if (avatar && !ex.avatar) ex.avatar = avatar; return; }
  if (race.roster.size >= 500) race.roster.delete(race.roster.keys().next().value);
  const f = { uniqueId, nickname: nickname || uniqueId, avatar: avatar || '', diamonds: 0, joinedAt: Date.now(), test: !!isTest, already: !!already };
  race.roster.set(uniqueId, f);
  recentFollows.unshift({ uniqueId, nickname: f.nickname, avatar: f.avatar, at: f.joinedAt, already: !!already, test: !!isTest, live: true });
  if (recentFollows.length > 300) recentFollows.length = 300;
  if (!isTest) viewer.markFollow({ uniqueId, nickname, avatar });
  broadcast({ type: 'follow', ...f });
  console.log(`🚴 ${f.nickname} ${already ? 'ติดตามอยู่แล้ว → เข้าร่วมแข่งเลย' : 'กดติดตาม → เพิ่มนักปั่น'} (${race.roster.size} คน)`);
}
// ผู้ชมที่ติดตามอยู่แล้ว (TikTok บอกมากับเหตุการณ์) → เข้าร่วมแข่งเลย
function joinIfFollower(data) {
  const u = (data && data.user) || {};
  if (!u.uniqueId) return false;
  if (isFollowerUser(u) || (data.userIdentity && data.userIdentity.isFollowerOfAnchor)) { addFollower(viewerOf(u), false, true); return true; }
  return false;
}
function clearRoster() { race.roster.clear(); broadcast({ type: 'roster' }); }

// ผู้ติดตามล่าสุด: ไลฟ์นี้ (หน่วยความจำ) + ประวัติในฐานข้อมูล
async function followersList(limit) {
  const d = await viewer.recentFollowers(Math.max(limit, 100));
  const seen = new Set(), out = [];
  for (const f of recentFollows) if (!seen.has(f.uniqueId)) { seen.add(f.uniqueId); out.push(f); }
  for (const r of d.rows || []) if (!seen.has(r.uniqueId)) { seen.add(r.uniqueId); out.push({ ...r, live: false }); }
  out.sort((a, b) => (b.at || 0) - (a.at || 0));
  for (const f of out) { const ro = race.roster.get(f.uniqueId); f.inRace = !!ro; if (ro) { f.diamondsNow = ro.diamonds; if (!f.avatar) f.avatar = ro.avatar; } }
  return { ok: db.state.ok, total: Math.max(d.total || 0, out.length), session: recentFollows.length, roster: race.roster.size, list: out.slice(0, limit) };
}

module.exports = {
  CHARS, teams, parseTeam, RACE_CATS, CAT_TH, tiers, category,
  race, donors, stageInfo, newStage, restartStage, state, addFollower, joinIfFollower, clearRoster, followersList,
};

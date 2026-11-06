// Controller: ของขวัญ — รับของขวัญ (จาก TikTok หรือปุ่มทดสอบ) → ส่งให้หน้าเกม + บันทึกฐานข้อมูล
const { config } = require('../config/index');
const { broadcast, clients } = require('../lib/hub');
const { json, text } = require('../lib/http');
const catalog = require('../models/giftCatalog');
const raceModel = require('../models/race');
const gift = require('../models/gift');
const live = require('../models/live');
const evlog = require('../models/eventlog');

function handleGift({ user, giftName, count, diamonds, action, target, image, uniqueId, avatar, isTest, category }) {
  action = catalog.ACTIONS.includes(action) ? action : catalog.actionFor(giftName, diamonds);
  target = Number.isInteger(target) && target >= 0 && target < raceModel.CHARS.length ? target : 0;
  const n = Math.max(1, Math.min(count || 1, config.maxRepeatPerGift || 10));
  if (!image) image = catalog.imageOf(giftName);
  category = raceModel.RACE_CATS.includes(category) ? category : raceModel.category(giftName, diamonds);
  const f = uniqueId && raceModel.race.roster.get(uniqueId);
  if (uniqueId && !isTest) raceModel.donors.add(uniqueId);
  if (f) { f.diamonds += (diamonds || 0) * (count || 1); if (avatar && !f.avatar) f.avatar = avatar; }
  broadcast({ type: 'gift', user, uniqueId: uniqueId || '', avatar: avatar || '', giftName, count: count || 1, diamonds, action, repeat: n, target, image: image || '', category, follower: !!f });
  gift.log({ uniqueId, nickname: user, avatar, giftName, count: count || 1, diamonds, action, target, streamer: live.username, isTest });
  console.log(`🎁 ${user} ส่ง ${giftName} x${count || 1} (${diamonds}💎) → โหมดแข่ง: ${raceModel.CAT_TH[category]}${f ? '' : ' (ยังไม่กดติดตาม)'} · โหมดจำลอง: ${raceModel.CHARS[target]} ${action}`);
}

// GET /gifts — รายการของขวัญ + ท่าที่สั่ง
function list(req, res) { json(res, { chars: raceModel.CHARS, gifts: catalog.list() }); }

// GET /test — ทดสอบโดยไม่ต้องมี TikTok:  /test?action=jump&user=ทดสอบ  หรือ /test?gift=Rose&count=3&target=2
function test(req, res, url) {
  const p = url.searchParams;
  const giftName = p.get('gift') || 'ทดสอบ';
  const action = p.get('action') || '';
  const target = parseInt(p.get('target'), 10);
  const testUser = p.get('user') || 'ทดสอบ';
  const uid = p.get('uid') || 'test:' + testUser.slice(0, 50);
  const tCount = parseInt(p.get('count'), 10) || 1, tDm = parseInt(p.get('diamonds'), 10) || 1;
  handleGift({ user: testUser, uniqueId: uid, avatar: p.get('avatar') || '', isTest: true, category: p.get('category') || '', giftName, count: tCount, diamonds: tDm, action, target: Number.isNaN(target) ? 0 : target, image: p.get('image') || '' });
  evlog.add('gift', { user: { uniqueId: uid, nickname: testUser }, repeatCount: tCount, repeatEnd: true, giftDetails: { giftName, diamondCount: tDm } }, { test: true });
  text(res, `ส่งแล้ว: ${action || giftName} → ${clients.size} หน้าจอ`);
}

module.exports = { handleGift, list, test };

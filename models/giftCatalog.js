// Model: รายการของขวัญ (ชื่อ ราคา รูป) + ของขวัญชิ้นไหนสั่งท่าอะไร
const { config } = require('../config/index');
const { broadcast } = require('../lib/hub');

const ACTIONS = ['jump', 'tuck', 'wheelie', 'drift', 'crash', 'throw', 'prank', 'turbo', 'space'];
// รายการของขวัญสำรอง (ใช้เมื่อดึงจาก TikTok ไม่ได้)
const DEFAULT_GIFTS = [
  { name: 'Rose', diamonds: 1, emoji: '🌹' }, { name: 'TikTok', diamonds: 1, emoji: '🎵' },
  { name: 'GG', diamonds: 1, emoji: '🎮' }, { name: 'Ice Cream Cone', diamonds: 1, emoji: '🍦' },
  { name: 'Heart Me', diamonds: 1, emoji: '💗' }, { name: 'Finger Heart', diamonds: 5, emoji: '🫰' },
  { name: 'Perfume', diamonds: 20, emoji: '🧴' }, { name: 'Doughnut', diamonds: 30, emoji: '🍩' },
  { name: 'Cap', diamonds: 99, emoji: '🧢' }, { name: 'Hand Hearts', diamonds: 100, emoji: '🫶' },
  { name: 'Corgi', diamonds: 299, emoji: '🐶' }, { name: 'Money Gun', diamonds: 500, emoji: '💸' }, { name: 'Galaxy', diamonds: 1000, emoji: '🌌' },
];
const store = { list: null };   // [{name, diamonds, image}] จาก TikTok

// ใส่รายการจาก TikTok (ต้องมีแพ็กเกจ EulerStream แบบเสียเงิน)
function setFromTikTok(arr) { store.list = arr.slice(0, 60); broadcast({ type: 'gifts' }); }
// จำของขวัญจากที่ผู้ชมส่งจริง (ชื่อ + ราคา + รูป) ใช้แทนรายการจาก TikTok ตอนดึงไม่ได้
function learn(name, diamonds, image) {
  if (!name) return;
  if (!store.list || !store.list.length) store.list = DEFAULT_GIFTS.map(g => ({ ...g }));
  const g = store.list.find(x => x.name.toLowerCase() === String(name).toLowerCase());
  if (g) { if (image && !g.image) { g.image = image; broadcast({ type: 'gifts' }); } return; }
  store.list.push({ name, diamonds: diamonds || 1, image: image || '' });
  store.list.sort((a, b) => a.diamonds - b.diamonds);
  if (store.list.length > 80) store.list.length = 80;
  broadcast({ type: 'gifts' });
}
function imageOf(name) { const g = store.list && store.list.find(x => x.name === name); return g ? g.image : ''; }
// ท่าของโหมดจำลอง: ตามชื่อใน config.giftActions ก่อน ไม่มีค่อยดูตามราคา (diamondTiers)
function actionFor(name, diamonds) {
  const byName = Object.entries(config.giftActions || {}).find(([k]) => k.toLowerCase() === String(name || '').toLowerCase());
  if (byName && ACTIONS.includes(byName[1])) return byName[1];
  const tiers = (config.diamondTiers || []).slice().sort((a, b) => b.min - a.min);
  const t = tiers.find(x => diamonds >= x.min);
  return t ? t.action : 'jump';
}
function list() {
  const l = store.list && store.list.length ? store.list : DEFAULT_GIFTS;
  return l.map(g => ({ ...g, action: actionFor(g.name, g.diamonds) }));
}

module.exports = { ACTIONS, DEFAULT_GIFTS, setFromTikTok, learn, imageOf, actionFor, list };

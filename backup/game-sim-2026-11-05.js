/* =====================================================================
   MTB Endless Ride — ปั่นจักรยานเสือภูเขาไม่มีที่สิ้นสุด (มุมมอง POV)
   Canvas 2D pseudo-3D, จอแนวตั้ง 9:16 สำหรับมือถือ
   ===================================================================== */
'use strict';
(() => {

// ---------------------------------------------------------------- setup
const W = 540, H = 960;
const cv = document.getElementById('game');
let ctx = cv.getContext('2d');
let RES = 1;

function resize() {
  const adminW = document.body && document.body.classList && document.body.classList.contains('admin-open') && window.innerWidth > 760 ? 380 : 0;
  const vw = window.innerWidth - adminW, vh = window.innerHeight;
  let w, h;
  if (vw / vh > 9 / 16) { h = vh; w = vh * 9 / 16; } else { w = vw; h = vw * 16 / 9; }
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const wrap = document.getElementById('wrap');
  if (wrap && wrap !== cv && wrap.style) { wrap.style.width = w + 'px'; wrap.style.height = h + 'px'; }
  RES = clamp((window.devicePixelRatio || 1) * w / W, 0.6, 2);
  cv.width = Math.round(W * RES);
  cv.height = Math.round(H * RES);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- utils
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function hash(n) {
  n |= 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function hash2(i, s) { return hash((Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263) + 1013904223) | 0); }
function noise1(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgb(c, a) {
  return a === undefined
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}
function pickWeighted(map, r) {
  let total = 0;
  for (const k in map) total += map[k];
  let x = r * total;
  for (const k in map) { x -= map[k]; if (x <= 0) return k; }
  return Object.keys(map)[0];
}
function sampleKeys(keys, h) {
  for (let k = 0; k < keys.length - 1; k++) {
    const [h0, v0] = keys[k], [h1, v1] = keys[k + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / ((h1 - h0) || 1);
      return Array.isArray(v0) ? mix(v0, v1, t) : lerp(v0, v1, t);
    }
  }
  return keys[0][1];
}
function font(size, weight = 600) { ctx.font = `${weight} ${size}px Kanit, "Noto Sans Thai", Tahoma, sans-serif`; }
function rrPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rr(x, y, w, h, r, fill, stroke, lw) {
  rrPath(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function ell(x, y, rx, ry, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}
function poly(pts, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
function textC(str, x, y, col, size, weight, shadow) {
  font(size, weight);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(str, x + 2, y + 2); }
  ctx.fillStyle = col;
  ctx.fillText(str, x, y);
}
function fmtMS(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const emojiCache = {};
function emo(ch) {
  if (!emojiCache[ch]) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 64, 72);
    emojiCache[ch] = c;
  }
  return emojiCache[ch];
}
function drawEmo(ch, x, y, size) { if (size > 1) ctx.drawImage(emo(ch), x - size / 2, y - size, size, size); }

// ------------------------------------------------------------ constants
const SEG_L = 200;                 // ความยาว segment (หน่วยโลก)
const ROAD_W = 800;                // ครึ่งความกว้างเส้นทาง
const CAM_H = 650;                 // ความสูงสายตาผู้ปั่น
const CAM_D = 1 / Math.tan(50 * Math.PI / 180);
const DRAW = 220;                  // ระยะมองเห็น (segment)
const PLAYER_Z = CAM_H * CAM_D;    // ระยะล้อหน้าจากกล้อง
let MIR = 1;                     // 1 = มองไปข้างหน้า, -1 = กล้องหันหลัง
let HORIZON = H * 0.42;          // เปลี่ยนตามมุมกล้อง
const MAX_SPEED = SEG_L * 25;      // ความเร็วทางราบเมื่อปั่นแรงสุด 100% = 35 km/h (จักรยานเสือภูเขาจริง)
const TOP_SPEED = MAX_SPEED * 2;   // สูงสุด (ลงเขาชัน + บูสต์) = 70 km/h
const ACCEL = MAX_SPEED / 4.5;
const BRAKE = MAX_SPEED * 0.9;
const DECEL = MAX_SPEED / 9;
const GRAV = MAX_SPEED * 1.6;
const KMH = 70 / TOP_SPEED;   // สเกลสมจริง: สายตาผู้ปั่นสูง ~1.3 ม. ทางกว้าง ~3 ม.
const M_PER_SEG = MAX_SPEED * KMH / 3.6 / (MAX_SPEED / SEG_L);   // เมตรต่อ segment
const SCENE_MS = 5 * 60 * 1000;    // เปลี่ยนฉากทุก 5 นาที
const WEATHER_MS = 5 * 60 * 1000;  // เปลี่ยนอากาศทุก 5 นาที
const DIFF_MS = 2 * 60 * 1000;     // เปลี่ยนความยากทุก 2 นาที

// --------------------------------------------------------------- scenes
const SCENES = {
  mountain: {
    name: 'ภูเขา', icon: '⛰️', hill: 0.9, curve: 1.0,
    road: [[156, 118, 80], [146, 108, 72]], rumble: [[120, 112, 100], [96, 90, 82]],
    grass: [[98, 138, 62], [88, 126, 55]], lane: null, rut: [130, 96, 64], rumbleW: 0.12,
    deco: ['pine', 'pine', 'pine', 'rock', 'boulder', 'sign'], density: 0.16, spread: 3.5,
    obst: ['rock', 'rock', 'mud', 'log', 'ramp', 'puddle', 'boost', 'stream', 'roots'], map: '#a1887f', bg: 'mountain',
    ww: { rain: 2, cold: 3, snow: 2.2, hot: 1, dry: 1 },
  },
  sea: {
    name: 'ทะเล', icon: '🌊', hill: 0.25, curve: 0.8,
    road: [[222, 198, 150], [212, 188, 140]], rumble: [[245, 240, 225], [235, 228, 210]],
    grass: [[238, 218, 168], [230, 208, 158]], lane: null, rut: [200, 176, 128], rumbleW: 0.08, sea: true,
    deco: ['palm', 'palm', 'umbrella', 'palm', 'rock'], density: 0.14, spread: 3,
    obst: ['sand', 'sand', 'puddle', 'rock', 'ramp', 'boost'], map: '#4fc3f7', bg: 'sea',
    ww: { rain: 2.5, cold: 0.6, snow: 0.25, hot: 4, dry: 2 },
  },
  forest: {
    name: 'ป่า', icon: '🌲', hill: 0.65, curve: 1.2,
    road: [[118, 86, 56], [108, 78, 50]], rumble: [[70, 95, 45], [60, 85, 40]],
    grass: [[42, 102, 44], [36, 92, 38]], lane: null, rut: [95, 68, 44], rumbleW: 0.15,
    deco: ['pine', 'tree', 'tree', 'bush', 'pine', 'tree'], density: 0.42, spread: 4,
    obst: ['log', 'log', 'mud', 'rock', 'puddle', 'ramp', 'boost', 'roots', 'roots', 'stream'], map: '#66bb6a', bg: 'forest',
    ww: { rain: 4, cold: 2, snow: 1, hot: 1, dry: 1 },
  },
  road: {
    name: 'ถนน', icon: '🛣️', hill: 0.6, curve: 0.7,
    road: [[108, 108, 112], [100, 100, 104]], rumble: [[230, 230, 230], [200, 50, 50]],
    grass: [[120, 170, 72], [110, 158, 66]], lane: [245, 245, 245], rumbleW: 0.07,
    deco: ['tree', 'pole', 'fence', 'house', 'bush', 'tree'], density: 0.14, spread: 4,
    obst: ['pothole', 'cone', 'puddle', 'boost', 'pothole', 'ramp', 'bump', 'bump'], map: '#bdbdbd', bg: 'road',
    ww: { rain: 2, cold: 1, snow: 0.4, hot: 3, dry: 3 },
  },
  city: {
    name: 'ในเมือง', icon: '🏙️', hill: 0.3, curve: 0.5,
    road: [[72, 72, 78], [66, 66, 72]], rumble: [[175, 175, 180], [160, 160, 165]],
    grass: [[140, 140, 146], [132, 132, 138]], lane: [250, 210, 60], rumbleW: 0.3, city: true,
    deco: ['building', 'lamp', 'tree'], density: 0, spread: 1,
    obst: ['cone', 'pothole', 'barrier', 'boost', 'puddle', 'cone', 'bump'], map: '#ffb74d', bg: 'city',
    ww: { rain: 3, cold: 1, snow: 0.4, hot: 3, dry: 2 },
  },
};
// ฉากเพิ่มเติม (รวมทั้งหมด 15 ฉากบนพื้นโลก + 5 ฉากผจญภัยอวกาศ = 20 ฉาก)
Object.assign(SCENES, {
  cliff: {
    name: 'ทางเลียบเหว', icon: '🏔️', hill: 0.85, curve: 1.3,
    road: [[150, 130, 110], [140, 120, 100]], rumble: [[110, 105, 100], [90, 86, 82]],
    grass: [[110, 120, 90], [100, 110, 82]], lane: null, rut: [125, 108, 90], rumbleW: 0.1, abyss: true,
    deco: ['rock', 'boulder', 'pine', 'sign'], density: 0.14, spread: 2,
    obst: ['rock', 'rock', 'log', 'ramp', 'roots', 'boost'], map: '#78909c', bg: 'mountain',
    ww: { rain: 2, cold: 3, snow: 2, hot: 1, dry: 1 },
  },
  village: {
    name: 'หมู่บ้าน', icon: '🏡', hill: 0.35, curve: 0.9,
    road: [[170, 140, 100], [160, 130, 92]], rumble: [[130, 150, 80], [120, 140, 74]],
    grass: [[110, 165, 70], [100, 152, 64]], lane: null, rut: [145, 118, 84], rumbleW: 0.1,
    deco: ['house', 'house', 'fence', 'tree', 'pole', 'person', 'bush'], density: 0.24, spread: 2.5,
    obst: ['puddle', 'mud', 'cone', 'bump', 'boost', 'ramp'], map: '#ffcc80', bg: 'road',
    ww: { rain: 3, cold: 1, snow: 0.3, hot: 3, dry: 2 },
  },
  footpath: {
    name: 'ทางเดินเท้า', icon: '🚶', hill: 0.35, curve: 1.1,
    road: [[190, 185, 175], [178, 173, 163]], rumble: [[120, 160, 80], [110, 150, 72]],
    grass: [[100, 160, 70], [92, 150, 64]], lane: null, rut: [168, 162, 150], rumbleW: 0.18,
    deco: ['bush', 'lamp', 'bench', 'tree', 'flower', 'person'], density: 0.22, spread: 2,
    obst: ['puddle', 'cone', 'bump', 'roots', 'boost'], map: '#e0e0e0', bg: 'road',
    ww: { rain: 3, cold: 1, snow: 0.5, hot: 2, dry: 2 },
  },
  garden: {
    name: 'ในสวน', icon: '🌷', hill: 0.3, curve: 1.2,
    road: [[200, 180, 140], [190, 170, 130]], rumble: [[60, 140, 60], [54, 130, 54]],
    grass: [[80, 170, 80], [72, 160, 72]], lane: null, rut: [178, 158, 120], rumbleW: 0.14,
    deco: ['flower', 'flower', 'bush', 'tree', 'fountain', 'bench', 'flower'], density: 0.36, spread: 2.5,
    obst: ['puddle', 'roots', 'mud', 'boost', 'ramp'], map: '#f48fb1', bg: 'forest',
    ww: { rain: 3, cold: 1, snow: 0.4, hot: 2, dry: 1 },
  },
  desert: {
    name: 'ทะเลทราย', icon: '🏜️', hill: 0.5, curve: 0.7,
    road: [[214, 180, 120], [204, 170, 112]], rumble: [[200, 160, 100], [190, 150, 92]],
    grass: [[232, 202, 142], [224, 194, 134]], lane: null, rut: [196, 162, 104], rumbleW: 0.08,
    deco: ['cactus', 'cactus', 'rock', 'dune'], density: 0.1, spread: 4,
    obst: ['sand', 'sand', 'rock', 'ramp', 'boost'], map: '#ffe082', bg: 'desert',
    ww: { rain: 0.3, cold: 0.5, snow: 0.1, hot: 5, dry: 4 },
  },
  snowland: {
    name: 'ภูเขาหิมะ', icon: '🗻', hill: 0.9, curve: 1.1,
    road: [[200, 205, 215], [190, 195, 205]], rumble: [[160, 170, 185], [150, 160, 175]],
    grass: [[235, 240, 248], [225, 232, 242]], lane: null, rut: [175, 182, 195], rumbleW: 0.1,
    deco: ['snowpine', 'snowpine', 'rock', 'snowpine'], density: 0.2, spread: 3.5,
    obst: ['ice', 'ice', 'rock', 'log', 'ramp', 'boost'], map: '#e3f2fd', bg: 'snow',
    ww: { rain: 0.3, cold: 4, snow: 5, hot: 0.1, dry: 0.5 },
  },
  ricefield: {
    name: 'ทุ่งนา', icon: '🌾', hill: 0.2, curve: 0.8,
    road: [[160, 130, 90], [150, 120, 84]], rumble: [[90, 150, 50], [84, 140, 46]],
    grass: [[120, 190, 60], [105, 175, 52]], lane: null, rut: [138, 110, 76], rumbleW: 0.1,
    deco: ['hut', 'scarecrow', 'palm', 'tree', 'person'], density: 0.1, spread: 4,
    obst: ['mud', 'puddle', 'stream', 'boost', 'ramp'], map: '#aed581', bg: 'road',
    ww: { rain: 3, cold: 0.5, snow: 0.1, hot: 3, dry: 1.5 },
  },
  temple: {
    name: 'ทางผ่านวัด', icon: '🛕', hill: 0.25, curve: 0.8,
    road: [[200, 190, 170], [190, 180, 160]], rumble: [[230, 220, 200], [210, 200, 180]],
    grass: [[110, 160, 80], [100, 150, 72]], lane: null, rut: [180, 170, 150], rumbleW: 0.12,
    deco: ['temple', 'tree', 'lamp', 'tree'], density: 0.1, spread: 3,
    obst: ['cone', 'bump', 'puddle', 'boost'], map: '#ffb300', bg: 'road',
    ww: { rain: 2, cold: 1, snow: 0.2, hot: 3, dry: 2 },
  },
  bridge: {
    name: 'สะพานข้ามแม่น้ำ', icon: '🌉', hill: 0.15, curve: 0.4,
    road: [[150, 110, 70], [138, 100, 62]], rumble: [[200, 60, 50], [235, 235, 235]],
    grass: [[40, 110, 160], [36, 104, 152]], lane: null, rut: [128, 92, 58], rumbleW: 0.08, bridge: true,
    deco: ['lamp'], density: 0, spread: 1,
    obst: ['bump', 'puddle', 'boost', 'cone'], map: '#4dd0e1', bg: 'sea',
    ww: { rain: 3, cold: 1, snow: 0.3, hot: 2, dry: 1 },
  },
  canyon: {
    name: 'หุบเขาหินแดง', icon: '🪨', hill: 0.8, curve: 1.2,
    road: [[190, 120, 80], [178, 110, 72]], rumble: [[160, 90, 60], [150, 84, 56]],
    grass: [[205, 130, 85], [195, 122, 78]], lane: null, rut: [168, 100, 66], rumbleW: 0.1,
    deco: ['redrock', 'redrock', 'rock', 'cactus'], density: 0.14, spread: 3,
    obst: ['rock', 'rock', 'sand', 'ramp', 'boost', 'log'], map: '#ff8a65', bg: 'canyon',
    ww: { rain: 0.5, cold: 1, snow: 0.2, hot: 4, dry: 4 },
  },
});
Object.assign(SCENES, {
  velodrome: {
    name: 'สนามเวโลโดรม', icon: '🏟️', hill: 0.03, curve: 1, oval: true,
    road: [[196, 74, 64], [188, 68, 60]], rumble: [[60, 150, 205], [56, 142, 196]],
    grass: [[70, 150, 90], [64, 140, 84]], lane: [245, 245, 245], laneSolid: true, rumbleW: 0.22,
    deco: ['stand'], density: 0, spread: 1,
    obst: ['boost', 'cone', 'puddle', 'boost'], map: '#ef5350', bg: 'forest',
    ww: { rain: 1, cold: 1, snow: 0.2, hot: 3, dry: 2 },
  },
});
const SCENE_IDS = Object.keys(SCENES);

// -------------------------------------------------------------- weather
const WEATHERS = {
  rain: { name: 'ฝนตก', icon: '🌧️', t: [24, 27], fog: 4, maxMult: 0.92, grip: 0.6, waterDrain: 0.8, energyDrain: 1.0, tip: 'ถนนลื่น ระวังโค้ง!' },
  cold: { name: 'หนาว', icon: '🥶', t: [8, 14], fog: 3, maxMult: 0.96, grip: 0.9, waterDrain: 0.6, energyDrain: 1.5, tip: 'หนาว เหนื่อยเร็วขึ้น' },
  snow: { name: 'หิมะตก', icon: '❄️', t: [-4, 1], fog: 6, maxMult: 0.82, grip: 0.45, waterDrain: 0.5, energyDrain: 1.6, tip: 'หิมะ! ช้าลงและลื่นมาก' },
  hot: { name: 'ร้อนจัด', icon: '☀️', t: [36, 41], fog: 1.5, maxMult: 0.95, grip: 1.0, waterDrain: 2.3, energyDrain: 1.25, tip: 'ร้อน! น้ำหมดเร็ว' },
  dry: { name: 'แห้งแล้ง', icon: '🏜️', t: [30, 34], fog: 2.5, maxMult: 1.0, grip: 0.85, waterDrain: 1.6, energyDrain: 1.1, tip: 'อากาศแห้ง ฝุ่นเยอะ' },
};

// ------------------------------------------------------------ difficulty
const DIFFS = [
  { name: 'ง่าย', color: '#66bb6a', obst: 0.012, item: 0.015 },
  { name: 'ปานกลาง', color: '#ffca28', obst: 0.022, item: 0.012 },
  { name: 'ยาก', color: '#ff7043', obst: 0.034, item: 0.010 },
  { name: 'โหดมาก', color: '#e53935', obst: 0.05, item: 0.009 },
];

// ------------------------------------------------------------ obstacles
// bad: true = ทำให้ช้า, false = ทำให้เร็ว
const OB = {
  banana:  { emoji: '🍌', icon: '🍌', name: 'เปลือกกล้วย', w: 0.18, size: 220, bad: true, fx: 'slip', mult: 0.8, dur: 1.6, label: 'เหยียบเปลือกกล้วย!' },
  nails:   { emoji: '📌', icon: '📌', name: 'ตะปู', w: 0.24, size: 190, bad: true, fx: 'hit', keep: 0.55, dmg: 6, label: 'โดนตะปู ยางรั่ว!' },
  oil:     { draw: 'oil', icon: '🛢️', name: 'คราบน้ำมัน', w: 0.32, bad: true, fx: 'slip', mult: 0.8, dur: 2, label: 'ลื่นคราบน้ำมัน!' },
  rock:    { emoji: '🪨', w: 0.2, size: 330, bad: true, fx: 'hit', keep: 0.35, dmg: 10, label: 'ชนหิน!' },
  log:     { emoji: '🪵', w: 0.38, size: 300, bad: true, fx: 'hit', keep: 0.45, dmg: 6, label: 'สะดุดขอนไม้!' },
  barrier: { emoji: '🚧', w: 0.28, size: 420, bad: true, fx: 'hit', keep: 0.3, dmg: 10, label: 'ชนแผงกั้น!' },
  cone:    { draw: 'cone', w: 0.14, bad: true, fx: 'hit', keep: 0.6, dmg: 3, label: 'ชนกรวย!' },
  pothole: { draw: 'hole', w: 0.24, bad: true, fx: 'hit', keep: 0.5, dmg: 8, label: 'ตกหลุม!' },
  mud:     { draw: 'mud', w: 0.36, bad: true, fx: 'slow', mult: 0.55, dur: 2.0, label: 'ติดโคลน! ช้าลง' },
  puddle:  { draw: 'puddle', w: 0.34, bad: true, fx: 'slow', mult: 0.75, dur: 1.2, label: 'ลุยแอ่งน้ำ!', splash: true },
  sand:    { draw: 'sand', w: 0.4, bad: true, fx: 'slow', mult: 0.6, dur: 1.8, label: 'ทรายลึก! ช้าลง' },
  ice:     { draw: 'ice', w: 0.4, bad: true, fx: 'slip', mult: 0.85, dur: 2.0, label: 'ลื่นน้ำแข็ง!' },
  ramp:    { draw: 'ramp', w: 0.3, bad: false, fx: 'boost', mult: 1.35, dur: 2.5, jump: true, label: 'กระโดด! เร่งความเร็ว' },
  boost:   { draw: 'arrows', w: 0.3, bad: false, fx: 'boost', mult: 1.3, dur: 2.2, label: 'ทางเร่ง! เร็วขึ้น ⚡' },
  bump:    { draw: 'bump', w: 0.95, bad: true, fx: 'hit', keep: 0.7, dmg: 2, label: 'ลูกระนาด! สะเทือน' },
  stream:  { draw: 'stream', w: 0.95, bad: true, fx: 'slow', mult: 0.5, dur: 2.2, label: 'ลุยลำธาร! ช้าลง', splash: true },
  roots:   { draw: 'roots', w: 0.5, bad: true, fx: 'hit', keep: 0.6, dmg: 4, label: 'สะดุดรากไม้!' },
  kicker:  { draw: 'kicker', w: 0.98, bad: false, fx: 'air', label: 'ลอยข้ามโนนดิน!' },   // ปากโนนดินในทางวิบาก
};
const WEATHER_OBST = { rain: ['puddle', 'mud', 'stream'], snow: ['ice', 'ice'], cold: ['ice'], dry: ['sand'], hot: [] };

// ---------------------------------------------------------------- items
const ITEM_W = { gift: 3, water: 3, food: 3, med: 1.5, tent: 0.7 };
const FOODS = ['🍌', '🍙', '🍞', '🍎'];
const GIFTS = [
  { good: true, key: 'turbo', icon: '🚀', label: 'เทอร์โบ! เร็วขึ้นมาก', dur: 6, maxMult: 1.45, accel: 1.8 },
  { good: true, key: 'refill', icon: '✨', label: 'พลังเต็มหลอด!', instant: true },
  { good: true, key: 'shield', icon: '🛡️', label: 'โล่กันอุปสรรค!', dur: 12, shield: true },
  { good: true, key: 'legs', icon: '🦵', label: 'ขาเหล็ก! ไม่เหนื่อย', dur: 12, noDrain: true, accel: 1.3, maxMult: 1.1 },
  { good: false, key: 'flat', icon: '🛞', label: 'ยางแบน! ช้าลง', dur: 6, maxMult: 0.6 },
  { good: false, key: 'heavy', icon: '🎒', label: 'กระเป๋าหนัก! ออกตัวช้า', dur: 8, accel: 0.5, maxMult: 0.85 },
  { good: false, key: 'dizzy', icon: '😵', label: 'มึนงง! รถส่ายไปมา', dur: 5, reverse: true },
  { good: false, key: 'chain', icon: '⛓️', label: 'โซ่หลุด! ช้าลงชั่วคราว', dur: 2.5, maxMult: 0.4, hitSpeed: 0.3 },
];

const RIVAL_DEFS = [
  { name: 'สมชาย', jersey: '#e53935', helmet: '#ffffff', shorts: '#222' },
  { name: 'มานี', jersey: '#8e24aa', helmet: '#ffd54f', shorts: '#333' },
  { name: 'ปิติ', jersey: '#1e88e5', helmet: '#212121', shorts: '#111' },
  { name: 'ชูใจ', jersey: '#fdd835', helmet: '#e53935', shorts: '#222' },
  { name: 'วีระ', jersey: '#43a047', helmet: '#ffffff', shorts: '#1a1a1a' },
];

// ---------------------------------------------------- time-of-day (UTC+7)
const SKY_TOP = [[0, [8, 10, 30]], [4.5, [10, 12, 35]], [5.5, [40, 40, 90]], [6.5, [90, 140, 210]], [8, [70, 150, 235]],
  [12, [50, 140, 240]], [16, [70, 145, 225]], [17.5, [90, 110, 190]], [18.5, [60, 50, 120]], [19.3, [25, 25, 70]],
  [20.5, [8, 10, 30]], [24, [8, 10, 30]]];
const SKY_BOT = [[0, [20, 25, 55]], [4.5, [30, 30, 60]], [5.5, [200, 120, 110]], [6.5, [255, 190, 140]], [8, [170, 215, 250]],
  [12, [160, 210, 255]], [16, [190, 215, 245]], [17.5, [255, 170, 100]], [18.5, [240, 110, 80]], [19.3, [80, 50, 90]],
  [20.5, [20, 25, 55]], [24, [20, 25, 55]]];
const DARK = [[0, 0.62], [5, 0.6], [6, 0.25], [7, 0], [17, 0], [18.3, 0.2], [19.3, 0.5], [20.5, 0.62], [24, 0.62]];
const WARM = [[0, 0], [5.3, 0], [6.3, 0.2], [7.5, 0], [16.8, 0], [18, 0.22], [19.2, 0], [24, 0]];

const params = new URLSearchParams(location.search);

// ------------------------------------------------------------- state
const S = {
  started: false, paused: false, countdown: 0,
  t: 0, gt: 0,
  position: 0, prevPZ: PLAYER_Z, playerX: 0, speed: 0, steerVel: 0, steerVis: 0,
  energy: 100, water: 100, health: 100,
  effects: [], sleepT: 0, jumpT: 0, shake: 0, hitFlash: 0, splashT: 0, boostFlash: 0,
  pedalPhase: 0, wheelRot: 0, auto: false, pedaling: false, slope: 0,
  pe: { effort: 55, effTarget: 55, effT: 2, tired: false }, stopT: 0, passT: 0, near: null,
  rivals: [], objects: [], nextSpawn: 0, lastSpawnSeg: -100,
  toasts: [], floaters: [], banner: null,
  rank: 6, prevRank: 6, leader: null, lastRankMsg: -10,
  hourOff: 0,
  sceneSlot: null, weatherSlot: null, diffSlot: null,
  wCur: 'hot', wPrev: 'hot', wT: 1, diff: 0,
  bgOff: 0, lightning: 0, lastScene: null,
  clouds: [], drops: [], flakes: [], dust: [], breath: [],
  jumpDur: 0.9, jumpH: 260,
  // ท่าพิเศษจากของขวัญ TikTok
  trick: null, trickQ: [], instQ: [], instT: 0,
  fx: { tuck: 0, wheelie: 0, drift: 0, crash: 0, dir: 1 },
  projectiles: [], skid: [],
  live: { status: 'off', username: '', likes: 0, server: false },
  liveCfg: null, gifters: {}, guideT: 0,
  support: [0, 0, 0, 0, 0, 0], teams: [0, 0, 0, 0, 0, 0],
  hype: 0, battleT: 0, lastBattleMsg: -99, cheatT: 6, delayed: [],
  comicFx: null, splatFx: null, giftPop: null, confetti: [],
  pack: [],
  musicOn: params.get('music') !== '0', voiceOn: params.get('voice') !== '0',
};

// ?hour=20.5 ใช้ทดสอบเวลา (เวลายังเดินต่อจากชั่วโมงที่กำหนด)
if (params.get('hour') !== null) {
  const d = new Date(Date.now() + 7 * 3600000);
  const realHf = d.getUTCHours() + d.getUTCMinutes() / 60;
  S.hourOff = ((parseFloat(params.get('hour')) || 0) - realHf + 48) % 24;
}
function thaiTime() {
  const ms = Date.now() + 7 * 3600000 + S.hourOff * 3600000;
  const d = new Date(ms);
  return { ms, h: d.getUTCHours(), m: d.getUTCMinutes(), hf: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 };
}

// -------------------------------------------------- time-slot randomness
function sceneRaw(slot) { return Math.floor(mulberry32(slot * 7919 + 13)() * SCENE_IDS.length); }
function sceneForSlot(slot) {
  let idx = sceneRaw(slot);
  if (idx === sceneRaw(slot - 1)) idx = (idx + 1 + Math.floor(mulberry32(slot * 31 + 7)() * (SCENE_IDS.length - 1))) % SCENE_IDS.length;
  return SCENE_IDS[idx];
}
function weatherForSlot(slot, sceneId) {
  const r = mulberry32(slot * 104729 + 3)();
  return pickWeighted(SCENES[sceneId].ww, r);
}
function diffForSlot(slot) {
  const r = mulberry32(slot * 15485863 + 11)();
  return r < 0.3 ? 0 : r < 0.65 ? 1 : r < 0.9 ? 2 : 3;
}

// ------------------------------------------------------- track sections
// ช่วงทาง: สลับกันไปเรื่อยๆ ตามความยาก (สุ่มตอนสร้างทางข้างหน้า)
//   ความกว้าง: แคบ / ปกติ / กว้าง
//   พื้นผิว:   ลื่น(โคลน) / มีน้ำ / หิมะ / หินดิน / ทราย
//   ระดับทาง: เรียบ / เนินสูง-ต่ำ / ลาดขึ้น / ลาดลง / โค้ง / เลียบเหว / ทางน้ำ
// น้ำหนักสุ่ม w = [ง่าย, ปานกลาง, ยาก, โหดมาก]
const TERRAINS = {
  flat:    { name: 'ทางเรียบ', icon: '🛤️', w: [3, 1.8, 1, 0.5] },
  rolling: { name: 'เนินสูง-ต่ำ', icon: '〰️', w: [1.5, 2.5, 3, 3] },
  climb:   { name: 'ทางลาดชันขึ้น', icon: '⛰️', w: [1.2, 2, 2.5, 3] },
  descent: { name: 'ทางลาดชันลง', icon: '🎢', w: [1.5, 2, 2.5, 3] },
  peak:    { name: 'ขึ้นสูงสุดแล้วดิ่งลง', icon: '🗻', w: [0.8, 1.5, 2, 2.5] },
  valley:  { name: 'ดิ่งลงต่ำแล้วไต่ขึ้น', icon: '🕳️', w: [0.8, 1.5, 2, 2.5] },
  curvy:   { name: 'ทางโค้งคดเคี้ยว', icon: '↪️', w: [1, 2, 2.5, 3] },
  cliff:   { name: 'ทางเลียบเหว', icon: '🏔️', w: [0.2, 0.8, 1.8, 2.5] },
  water:   { name: 'ทางน้ำ', icon: '🌊', w: [0.5, 1, 1.5, 2] },
  jumps:   { name: 'ทางวิบาก โนนดิน', icon: '🏍️', w: [1, 1.8, 2.5, 3] },
};
const SURFACES = {
  normal: { name: '', icon: '', w: [5, 3, 2, 1], grip: 1, speed: 1 },
  mud:    { name: 'ทางลื่น', icon: '🟤', w: [0.5, 1.2, 2, 2.5], grip: 0.5, speed: 0.85, col: [96, 70, 44], obst: ['mud', 'puddle'] },
  water:  { name: 'มีน้ำขัง', icon: '💧', w: [0.3, 0.7, 1, 1.4], grip: 0.7, speed: 0.75, col: [78, 138, 176], obst: ['puddle', 'stream'], splash: true },
  snow:   { name: 'หิมะ', icon: '❄️', w: [0.3, 0.8, 1.3, 1.8], grip: 0.45, speed: 0.8, col: [236, 241, 248], obst: ['ice', 'ice'] },
  rock:   { name: 'หินดิน', icon: '🪨', w: [0.8, 1.5, 2, 2.5], grip: 0.85, speed: 0.88, col: [128, 118, 106], obst: ['rock', 'roots'], shake: 0.22 },
  sand:   { name: 'ทราย', icon: '🏖️', w: [0.5, 1, 1.5, 2], grip: 0.7, speed: 0.7, col: [224, 198, 142], obst: ['sand', 'sand'] },
};
// จำนวนเลน 1-4 (m = ตัวคูณความกว้างทาง, n = จำนวนเลนที่ตีเส้นแบ่ง)
const WIDTHS = {
  l1: { name: 'ถนน 1 เลน', icon: '🛣️', n: 1, m: 0.45, w: [0.5, 1, 2, 3] },
  l2: { name: 'ถนน 2 เลน', icon: '🛣️', n: 2, m: 0.8, w: [3, 3, 2.5, 2] },
  l3: { name: 'ถนน 3 เลน', icon: '🛣️', n: 3, m: 1.15, w: [2.5, 2, 1.2, 0.8] },
  l4: { name: 'ถนน 4 เลน', icon: '🛣️', n: 4, m: 1.5, w: [2, 1.2, 0.6, 0.4] },
};
// ฉากที่เหมาะกับพื้นผิวแต่ละแบบ (ตัวคูณน้ำหนักสุ่ม)
const SURF_AFFINITY = {
  snowland: { snow: 4 }, desert: { sand: 4, snow: 0.1 }, sea: { sand: 3, water: 1.5, snow: 0.1 }, forest: { mud: 2 },
  ricefield: { mud: 2, water: 2 }, canyon: { rock: 3, sand: 1.5, snow: 0.2 }, mountain: { rock: 2 }, cliff: { rock: 2 },
};
const PAVED = { road: 1, city: 1, temple: 1, bridge: 1, footpath: 1, velodrome: 1 };
// ทดสอบ: ?terrain=cliff&surface=rock&width=narrow บังคับทุกช่วงทาง
const FORCE_SEC = {
  terrain: TERRAINS[params.get('terrain')] ? params.get('terrain') : null,
  surface: SURFACES[params.get('surface')] ? params.get('surface') : null,
  width: WIDTHS['l' + params.get('lanes')] ? 'l' + params.get('lanes') : null,   // ?lanes=1..4
};
const NEUTRAL_SEC = { from: -1e12, len: 2e12, terrain: 'flat', surface: 'normal', width: 'l3', wm: 1.15, flat: 1, cm: 1, amp: 0, per: 40, dy: 0, hill: 0, kicks: null, side: 0, prev: null };
const SECTIONS = [];
const ELEV = [0];   // ความสูงสะสม (คำนวณจากความชันทีละ segment → เปลี่ยนช่วงทางได้เนียน ไม่กระตุก)
let SEC_ID = 0;
// แอดมินล็อกค่า (null = สุ่มอัตโนมัติตามเวลา)
const LOCK = { scene: null, weather: null, diff: null };
// รูปแบบเส้นทาง: mix = ใช้ทั้งสอง, smooth = ทางเรียบ, offroad = ทางวิบาก · ตั้งด้วย ?track= ได้
const TRACK_MODES = { smooth: '🛤️ ทางเรียบ', offroad: '🏍️ ทางวิบาก', mix: '🔀 ใช้ทั้งสอง' };
let TRACK_MODE = TRACK_MODES[params.get('track')] ? params.get('track') : 'mix';
// ทางเรียบ: พื้นปกติ ไม่มีเนิน/โนน · ทางวิบาก: พื้นดินหินโคลน เน้นโนนดิน เนิน ทางชัน
const MODE_TERRAIN = {
  smooth: { rolling: 0, climb: 0, descent: 0, peak: 0, valley: 0, cliff: 0, water: 0, jumps: 0, flat: 3, curvy: 1 },
  offroad: { flat: 0, curvy: 0.4, jumps: 4, rolling: 1.6, peak: 1.2, valley: 1.2 },
};
const MODE_SURF = { smooth: { mud: 0, water: 0, snow: 0, rock: 0, sand: 0 }, offroad: { normal: 0 } };
// สร้างทางข้างหน้าใหม่ทันที (หลังเปลี่ยนโหมด/ความยาก/ฉาก) โดยไม่กระตุกใต้ล้อ
function resetTrackAhead() {
  if (!SECTIONS.length) return;
  const cut = playerSegIdx() + 60;
  let k = SECTIONS.length - 1;
  while (k > 0 && SECTIONS[k].from >= cut) k--;
  const cur = SECTIONS[k];
  if (cur.from + cur.len > cut) cur.len = Math.max(1, cut - cur.from);
  SECTIONS.length = k + 1;
  if (ELEV.length > cut + 1) ELEV.length = cut + 1;
  for (const key of segCache.keys()) if (key >= cut) segCache.delete(key);
  const cz = cut * SEG_L;
  S.objects = S.objects.filter(o => o.z < cz || o.taken || o.dropped);
  S.nextSpawn = Math.min(S.nextSpawn, cut);
  S.warnId = -1;
}

function wpick(defs, d, mod) {
  const w = {};
  for (const k in defs) w[k] = defs[k].w[d] * (mod && mod[k] != null ? mod[k] : 1);
  return pickWeighted(w, Math.random());
}
function makeSection(from, prev) {
  const d = clamp(S.diff | 0, 0, 3);
  const sid = sceneChanges.length ? sceneChanges[sceneIndexAt(from + 30)].id : 'mountain', sc = SCENES[sid];
  const id = ++SEC_ID;
  if (sc.oval) return Object.assign({}, NEUTRAL_SEC, { from, len: 300, prev, id });
  const elev = ELEV[Math.min(Math.max(from, 0), ELEV.length - 1)];
  const tm = {};
  if (prev) tm[prev.terrain] = 0.3;   // ไม่ซ้ำแบบเดิมติดกันบ่อย
  if (PAVED[sid]) { tm.cliff = 0.15; tm.water = 0.15; }
  if (sc.bridge) tm.cliff = 0;
  if (elev > 15000) { tm.climb = 0; tm.peak = 0; tm.descent = 3; tm.valley = 2; }   // ไม่ให้สูง/ต่ำเกินไปเรื่อยๆ
  if (elev < -15000) { tm.descent = 0; tm.valley = 0; tm.climb = 3; tm.peak = 2; }
  const mt = MODE_TERRAIN[TRACK_MODE];
  if (mt) for (const k in mt) tm[k] = mt[k] * (tm[k] == null ? 1 : tm[k]);
  const terrain = FORCE_SEC.terrain || wpick(TERRAINS, d, tm);
  const sm = Object.assign({}, SURF_AFFINITY[sid] || {});
  if (PAVED[sid]) { sm.mud = 0.3; sm.rock = 0.2; sm.sand = 0.3; sm.snow = 0.3; }
  if (sm.snow == null) sm.snow = S.wCur === 'snow' || S.wCur === 'cold' ? 3 : 0.5;
  if (S.wCur === 'rain') { sm.mud = (sm.mud || 1) * 2; sm.water = (sm.water || 1) * 2; }
  if (terrain === 'jumps') Object.assign(sm, { snow: 0, water: 0, sand: 0.3, rock: 3, mud: 1.5 });   // ทางวิบาก = ดินหิน
  if (MODE_SURF[TRACK_MODE]) Object.assign(sm, MODE_SURF[TRACK_MODE]);
  if (TRACK_MODE === 'smooth') sm.normal = 1;
  const surface = FORCE_SEC.surface || (terrain === 'water' ? 'water' : wpick(SURFACES, d, sm));
  const wmod = { l1: sc.city ? 0 : 1 };
  if (prev) wmod[prev.width] = (wmod[prev.width] ?? 1) * 0.3;   // สลับจำนวนเลนไปเรื่อยๆ
  const width = FORCE_SEC.width || (terrain === 'cliff' ? (d === 0 ? 'l2' : Math.random() < 0.6 ? 'l1' : 'l2')
    : terrain === 'water' ? pick(['l2', 'l3', 'l4']) : terrain === 'jumps' ? pick(['l2', 'l3']) : wpick(WIDTHS, d, wmod));
  const len = Math.round(160 + Math.random() * (160 + 40 * d) + (terrain === 'flat' ? 60 : 0) + (terrain === 'jumps' ? 120 : 0));
  const sec = { from, len, terrain, surface, width, wm: WIDTHS[width].m, flat: 1, cm: 1, amp: 0, per: 40, dy: 0, hill: 0, kicks: null, side: 0, prev, id };
  switch (terrain) {
    case 'flat': sec.flat = 0.1; sec.cm = 0.5; break;
    case 'rolling':   // โนนสูง-ต่ำติดกัน ชันสุด ~25-40%
      sec.flat = 0.3; sec.amp = 200 + 90 * d + Math.random() * 80; sec.per = 42 + Math.random() * 18; break;
    case 'climb': case 'descent': {
      const peak = 0.12 + 0.06 * d + Math.random() * 0.06;   // ความชันสูงสุดกลางช่วง 12-36%
      sec.flat = 0.25; sec.dy = (terrain === 'climb' ? 1 : -1) * peak * len * SEG_L / 1.5; break;
    }
    case 'peak': case 'valley': {
      // ขึ้นไปสูงมากแล้วดิ่งลง (หรือกลับกัน) ในช่วงเดียว ชันสุด ~20-40%
      const steep = 0.18 + 0.05 * d + Math.random() * 0.06;
      const hh = steep * len * SEG_L / Math.PI;
      sec.flat = 0.2; sec.cm = 0.7; sec.hill = terrain === 'peak' ? hh : -hh; break;
    }
    case 'curvy': sec.cm = 1.7 + 0.3 * d; sec.flat = 0.8; break;
    case 'cliff': sec.cm = 1.3; sec.flat = 0.7; sec.side = Math.random() < 0.5 ? -1 : 1; break;
    case 'water': sec.flat = 0.1; sec.cm = 0.6; break;
    case 'jumps': {
      // โนนดินเรียงจากเล็ก (ง่าย) ไปใหญ่ (ยาก) ยิ่งความยากสูง โนนท้ายๆ ยิ่งใหญ่และถี่
      sec.flat = 0.2; sec.cm = 0.5;
      const gap = 30 - 3 * d, first = 35, lastT = len - 35;
      const n = Math.max(3, Math.floor((lastT - first) / gap) + 1), big = 0.8 + 0.15 * d + (TRACK_MODE === 'offroad' ? 0.15 : 0);
      sec.kicks = [];
      for (let q = 0; q < n; q++) sec.kicks.push({ t: Math.round(first + q * (lastT - first) / (n - 1)), size: lerp(0.25, big, q / (n - 1)) });
      break;
    }
  }
  return sec;
}
// โนนดิน: ทางลาดขึ้น 14 segment แล้วปากโนนตกลง (ตรงปากโนน = จุดลอย)
const KICK_H = 820, KICK_RUN = 14;
function kickY(s, t) {
  if (!s.kicks) return 0;
  let y = 0;
  for (const kk of s.kicks) {
    const dt = t - kk.t;
    if (dt < -KICK_RUN || dt > 3) continue;
    const h = kk.size * KICK_H;
    y += dt <= 0 ? h * (1 + dt / KICK_RUN) : h * (1 - dt / 3);
  }
  return y;
}
function hillY(s, t) { return s.hill ? s.hill * Math.pow(Math.sin(Math.PI * clamp(t / s.len, 0, 1)), 2) : 0; }
function sectionAt(i) {
  if (i < 0) return NEUTRAL_SEC;
  if (!SECTIONS.length) SECTIONS.push(Object.assign({}, NEUTRAL_SEC, { from: 0, len: 200, id: 0 }));   // ช่วงออกตัว
  let last = SECTIONS[SECTIONS.length - 1];
  while (last.from + last.len <= i) { last = makeSection(last.from + last.len, last); SECTIONS.push(last); }
  let lo = 0, hi = SECTIONS.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SECTIONS[m].from <= i) lo = m; else hi = m - 1; }
  return SECTIONS[lo];
}
function secMix(i) {
  const s = sectionAt(i), p = s.prev || NEUTRAL_SEC, t = i - s.from;
  const b = smooth01(t / 40);
  return { s, t, flat: lerp(p.flat, s.flat, b), cm: lerp(p.cm, s.cm, b), wm: lerp(p.wm, s.wm, smooth01(t / 30)) };
}
function sectionLabel(s) {
  if (!s || s.id === undefined) return '';
  const parts = [`${TERRAINS[s.terrain].icon} ${TERRAINS[s.terrain].name}`];
  if (s.surface !== 'normal' && !(s.terrain === 'water' && s.surface === 'water')) parts.push(`${SURFACES[s.surface].icon} ${SURFACES[s.surface].name}`);
  if (WIDTHS[s.width]) parts.push(`${WIDTHS[s.width].icon} ${WIDTHS[s.width].name}`);
  return parts.join(' · ');
}
function surfAt(seg) { return SURFACES[seg.sb > 0.5 ? seg.surf : seg.psurf] || SURFACES.normal; }

// ------------------------------------------------------- track segments
const sceneChanges = [];
const segCache = new Map();
function sceneIndexAt(i) {
  for (let k = sceneChanges.length - 1; k >= 0; k--) if (i >= sceneChanges[k].from) return k;
  return 0;
}
function addSceneChange(id, from) {
  sceneChanges.push({ from, id });
  for (const key of segCache.keys()) if (key >= from) segCache.delete(key);
  if (from >= 0 && ELEV.length > from + 1) ELEV.length = from + 1;   // คำนวณความสูงต่อจากจุดเปลี่ยนฉากใหม่
}
function sceneAmp(i) {
  const k = sceneIndexAt(i), sc = SCENES[sceneChanges[k].id];
  let amp = sc.hill, camp = sc.curve;
  if (k > 0) {
    const prev = SCENES[sceneChanges[k - 1].id];
    const t = clamp((i - sceneChanges[k].from) / 200, 0, 1);
    amp = lerp(prev.hill, sc.hill, t);
    camp = lerp(prev.curve, sc.curve, t);
  }
  return { k, sc, amp, camp };
}
// เนินใหญ่ (ขึ้น-ลงเขายาว) + เนินกลาง + ถนนสูง-ต่ำเล็กๆ
function baseY(i) {
  return (noise1(i / 520, 7) - 0.5) * 2 * 7000
    + (noise1(i / 170, 91) - 0.5) * 2 * 1600
    + (noise1(i / 45, 13) - 0.5) * 2 * 220;
}
function moundY(s, t) {
  if (!s.amp) return 0;
  return s.amp * Math.sin(t / s.per * Math.PI * 2) * smooth01(t / 25) * smooth01((s.len - t) / 25);
}
function elevAt(i) {
  if (i <= 0) return (baseY(i) - baseY(0)) * sceneAmp(i).amp;
  while (ELEV.length <= i) {
    const j = ELEV.length - 1, m = secMix(j), s = m.s, t = m.t;
    let d = (baseY(j + 1) - baseY(j)) * sceneAmp(j).amp * m.flat;
    if (s.dy) d += s.dy * (smooth01((t + 1) / s.len) - smooth01(t / s.len));
    if (s.amp) d += moundY(s, t + 1) - moundY(s, t);
    if (s.hill) d += hillY(s, t + 1) - hillY(s, t);
    if (s.kicks) d += kickY(s, t + 1) - kickY(s, t);
    ELEV.push(ELEV[j] + d);
  }
  return ELEV[i];
}
function buildSeg(i) {
  const { k, sc, camp } = sceneAmp(i);
  const sid = sceneChanges[k].id;
  const m = secMix(i), sec = m.s;
  const y = elevAt(i);
  let c = (noise1(i / 90, 33) - 0.5) * 2;
  c = Math.sign(c) * Math.max(0, Math.abs(c) - 0.15) / 0.85;
  let curve = sc.oval ? Math.max(0, Math.sin(i * Math.PI * 2 / 320)) * 4.8 : c * 5.5 * camp * m.cm;
  if (sec.terrain === 'curvy') curve += (noise1(i / 38, 57) - 0.5) * 2 * 3.2 * smooth01(m.t / 30) * smooth01((sec.len - m.t) / 30);
  const cliff = sec.terrain === 'cliff' && m.t > 12 && m.t < sec.len - 12 ? sec.side : sc.abyss ? -1 : 0;
  const wet = sec.terrain === 'water' ? smooth01(m.t / 15) * smooth01((sec.len - m.t) / 15) : 0;

  const decos = [];
  if (sc.oval) {
    if (i % 7 === 0) decos.push({ type: 'stand', off: -(2.7 + hash2(i, 41) * 0.3), v: hash2(i, 42) });
    if (i % 7 === 3) decos.push({ type: 'stand', off: 2.7 + hash2(i, 43) * 0.3, v: hash2(i, 44) });
  } else if (sc.bridge) {
    if (i % 8 === 0) for (const side of [-1, 1]) decos.push({ type: 'lamp', off: side * 1.12, v: hash2(i, 30 + side) });
  } else if (sc.city) {
    if (i % 6 === 0) {
      for (const side of [-1, 1]) {
        const v = hash2(i, side > 0 ? 2 : 4);
        const bw = 1800 + v * 1600;
        decos.push({ type: 'building', off: side * (1.4 + bw / 2 / ROAD_W + hash2(i, 5 + side) * 0.2), v, bw, bh: 4000 + hash2(i, 9 + side) * 9000 });
      }
    } else if (i % 6 === 3 && hash2(i, 6) < 0.7) {
      decos.push({ type: hash2(i, 7) < 0.6 ? 'lamp' : 'tree', off: (hash2(i, 8) < 0.5 ? -1 : 1) * 1.22, v: hash2(i, 10) });
    }
  } else {
    for (const side of [-1, 1]) {
      if (cliff && side === cliff) continue;
      if (sc.sea && side < 0) {
        if (hash2(i, 21) < 0.05) decos.push({ type: hash2(i, 22) < 0.7 ? 'palm' : 'umbrella', off: -(1.25 + hash2(i, 23) * 0.9), v: hash2(i, 24) });
        continue;
      }
      if (hash2(i, side > 0 ? 11 : 12) < sc.density) {
        const t = sc.deco[Math.floor(hash2(i, side > 0 ? 13 : 14) * sc.deco.length)];
        decos.push({ type: t, off: side * (1.25 + hash2(i, side > 0 ? 15 : 16) * sc.spread), v: hash2(i, 17 + side) });
      }
    }
  }
  return {
    i, y, curve, sid, scene: sc, decos, stripe: ((Math.floor(i / 3) % 2) + 2) % 2, p1: {}, p2: {}, clip: H, fog: 1,
    sec, wm: m.wm, surf: sec.surface, psurf: (sec.prev || NEUTRAL_SEC).surface, sb: smooth01(m.t / 14), cliff, wet,
    lanes: WIDTHS[m.t > 15 ? sec.width : (sec.prev || NEUTRAL_SEC).width].n,
    kick: sec.kicks ? (sec.kicks.find(kk => kk.t === m.t) || null) : null,
  };
}
function getSeg(i) {
  let s = segCache.get(i);
  if (!s) { s = buildSeg(i); segCache.set(i, s); }
  return s;
}

// --------------------------------------------------- background layers
function periodic(seed, N, harm, sharp) {
  const r = mulberry32(seed), comps = [];
  for (let k = 1; k <= harm; k++) comps.push({ k: k + Math.floor(r() * 3), a: 1 / Math.pow(k, 0.9), p: r() * 6.283 });
  const arr = new Float32Array(N);
  let mn = 1e9, mx = -1e9;
  for (let j = 0; j < N; j++) {
    let v = 0;
    for (const c of comps) v += c.a * Math.sin(6.2832 * c.k * j / N + c.p);
    arr[j] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  for (let j = 0; j < N; j++) arr[j] = Math.pow((arr[j] - mn) / (mx - mn), sharp || 1);
  return arr;
}
function skyline(seed, N) {
  const r = mulberry32(seed), arr = new Float32Array(N), wins = [];
  let j = 0;
  while (j < N) {
    const bw = 4 + Math.floor(r() * 9), h = 0.25 + r() * 0.75;
    for (let q = 0; q < bw && j + q < N; q++) arr[j + q] = h;
    for (let wy = 0.08; wy < h - 0.05; wy += 0.07)
      for (let wx = 1; wx < bw - 1; wx += 2) if (r() < 0.55) wins.push({ j: j + wx, v: wy });
    j += bw + (r() < 0.3 ? 1 : 0);
  }
  return { arr, wins };
}
function makeLayers() {
  const N = 400, P = 1600;
  const jag = (a, seed) => { for (let j = 0; j < a.length; j++) a[j] = clamp(a[j] * 0.8 + hash2(j, seed) * 0.2, 0, 1); return a; };
  const isl = periodic(51, N, 6, 1);
  for (let j = 0; j < N; j++) isl[j] = Math.max(0, isl[j] - 0.62) / 0.38;
  const c1 = skyline(61, N), c2 = skyline(62, N);
  return {
    mountain: [
      { h: periodic(11, N, 7, 1.4), N, P, amp: 300, speed: 0.15, color: [105, 115, 140], haze: 0.55, cap: 0.7 },
      { h: periodic(12, N, 6, 1.1), N, P, amp: 170, speed: 0.35, color: [70, 95, 80], haze: 0.3 },
    ],
    sea: [{ h: isl, N, P, amp: 40, speed: 0.2, color: [80, 110, 115], haze: 0.5 }],
    forest: [
      { h: periodic(21, N, 5, 1), N, P, amp: 150, speed: 0.2, color: [70, 100, 95], haze: 0.5 },
      { h: jag(periodic(22, N, 4, 1), 5), N, P, amp: 80, speed: 0.45, color: [30, 70, 40], haze: 0.25 },
    ],
    road: [
      { h: periodic(31, N, 4, 1), N, P, amp: 110, speed: 0.2, color: [110, 140, 120], haze: 0.5 },
      { h: periodic(32, N, 3, 1), N, P, amp: 50, speed: 0.4, color: [95, 145, 80], haze: 0.3 },
    ],
    city: [
      { h: c1.arr, N, P, amp: 260, speed: 0.15, color: [120, 130, 150], haze: 0.5 },
      { h: c2.arr, wins: c2.wins, N, P, amp: 190, speed: 0.35, color: [75, 80, 98], haze: 0.25 },
    ],
  };
}
const LAYERS = makeLayers();
(() => {
  const N = 400, P = 1600;
  const mesa = periodic(81, N, 8, 0.6); for (let j = 0; j < N; j++) mesa[j] = Math.round(mesa[j] * 4) / 4;
  const mesa2 = periodic(82, N, 6, 0.8); for (let j = 0; j < N; j++) mesa2[j] = Math.round(mesa2[j] * 3) / 3;
  LAYERS.desert = [
    { h: periodic(71, N, 3, 1), N, P, amp: 70, speed: 0.15, color: [225, 190, 130], haze: 0.45 },
    { h: periodic(72, N, 4, 1), N, P, amp: 40, speed: 0.35, color: [215, 175, 115], haze: 0.25 },
  ];
  LAYERS.canyon = [
    { h: mesa, N, P, amp: 230, speed: 0.15, color: [175, 85, 55], haze: 0.45 },
    { h: mesa2, N, P, amp: 130, speed: 0.35, color: [150, 70, 45], haze: 0.25 },
  ];
  LAYERS.snow = [
    { h: periodic(91, N, 7, 1.4), N, P, amp: 330, speed: 0.15, color: [190, 200, 220], haze: 0.45, cap: 0.35 },
    { h: periodic(92, N, 6, 1.1), N, P, amp: 180, speed: 0.35, color: [170, 185, 205], haze: 0.3, cap: 0.5 },
  ];
})();

// --------------------------------------------------------------- audio
let AC = null, rainGain = null, windGain = null, NOISE = null;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    NOISE = buf;
    const mk = (type, freq) => {
      const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = AC.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(envOut()); src.start();
      return g;
    };
    rainGain = mk('highpass', 1200);
    windGain = mk('lowpass', 500);
  } catch (e) { AC = null; }
}
// ระดับเสียง sound effect (0-1) ปรับจากสไลด์ จำไว้ในเบราว์เซอร์นี้ · ไม่รวมเพลงและเสียงพูด
let SFX_VOL = 0.8, SFX_GAIN = null;
try { const v = parseFloat(localStorage.getItem('mtbSfxVol')); if (v >= 0 && v <= 1) SFX_VOL = v; } catch (e) { /* ignore */ }
// หูคนรับรู้ความดังแบบลอการิทึม → ใช้ค่ายกกำลังสอง (10% ≈ เบามากจริง, 0 = เงียบสนิท)
function sfxCurve(v) { return v * v; }
function sfxOut() {
  if (!SFX_GAIN) { SFX_GAIN = AC.createGain(); SFX_GAIN.gain.value = sfxCurve(SFX_VOL); SFX_GAIN.connect(AC.destination); }
  return SFX_GAIN;
}
// ระดับเสียงฝน/ลม (สภาพแวดล้อม) แยกจากเอฟเฟกต์ · ยังลดตามสไลด์เอฟเฟกต์ด้วย
let ENV_VOL = 0.5, ENV_GAIN = null;
try { const v = parseFloat(localStorage.getItem('mtbEnvVol')); if (v >= 0 && v <= 1) ENV_VOL = v; } catch (e) { /* ignore */ }
function envOut() {
  if (!ENV_GAIN) { ENV_GAIN = AC.createGain(); ENV_GAIN.gain.value = sfxCurve(ENV_VOL); ENV_GAIN.connect(sfxOut()); }
  return ENV_GAIN;
}
function setEnvVol(v) {
  ENV_VOL = clamp(v, 0, 1);
  if (ENV_GAIN) ENV_GAIN.gain.setTargetAtTime(sfxCurve(ENV_VOL), AC.currentTime, 0.02);
  try { localStorage.setItem('mtbEnvVol', String(ENV_VOL)); } catch (e) { /* ignore */ }
  volUI('env', ENV_VOL);
}
function volUI(kind, v) {
  document.querySelectorAll('.' + kind + 'Vol').forEach(el => { el.value = Math.round(v * 100); });
  document.querySelectorAll('.' + kind + 'VolTxt').forEach(el => { el.textContent = v > 0 ? Math.round(v * 100) + '%' : 'ปิด'; });
}
function setSfxVol(v) {
  SFX_VOL = clamp(v, 0, 1);
  if (SFX_GAIN) SFX_GAIN.gain.setTargetAtTime(sfxCurve(SFX_VOL), AC.currentTime, 0.02);
  try { localStorage.setItem('mtbSfxVol', String(SFX_VOL)); } catch (e) { /* ignore */ }
  volUI('sfx', SFX_VOL);
}
function beep(f = 440, d = 0.12, type = 'sine', v = 0.12, slide = 0) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + d + 0.02);
  } catch (e) { /* ignore */ }
}
const sfx = {
  pick: () => { beep(660, 0.1, 'triangle', 0.15); setTimeout(() => beep(990, 0.15, 'triangle', 0.15), 80); },
  good: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'square', 0.08), i * 70)); },
  bad: () => { beep(300, 0.3, 'sawtooth', 0.1, -180); },
  hit: () => { beep(120, 0.25, 'square', 0.18, -60); },
  boost: () => { beep(300, 0.4, 'sawtooth', 0.08, 600); },
  splash: () => { beep(900, 0.15, 'sine', 0.06, -500); },
};

// ---------------------------------------------------------------- music
// เพลงประกอบสร้างสดด้วย WebAudio (ไม่ต้องมีไฟล์เพลง) แต่ละฉากคนละเพลง เร่งจังหวะตอนลุ้น
const MUSIC = { gain: null, next: 0, step: 0 };
const SONGS = {
  mountain: { bpm: 128, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]] },
  sea:      { bpm: 118, prog: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]] },
  forest:   { bpm: 124, prog: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]] },
  road:     { bpm: 132, prog: [[50, 54, 57], [57, 61, 64], [59, 62, 66], [55, 59, 62]] },
  city:     { bpm: 138, prog: [[54, 57, 61], [50, 54, 57], [57, 61, 64], [52, 56, 59]] },
};
Object.assign(SONGS, {
  space:    { bpm: 112, prog: [[50, 57, 62], [53, 60, 65], [48, 55, 60], [55, 62, 67]] },
  desert:   { bpm: 116, prog: [[52, 55, 59], [53, 57, 60], [52, 56, 59], [50, 53, 57]] },
  snowland: { bpm: 120, prog: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]] },
  temple:   { bpm: 120, prog: [[50, 54, 57], [52, 55, 59], [57, 61, 64], [55, 59, 62]] },
  village:  { bpm: 126, prog: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]] },
  canyon:   { bpm: 130, prog: [[52, 55, 59], [50, 53, 57], [48, 52, 55], [47, 50, 54]] },
});
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function note(freq, t, dur, type, vol, cutoff, dest) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (cutoff) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
  node.connect(g).connect(dest || MUSIC.gain);
  o.start(t); o.stop(t + dur + 0.03);
}
function noiseHit(t, dur, freq, vol, dest, type = 'highpass') {
  const src = AC.createBufferSource(); src.buffer = NOISE;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest || MUSIC.gain);
  src.start(t, Math.random()); src.stop(t + dur + 0.02);
}
function drum(kind, t) {
  if (kind === 'kick') {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(MUSIC.gain); o.start(t); o.stop(t + 0.22);
  } else if (kind === 'snare') noiseHit(t, 0.13, 1800, 0.2);
  else noiseHit(t, 0.035, 7000, 0.06);
}
function playStep(song, st, t, spb) {
  const s16 = st % 16, bar = Math.floor(st / 16), hype = S.hype;
  const chord = song.prog[bar % song.prog.length];
  if (s16 % 4 === 0) drum('kick', t);
  if (s16 === 4 || s16 === 12) drum('snare', t);
  if (s16 % 2 === 1 || hype > 0.4) drum('hat', t);
  if (hype > 0.6 && s16 >= 14) drum('snare', t);
  if ([0, 3, 6, 8, 10, 11, 14].includes(s16)) note(mtof(chord[0] - 24), t, spb * 1.6, 'sawtooth', 0.1, 700);
  note(mtof(chord[s16 % 3] + 12 + (hype > 0.3 && s16 >= 8 ? 12 : 0)), t, spb * 0.8, 'square', 0.02, 2400);
  if (hash2(bar * 16 + s16, 77) < 0.32) {
    const n = chord[Math.floor(hash2(bar * 16 + s16, 78) * 3)] + 24;
    note(mtof(n), t, spb * 2.2, 'triangle', 0.05);
  }
}
function musicTick() {
  if (!AC || !NOISE) return;
  if (!MUSIC.gain) { MUSIC.gain = AC.createGain(); MUSIC.gain.connect(AC.destination); MUSIC.next = AC.currentTime + 0.1; }
  const on = S.musicOn && !S.paused;
  MUSIC.gain.gain.value = on ? 0.5 : 0;
  if (!on || MUSIC.next < AC.currentTime - 0.5) { MUSIC.next = AC.currentTime + 0.05; if (!on) return; }
  const song = SP.on && SP.phase > 0 ? SONGS.space : (SONGS[playerScene().sid] || SONGS.road);
  const spb = 60 / (song.bpm + S.hype * 14) / 4;
  while (MUSIC.next < AC.currentTime + 0.2) {
    playStep(song, MUSIC.step, MUSIC.next, spb);
    MUSIC.next += spb;
    MUSIC.step++;
  }
}

// ---------------------------------------------------------------- voice
// เสียงพูดภาษาไทย (Text-to-Speech ของเครื่อง) ถ้าไม่มีเสียงไทยใช้เสียงบ่นแบบการ์ตูนแทน
let THAI_VOICE = null;
function loadVoices() {
  try { THAI_VOICE = speechSynthesis.getVoices().find(v => /^th/i.test(v.lang)) || null; } catch (e) { THAI_VOICE = null; }
}
if (typeof speechSynthesis !== 'undefined') { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function babble(n, pitch) {
  const t0 = AC.currentTime;
  for (let i = 0; i < Math.min(12, Math.ceil(n / 2)); i++)
    note(220 * pitch * (0.8 + Math.random() * 0.6), t0 + i * 0.075, 0.07, 'square', 0.05, 1800, sfxOut());
}
function speak(text, pitch, prio) {
  if (!S.voiceOn || !AC) return;
  const clean = text.replace(/[^฀-๿a-zA-Z0-9 !?.,]/g, '').trim();
  if (!clean) return;
  if (THAI_VOICE && typeof SpeechSynthesisUtterance === 'function') {
    if (speechSynthesis.speaking) { if (!prio) return; speechSynthesis.cancel(); }
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = THAI_VOICE; u.lang = THAI_VOICE.lang; u.pitch = clamp(pitch, 0.1, 2); u.rate = 1.15; u.volume = 1;
    speechSynthesis.speak(u);
  } else babble(clean.length, pitch);
}
// เสียงเอฟเฟกต์ตามสถานการณ์
Object.assign(sfx, {
  whoosh: () => { if (AC && NOISE) noiseHit(AC.currentTime, 0.45, 900, 0.18, sfxOut(), 'bandpass'); },
  cheer: () => {
    if (!AC || !NOISE) return;
    noiseHit(AC.currentTime, 1.4, 1200, 0.12, sfxOut(), 'bandpass');
    [784, 988, 1175, 1568].forEach((f, i) => note(f, AC.currentTime + i * 0.09, 0.2, 'square', 0.06, 0, sfxOut()));
  },
  boo: () => { if (AC) note(160, AC.currentTime, 0.5, 'sawtooth', 0.07, 600, sfxOut()); },
  splat: () => { if (AC && NOISE) noiseHit(AC.currentTime, 0.25, 500, 0.3, sfxOut(), 'lowpass'); },
});

// ---------------------------------------------------------------- input
// ไม่มีปุ่มบังคับ: ระบบปั่นและเลี้ยวอัตโนมัติ แตะจอเพื่อเปิดเสียงเท่านั้น
cv.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); if (S.paused) S.paused = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  // พิมพ์ในช่องข้อความ (เช่น ชื่อบัญชี TikTok) ไม่ให้ไปกดคีย์ลัดเกม · Enter = เชื่อมไลฟ์
  const tg = e.target;
  if (tg && (tg.tagName === 'INPUT' && tg.type === 'text' || tg.tagName === 'TEXTAREA')) {
    if (e.key === 'Enter' && tg.id === 'admTk') adminAct('tkconnect', '');
    return;
  }
  initAudio();
  if (e.code === 'KeyP' || e.code === 'Escape') S.paused = !S.paused;
  if (e.code === 'KeyM') S.musicOn = !S.musicOn;
  if (e.code === 'KeyB') nextCamMode();
  if (e.code === 'KeyI') toggleAdmin();
  if (e.code === 'KeyY') startSpace('ทดสอบ');
  if (e.code === 'KeyV') S.voiceOn = !S.voiceOn;
  if (e.code === 'KeyG') { const p = document.getElementById('giftPanel'); if (p && p.classList) p.classList.toggle('hidden'); }
  if (e.code === 'KeyO' && S.rivals.length) doCheat(pick(S.rivals));
  // debug: 1 = ฉากถัดไป, 2 = อากาศถัดไป, 3 = เวลา +1 ชม., 4 = ความยากถัดไป
  if (e.code === 'Digit1') {
    const cur = sceneChanges[sceneChanges.length - 1].id;
    const id = SCENE_IDS[(SCENE_IDS.indexOf(cur) + 1) % SCENE_IDS.length];
    addSceneChange(id, Math.floor((S.position + PLAYER_Z) / SEG_L) + DRAW + 20);
    LOCK.scene = id;
    toast(`🗺️ ฉากต่อไป: ${SCENES[id].name}`, '#fff');
  }
  if (e.code === 'Digit2') { const ids = Object.keys(WEATHERS); LOCK.weather = ids[(ids.indexOf(S.wCur) + 1) % ids.length]; setWeather(LOCK.weather); }
  if (e.code === 'Digit3') S.hourOff = (S.hourOff + 1) % 24;
  if (e.code === 'Digit4') { LOCK.diff = (S.diff + 1) % DIFFS.length; setDiff(LOCK.diff); resetTrackAhead(); }
  if (e.code.startsWith('Digit')) refreshAdminButtons();
  // ทดสอบของขวัญ TikTok ด้วยคีย์บอร์ด
  const testKeys = { KeyJ: 'jump', KeyC: 'tuck', KeyH: 'wheelie', KeyD: 'drift', KeyX: 'crash', KeyT: 'throw', KeyK: 'prank', KeyU: 'turbo' };
  if (testKeys[e.code]) onLiveMessage({ type: 'gift', user: 'ทดสอบ', giftName: 'คีย์บอร์ด', count: 1, diamonds: 0, action: testKeys[e.code], repeat: 1 });
});
function startGame() {
  S.started = true;
  S.countdown = 3.4;
  banner('🚵 MTB Endless Ride', 'ปั่นอัตโนมัติ • ชมการแข่งขันได้เลย');
}

// ---------------------------------------------------------- autopilot
// เลือกเลนเอง หลบอุปสรรค/เก็บไอเทมแบบสุ่ม (ไม่ได้หลบทุกครั้ง เพื่อให้มีลุ้น)
function autoPilot(dt) {
  const pz = S.position + PLAYER_Z;
  S.aiRetarget = (S.aiRetarget || 0) - dt;
  if (S.aiRetarget <= 0) { S.aiLane = -0.5 + Math.random(); S.aiRetarget = 2 + Math.random() * 4; }
  // มีคนขวางเลนข้างหน้า → เบี่ยงหาช่องแซง (ไม่ทะลุ)
  S.passT -= dt;
  const nb = S.near && S.near.block;
  if (nb && S.passT <= 0 && S.speed > riderSpeed(nb) - 50) { S.aiLane = passSide(PLAYER_REF, nb, riders()); S.passT = 1.2; S.aiRetarget = Math.max(S.aiRetarget, 2); }
  let target = S.aiLane || 0, best = Infinity;
  for (const o of S.objects) {
    if (o.done) continue;
    const d = o.z - pz;
    if (d <= 0 || d > 2600 || d >= best) continue;
    const want = o.kind === 'item' || !OB[o.type].bad;
    if (o.ai === undefined) o.ai = Math.random() < (o.kind === 'item' ? (o.type === 'tent' ? 0.35 : 0.65) : want ? 0.6 : 0.92);
    if (!o.ai) continue;
    if (want) { target = o.x; best = d; }
    else if (Math.abs(o.x - target) < o.w + 0.2) { target = o.x + (o.x > 0 ? -1 : 1) * (o.w + 0.32); best = d; }
  }
  target = clamp(target, -0.85, 0.85);
  // ชดเชยแรงเหวี่ยงโค้ง
  const seg = getSeg(Math.floor(pz / SEG_L));
  const ahead = getSeg(Math.floor(pz / SEG_L) + 12);
  const cl = seg.cliff || ahead.cliff;
  if (cl) target = cl > 0 ? Math.min(target, 0.4) : Math.max(target, -0.4);   // หนีขอบเหว
  const sp = S.speed / MAX_SPEED, grip = wp('grip') * surfAt(seg).grip;
  const ff = 2 * Math.min(sp, 1.3) ** 2 * seg.curve * 0.11 * (2 - grip) / (1.6 * (0.25 + 0.75 * Math.min(1, sp)));
  return clamp((target - S.playerX) * 2.5 + ff, -1, 1);
}

// ---------------------------------------------------------- live tricks
// ท่าพิเศษที่ผู้ชม TikTok สั่งผ่านการส่งของขวัญ (ให้ผู้เล่นหรือคู่แข่งคนไหนก็ได้)
const ACTIONS = {
  jump:    { name: 'กระโดด', icon: '🦘', dur: 1.3 },
  tuck:    { name: 'ก้มหมอบ', icon: '🏎️', dur: 6 },
  wheelie: { name: 'ยกล้อหน้า', icon: '🤸', dur: 4 },
  drift:   { name: 'สไลด์ล้อหลัง', icon: '💨', dur: 2.4 },
  crash:   { name: 'จักรยานล้ม', icon: '💥', dur: 3.4 },
  throw:   { name: 'ปาของใส่คู่แข่ง', icon: '🍅' },
  prank:   { name: 'แกล้งคู่แข่ง', icon: '🍌' },
  turbo:   { name: 'เทอร์โบ', icon: '🚀' },
  space:   { name: 'บินสู่อวกาศ', icon: '🌌' },
};
const TRICKS = ['jump', 'tuck', 'wheelie', 'drift', 'crash'];
const THROWABLES = ['🍅', '🥚', '🥧', '💣', '🍌', '🧦'];
const PRANKS = ['🍌 เปลือกกล้วย', '🛢️ น้ำมันลื่น', '📌 ตะปูเรือใบ', '🧱 ก้อนอิฐ', '🪤 กับดัก'];
const CHAR_NAMES = ['คุณ', ...RIVAL_DEFS.map(r => r.name)];
const DEFAULT_GIFTS_UI = [
  { name: 'Rose', diamonds: 1, emoji: '🌹' }, { name: 'TikTok', diamonds: 1, emoji: '🎵' },
  { name: 'GG', diamonds: 1, emoji: '🎮' }, { name: 'Ice Cream Cone', diamonds: 1, emoji: '🍦' },
  { name: 'Heart Me', diamonds: 1, emoji: '💗' }, { name: 'Finger Heart', diamonds: 5, emoji: '🫰' },
  { name: 'Perfume', diamonds: 20, emoji: '🧴' }, { name: 'Doughnut', diamonds: 30, emoji: '🍩' },
  { name: 'Cap', diamonds: 99, emoji: '🧢' }, { name: 'Hand Hearts', diamonds: 100, emoji: '🫶' },
  { name: 'Corgi', diamonds: 299, emoji: '🐶' }, { name: 'Money Gun', diamonds: 500, emoji: '💸' }, { name: 'Galaxy', diamonds: 1000, emoji: '🌌' },
];

function liveAction(action, user, target) {
  if (!ACTIONS[action]) return;
  if (target > 0) { if (S.instQ.length < 20) S.instQ.push({ action, user, target }); return; }
  if (TRICKS.includes(action)) { if (S.trickQ.length < 15) S.trickQ.push({ action, user }); }
  else if (S.instQ.length < 20) S.instQ.push({ action, user, target: 0 });
}
function startTrick(q) {
  const A = ACTIONS[q.action];
  S.trick = { type: q.action, user: q.user, t: 0, dur: A.dur };
  if (q.action !== 'tuck') camFocus(PLAYER_REF);
  banner(`${A.icon} ${A.name}!`, q.user ? `ของขวัญจาก ${q.user}` : '');
  switch (q.action) {
    case 'jump':
      S.jumpT = S.jumpDur = A.dur; S.jumpH = 520; sfx.boost(); break;
    case 'tuck':
      addEffect({ key: 'tuck', icon: '🏎️', label: 'ก้มหมอบ', dur: A.dur, maxMult: 1.2, accel: 1.4 }); sfx.boost(); break;
    case 'wheelie':
      addEffect({ key: 'wheelie', icon: '🤸', label: 'ยกล้อหน้า', dur: A.dur, maxMult: 1.05 }); beep(400, 0.3, 'triangle', 0.1, 300); break;
    case 'drift':
      S.fx.dir = Math.random() < 0.5 ? -1 : 1; S.speed *= 0.9; beep(1400, 0.6, 'sawtooth', 0.04, -900); break;
    case 'crash':
      S.fx.dir = Math.random() < 0.5 ? -1 : 1;
      S.health = Math.max(1, S.health - 8); S.hitFlash = 1; S.shake = 1; sfx.hit(); comic('ล้ม!!', '#ff8a80'); break;
  }
}
function nearestRivalAhead() {
  const pz = S.position + PLAYER_Z;
  return S.rivals.filter(r => r.z > pz + 300 && r.z < pz + 30000).sort((a, b) => a.z - b.z)[0] || null;
}
function hitRival(r, emoji) {
  r.speed *= 0.45;
  r.slowT = Math.max(r.slowT, 2.5);
  r.splat = { emoji, t: 2.5 };
  if (Math.random() < 0.4) r.fallT = 2;
  floater(`${emoji} โดน ${r.name} เต็มๆ!`, '#ffe0b2');
  sfx.splat();
  later(0.4, () => say(r, pick(TALK.victim), true));
}
function hitPlayer(emoji, by) {
  S.splatFx = { emoji, t: 2.4, x: W / 2 + (Math.random() - 0.5) * 220, y: 420 + Math.random() * 140 };
  S.speed *= 0.6;
  addEffect({ key: 'splat', icon: emoji, label: 'โดนปา', dur: 2, maxMult: 0.75 });
  S.shake = 0.8;
  toast(`${emoji} ${by} ปาโดนคุณ!`, '#ffab91');
  comic('โดนปา!!', '#ffab91');
  sfx.splat();
}
function rivalAction(r, action, user) {
  if (action === 'space') { startSpace(user); return; }
  const A = ACTIONS[action];
  camFocus(r);
  switch (action) {
    case 'jump': r.jumpT = r.jumpMax = 1.2; r.jumpH = 420; break;
    case 'tuck': r.boostT = Math.max(r.boostT, 5); break;
    case 'wheelie': r.wheelieT = 3.5; r.boostT = Math.max(r.boostT, 2); break;
    case 'drift': r.driftT = 1.8; r.driftDir = r.x > 0 ? -1 : 1; break;
    case 'crash': r.fallT = 2.6; r.speed *= 0.3; break;
    case 'turbo': r.motorT = 6; break;
    case 'throw': {
      const others = racers().filter(o => o !== r);
      const t = others.filter(o => o.z > r.z).sort((a, b) => a.z - b.z)[0] || others.sort((a, b) => Math.abs(a.z - r.z) - Math.abs(b.z - r.z))[0];
      throwAt(r, t, r.name);
      break;
    }
    case 'prank': prankTarget(racers().filter(o => o !== r).sort((a, b) => b.z - a.z)[0], r.name); break;
  }
  if (action !== 'prank') banner(`${A.icon} ${r.name} ${A.name}!`, `ของขวัญจาก ${user || 'ผู้ชม'}`);
  say(r, action === 'crash' ? pick(TALK.hit) : pick(TALK.thanks), true);
}
function runInstant(q) {
  const user = q.user || 'ผู้ชม';
  if (q.target > 0) { const r = S.rivals[q.target - 1]; if (r) rivalAction(r, q.action, user); return; }
  if (TRICKS.includes(q.action)) { S.trickQ.push(q); return; }
  if (q.action === 'space') { startSpace(user); return; }
  if (q.action === 'turbo') {
    addEffect({ key: 'turbo', icon: '🚀', label: 'เทอร์โบ', dur: 6, maxMult: 1.6, accel: 2.2 });
    S.boostFlash = 1; S.speed = Math.max(S.speed, MAX_SPEED * 1.1);
    banner('🚀 เทอร์โบ!', `ของขวัญจาก ${user}`); sfx.good();
  } else if (q.action === 'throw') {
    const pz = S.position + PLAYER_Z;
    const r = nearestRivalAhead() || S.rivals.slice().sort((a, b) => Math.abs(a.z - pz) - Math.abs(b.z - pz))[0];
    if (nearestRivalAhead()) throwAt(racers()[0], r, user);
    else { hitRival(r, pick(THROWABLES)); toast(`🍅 ${user} ปาของใส่ ${r.name}!`, '#fff3e0'); }
  } else if (q.action === 'prank') {
    prankTarget(S.rivals.slice().sort((a, b) => b.z - a.z)[0], user);   // แกล้งคนที่นำ
  }
}
function updateTricks(dt) {
  if (!S.trick && S.trickQ.length && S.sleepT <= 0 && !SP.on) startTrick(S.trickQ.shift());
  S.instT -= dt;
  if (S.instT <= 0 && S.instQ.length) { runInstant(S.instQ.shift()); S.instT = 0.45; }
  const want = { tuck: 0, wheelie: 0, drift: 0, crash: 0 };
  const tr = S.trick;
  if (tr) {
    tr.t += dt;
    const u = tr.t / tr.dur;
    if (tr.type === 'tuck' || tr.type === 'wheelie') want[tr.type] = u < 0.9 ? 1 : 0;
    if (tr.type === 'drift') {
      want.drift = u < 0.8 ? 1 : 0;
      S.playerX = clamp(S.playerX + S.fx.dir * dt * 0.6 * Math.sin(u * Math.PI), -1.1, 1.1);
      S.shake = Math.max(S.shake, 0.25);
      if (Math.random() < dt * 25) S.skid.push({ x: W / 2 - S.fx.dir * (120 + Math.random() * 120), y: 930 + Math.random() * 30, t: 0 });
    }
    if (tr.type === 'crash') want.crash = u < 0.72 ? 1 : 0;
    if (tr.t >= tr.dur) {
      if (tr.type === 'drift') { addEffect({ key: 'driftboost', icon: '⚡', label: 'ดริฟต์บูสต์', dur: 2, maxMult: 1.25, accel: 2 }); S.boostFlash = 1; }
      if (tr.type === 'crash') toast('💪 ลุกขึ้นปั่นต่อ!', '#fff59d');
      S.trick = null;
    }
  }
  for (const k in want) S.fx[k] = lerp(S.fx[k], want[k], clamp(dt * (k === 'crash' ? 7 : 5), 0, 1));
  S.skid = S.skid.filter(p => (p.t += dt) < 0.8);
  for (const p of S.projectiles) {
    p.t += dt;
    const u = Math.min(1, p.t / p.dur);
    const tz = p.tgt.me ? S.position + PLAYER_Z : p.tgt.z, tx = p.tgt.me ? S.playerX : p.tgt.x;
    p.z = lerp(p.z0, tz, u);
    p.x = lerp(p.x0, tx, u);
    p.h = 250 + Math.sin(u * Math.PI) * 650;
    if (u >= 1) { p.done = true; if (p.tgt.me) hitPlayer(p.emoji, p.by); else hitRival(p.tgt, p.emoji); }
  }
  S.projectiles = S.projectiles.filter(p => !p.done);
}
// ตัวจับเวลาเอฟเฟกต์บนจอ (ทำงานตลอด)
function updateFX(dt) {
  for (const d of S.delayed) if ((d.t -= dt) <= 0) { d.done = true; try { d.fn(); } catch (e) { /* ignore */ } }
  S.delayed = S.delayed.filter(d => !d.done);
  if (S.comicFx && (S.comicFx.t += dt) > 1.3) S.comicFx = null;
  if (S.splatFx && (S.splatFx.t -= dt) <= 0) S.splatFx = null;
  if (S.giftPop && (S.giftPop.t += dt) > 2.2) S.giftPop = null;
  for (const c of S.confetti) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 260 * dt; c.rot += c.vr * dt; }
  S.confetti = S.confetti.filter(c => c.t < 2.5 && c.y < H + 20);
}
function comic(text, color) { S.comicFx = { text, color, t: 0 }; }
function confetti(n) {
  const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ffffff'];
  for (let i = 0; i < n && S.confetti.length < 160; i++)
    S.confetti.push({ x: W / 2 + (Math.random() - 0.5) * 120, y: 200, vx: (Math.random() - 0.5) * 520, vy: -200 - Math.random() * 300, c: pick(cols), t: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
}

// ------------------------------------------------- TikTok Live (via server)
const IMG_CACHE = {};
function giftImage(url) {
  if (!url || typeof Image !== 'function') return null;
  if (!IMG_CACHE[url]) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = url; IMG_CACHE[url] = im; }
  return IMG_CACHE[url];
}
function fetchLiveConfig() {
  if (typeof fetch !== 'function') return;
  fetch('/config').then(r => r.json()).then(c => { S.liveCfg = c; if (c.live) Object.assign(S.live, c.live); }).catch(() => {});
}
function onLiveMessage(m) {
  if (m.type === 'status') { Object.assign(S.live, m.live); return; }
  if (m.type === 'config') { fetchLiveConfig(); loadGiftCatalog(); return; }
  if (m.type === 'gifts') { loadGiftCatalog(); return; }
  if (m.type === 'likes') { S.live.likes = m.likes; return; }
  if (m.type === 'social') { toast(m.text, '#f8bbd0'); return; }
  if (m.type === 'team') {
    S.teams[m.char] = (S.teams[m.char] || 0) + 1;
    toast(`📣 ${m.user} เชียร์ ${CHAR_NAMES[m.char] || '?'}!`, '#e1f5fe');
    return;
  }
  if (m.type === 'gift') {
    const A = ACTIONS[m.action] || ACTIONS.jump;
    const target = m.target > 0 && m.target < CHAR_NAMES.length ? m.target : 0;
    toast(`🎁 ${m.user} ส่ง ${m.giftName}${m.count > 1 ? ' x' + m.count : ''} → ${CHAR_NAMES[target]} ${A.icon} ${A.name}`, '#fff9c4');
    const dm = (m.diamonds || 0) * (m.count || 1);
    if (dm) { S.gifters[m.user] = (S.gifters[m.user] || 0) + dm; S.support[target] += dm; }
    const em = (DEFAULT_GIFTS_UI.find(g => g.name === m.giftName) || {}).emoji || '🎁';
    S.giftPop = { img: giftImage(m.image), emoji: em, name: m.giftName, user: m.user, count: m.count || 1, t: 0 };
    sfx.pick();
    for (let i = 0; i < (m.repeat || 1); i++) liveAction(m.action, m.user, target);
  }
}
function connectLive() {
  if (typeof EventSource !== 'function') return;
  fetchLiveConfig();
  const es = new EventSource('/events');
  es.onopen = () => { S.live.server = true; };
  es.onerror = () => { S.live.server = false; };
  es.onmessage = ev => { try { onLiveMessage(JSON.parse(ev.data)); } catch (e) { /* ignore */ } };
}

// ---------------------------------------------- แผงเลือกของขวัญ (กดเลือกส่งเอง)
const GIFT_UI = { sel: 0, ready: false };
function $id(id) { const el = document.getElementById(id); return el && el.classList ? el : null; }
function localGiftAction(g) {
  const tiers = [[1000, 'space'], [199, 'turbo'], [99, 'prank'], [50, 'crash'], [30, 'throw'], [20, 'drift'], [10, 'tuck'], [5, 'wheelie'], [1, 'jump']];
  const named = S.liveCfg && S.liveCfg.giftActions && S.liveCfg.giftActions[g.name];
  if (named) return named;
  return (tiers.find(([m]) => g.diamonds >= m) || [0, 'jump'])[1];
}
function setupGiftPanel() {
  const btn = $id('giftBtn'), panel = $id('giftPanel');
  if (!btn || !panel) return;
  GIFT_UI.ready = true;
  btn.addEventListener('click', () => { initAudio(); panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) loadGiftCatalog(); });
  $id('giftClose').addEventListener('click', () => panel.classList.add('hidden'));
  const mb = $id('musicBtn'), vb = $id('voiceBtn');
  mb.addEventListener('click', () => { initAudio(); S.musicOn = !S.musicOn; mb.classList.toggle('off', !S.musicOn); });
  vb.addEventListener('click', () => { initAudio(); S.voiceOn = !S.voiceOn; vb.classList.toggle('off', !S.voiceOn); });
  const cb = $id('camBtn');
  if (cb) cb.addEventListener('click', () => { initAudio(); nextCamMode(); });
  renderCharRow();
  loadGiftCatalog();
}
function renderCharRow() {
  const row = $id('charRow');
  if (!row) return;
  row.textContent = '';
  const chars = [{ name: 'คุณ', jersey: '#ff7043' }, ...RIVAL_DEFS];
  chars.forEach((c, i) => {
    const b = document.createElement('button');
    const dot = document.createElement('i'); dot.style.background = c.jersey;
    b.appendChild(dot);
    b.appendChild(document.createTextNode(`${i + 1}. ${c.name}`));
    if (i === GIFT_UI.sel) b.classList.add('sel');
    b.addEventListener('click', () => { GIFT_UI.sel = i; renderCharRow(); });
    row.appendChild(b);
  });
}
function loadGiftCatalog() {
  if (!GIFT_UI.ready) return;
  const fallback = () => renderGiftGrid(DEFAULT_GIFTS_UI.map(g => ({ ...g, action: localGiftAction(g) })));
  if (typeof fetch !== 'function') return fallback();
  fetch('/gifts').then(r => r.json()).then(d => renderGiftGrid(d.gifts && d.gifts.length ? d.gifts : null) || 0).catch(fallback);
}
function renderGiftGrid(list) {
  const grid = $id('giftGrid');
  if (!grid) return;
  if (!list) list = DEFAULT_GIFTS_UI.map(g => ({ ...g, action: localGiftAction(g) }));
  grid.textContent = '';
  for (const g of list) {
    const A = ACTIONS[g.action] || ACTIONS.jump;
    const b = document.createElement('button');
    if (g.image) { const im = document.createElement('img'); im.src = g.image; im.alt = ''; im.referrerPolicy = 'no-referrer'; b.appendChild(im); }
    else { const sp = document.createElement('span'); sp.className = 'emo'; sp.textContent = g.emoji || (DEFAULT_GIFTS_UI.find(x => x.name === g.name) || {}).emoji || '🎁'; b.appendChild(sp); }
    for (const [cls, txt] of [['nm', g.name], ['dm', `💎${g.diamonds}`], ['ac', `${A.icon} ${A.name}`]]) {
      const sp = document.createElement('span'); sp.className = cls; sp.textContent = txt; b.appendChild(sp);
    }
    b.addEventListener('click', () => sendPanelGift(g));
    grid.appendChild(b);
  }
}
function sendPanelGift(g) {
  initAudio();
  const user = 'ผู้ชม (กดเอง)';
  if (S.live.server && typeof fetch === 'function') {
    const q = new URLSearchParams({ gift: g.name, diamonds: g.diamonds, target: GIFT_UI.sel, user, action: g.action || '', image: g.image || '' });
    fetch('/test?' + q.toString()).catch(() => {});
  } else {
    onLiveMessage({ type: 'gift', user, giftName: g.name, count: 1, diamonds: g.diamonds, action: g.action || localGiftAction(g), repeat: 1, target: GIFT_UI.sel, image: g.image || '' });
  }
}

// ---------------------------------------------------------- messages
function toast(text, color = '#fff') {
  S.toasts.push({ text, color, t: 0, dur: 2.4 });
  if (S.toasts.length > 3) S.toasts.shift();
}
function floater(text, color = '#fff') { S.floaters.push({ text, color, t: 0 }); }
function banner(title, sub) { S.banner = { title, sub, t: 0 }; }

// ---------------------------------------------------------- effects
function addEffect(e) {
  S.effects = S.effects.filter(x => x.key !== e.key);
  S.effects.push(Object.assign({}, e, { until: S.gt + e.dur, total: e.dur }));
}
function effTotals() {
  const r = { maxMult: 1, accel: 1, shield: false, noDrain: false, reverse: false, slip: false };
  for (const e of S.effects) {
    if (e.maxMult) r.maxMult *= e.maxMult;
    if (e.accel) r.accel *= e.accel;
    if (e.shield) r.shield = true;
    if (e.noDrain) r.noDrain = true;
    if (e.reverse) r.reverse = true;
    if (e.slip) r.slip = true;
  }
  return r;
}

// ---------------------------------------------------------- weather
function wI(id) { return (S.wCur === id ? S.wT : 0) + (S.wPrev === id ? 1 - S.wT : 0); }
function wp(key) { return lerp(WEATHERS[S.wPrev][key], WEATHERS[S.wCur][key], S.wT); }
function setWeather(id, quiet) {
  if (id === S.wCur) return;
  S.wPrev = S.wCur; S.wCur = id; S.wT = 0;
  if (!quiet) banner(`${WEATHERS[id].icon} ${WEATHERS[id].name}`, WEATHERS[id].tip);
}
function setDiff(d, quiet) {
  S.diff = d;
  if (!quiet) toast(`⚠️ ความยาก: ${DIFFS[d].name}`, DIFFS[d].color);
}

function checkSlots(th) {
  const sceneSlot = Math.floor(th.ms / SCENE_MS);
  if (S.sceneSlot === null) {
    S.sceneSlot = sceneSlot;
    const forced = params.get('scene');
    sceneChanges.push({ from: -1e12, id: SCENES[forced] ? forced : sceneForSlot(sceneSlot) });
  } else if (sceneSlot !== S.sceneSlot) {
    S.sceneSlot = sceneSlot;
    if (LOCK.scene) return checkWD(th);   // แอดมินล็อกฉากไว้ → ไม่สุ่มเปลี่ยน
    const id = sceneForSlot(sceneSlot);
    if (!SP.on && SPACE_ON && mulberry32(sceneSlot * 131 + 5)() < 0.2) {
      startSpace();
    } else if (id !== sceneChanges[sceneChanges.length - 1].id) {
      addSceneChange(id, Math.floor((S.position + PLAYER_Z) / SEG_L) + DRAW + 20);
      toast(`🗺️ ข้างหน้าคือ ${SCENES[id].icon} ${SCENES[id].name}`, '#e1f5fe');
    }
  }
  checkWD(th);
}
function checkWD(th) {
  const wSlot = Math.floor(th.ms / WEATHER_MS);
  if (S.weatherSlot === null) {
    S.weatherSlot = wSlot;
    const forced = params.get('weather');
    S.wCur = S.wPrev = WEATHERS[forced] ? forced : weatherForSlot(wSlot, sceneChanges[0].id);
  } else if (wSlot !== S.weatherSlot) {
    S.weatherSlot = wSlot;
    if (!LOCK.weather) setWeather(weatherForSlot(wSlot, playerScene().sid));
  }
  const dSlot = Math.floor(th.ms / DIFF_MS);
  if (S.diffSlot === null) { S.diffSlot = dSlot; setDiff(diffForSlot(dSlot), true); }
  else if (dSlot !== S.diffSlot) { S.diffSlot = dSlot; const d = diffForSlot(dSlot); if (LOCK.diff === null && d !== S.diff) setDiff(d); }
}
function playerSegIdx() { return Math.floor((S.position + PLAYER_Z) / SEG_L); }
function playerScene() { return getSeg(playerSegIdx()); }

// ---------------------------------------------------------- particles
function initParticles() {
  for (let i = 0; i < 9; i++) S.clouds.push({ x: Math.random() * 1600, y: 40 + Math.random() * (HORIZON - 160), s: 0.6 + Math.random() * 0.9 });
  for (let i = 0; i < 260; i++) S.drops.push({ x: Math.random() * W, y: Math.random() * H, l: 18 + Math.random() * 26, v: 900 + Math.random() * 600 });
  for (let i = 0; i < 160; i++) S.flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3, v: 40 + Math.random() * 80, ph: Math.random() * 6 });
  for (let i = 0; i < 90; i++) S.dust.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.5, v: 40 + Math.random() * 100 });
}
function updateParticles(dt) {
  const sp = S.speed / MAX_SPEED;
  const wind = (S.wCur === 'rain' ? -120 : 0) - S.steerVel * 200 * sp;
  for (const d of S.drops) {
    d.y += d.v * dt; d.x += wind * dt + (d.x - W / 2) * sp * dt * 0.6;
    if (d.y > H || d.x < -30 || d.x > W + 30) { d.y = -d.l - Math.random() * 100; d.x = Math.random() * W; }
  }
  for (const f of S.flakes) {
    f.y += f.v * dt + (f.y - HORIZON) * sp * dt * 0.9;
    f.x += Math.sin(S.t * 1.5 + f.ph) * 25 * dt + (f.x - W / 2) * sp * dt * 0.9 + wind * 0.2 * dt;
    if (f.y > H || f.x < -10 || f.x > W + 10) { f.y = HORIZON * Math.random(); f.x = W / 2 + (Math.random() - 0.5) * W; }
  }
  for (const d of S.dust) {
    d.x += (d.v + sp * 200) * dt * (d.r > 2 ? 1 : 0.6); d.y += Math.sin(S.t + d.r * 9) * 10 * dt;
    if (d.x > W + 10) { d.x = -10; d.y = Math.random() * H; }
  }
  for (const c of S.clouds) c.x += dt * 4 * c.s;
  // ลมหายใจตอนหนาว
  const coldI = wI('cold') + wI('snow');
  if (coldI > 0.3 && S.started && Math.random() < dt * 1.2) S.breath.push({ t: 0, x: W / 2 + (Math.random() - 0.5) * 30 });
  S.breath = S.breath.filter(b => (b.t += dt) < 1.4);
  if (wI('rain') > 0.6 && Math.random() < dt * 0.04) S.lightning = 1;
  S.lightning = Math.max(0, S.lightning - dt * 2.5);
}

// ---------------------------------------------------------- rivals
const U_PER_M = SEG_L / M_PER_SEG;   // หน่วยโลกต่อ 1 เมตร
const CAM_U = 300;                   // ระยะกล้อง (หน่วยโลก) ตามสเกลเดิม — มุมกล้องไม่เปลี่ยน

// ---------------------------------------------------------- แรงปั่น 0-100% + ความเหนื่อย
const EFFORT_LV = [
  { min: 85, name: 'สู้มาก', icon: '🔥', color: '#ff5252' },
  { min: 65, name: 'สู้', icon: '😤', color: '#ffab40' },
  { min: 40, name: 'ปกติ', icon: '🙂', color: '#69f0ae' },
  { min: 20, name: 'หอบ', icon: '😮‍💨', color: '#80d8ff' },
  { min: 0, name: 'เหนื่อย', icon: '🥵', color: '#bdbdbd' },
];
function effortLv(e) { return EFFORT_LV.find(l => e >= l.min) || EFFORT_LV[4]; }
// ความเร็วทางราบตามแรงปั่น: แรงต้านอากาศ ∝ v³ → ความเร็ว ∝ รากที่สามของกำลัง
// 100% = 35, 70% ≈ 32, 50% ≈ 30, 25% ≈ 26, 5% ≈ 20 km/h
function effortSpeed(e) { return 0.3 + 0.7 * Math.cbrt(clamp(e, 0, 100) / 100); }
function effortAccel(e) { return 0.35 + 0.65 * clamp(e, 0, 100) / 100; }
// แรง > 50% = เสียพลัง (สู้มาก 100% ได้ ~30 วิ), < 50% = ฟื้นพลัง · ขึ้นเขาเหนื่อยเพิ่ม · ปั่นตามหลังคนอื่น (ดราฟต์) เหนื่อยน้อยลง
function staminaRate(e, slope, draft) {
  const up = Math.max(0, slope) * 12 * e / 100;
  return e > 50 ? -((e - 50) / 50 * 3.2 + up) * (draft ? 0.65 : 1) : (50 - e) / 50 * 6 - up * 0.5;
}
// สมองเลือกแรงปั่น: หมดแรง → ผ่อน, มีคนข้างหน้าใกล้ๆ → สู้มากไล่แซง, มีคนไล่หลัง → สู้หนี
function thinkEffort(o, stam, dt, near) {
  if (stam < 8) o.tired = true; else if (o.tired && stam > 40) o.tired = false;
  o.effT -= dt;
  if (o.tired) o.effTarget = 8;
  else if (stam < 25 && o.effTarget > 45) o.effTarget = 30;
  else if (o.effT <= 0) {
    o.effT = 4 + Math.random() * 6;
    const r = Math.random();
    if (near && near.ahead && stam > 50 && r < 0.45) o.effTarget = 86 + Math.random() * 14;
    else if (near && near.behind && stam > 40 && r < 0.5) o.effTarget = 66 + Math.random() * 16;
    else o.effTarget = r < 0.15 ? 25 + Math.random() * 12 : r < 0.6 ? 45 + Math.random() * 18 : r < 0.88 ? 66 + Math.random() * 16 : 86 + Math.random() * 12;
  }
  o.effort = clamp(o.effort + clamp(o.effTarget - o.effort, -40 * dt, 30 * dt), 0, 100);
}

// ---------------------------------------------------------- ห้ามทะลุกัน
const RIDER_W = 0.2;     // ระยะห่างด้านข้างขั้นต่ำระหว่างนักปั่น
const RIDER_LEN = 1.9;   // ความยาวจักรยาน (เมตร)
function riders() { return racers().concat(S.pack); }
function riderX(o) { return o.me ? S.playerX : o.x; }
function riderSpeed(o) { return o.me ? S.speed : o.speed; }
// ใครอยู่ข้างหน้า/ข้างหลัง ใครขวางเลน และได้ดราฟต์ไหม
function raceNear(me, all) {
  const m = U_PER_M, L = RIDER_LEN * m, mx = riderX(me);
  let ahead = null, behind = null, block = null, draft = false;
  for (const o of all) {
    if (o === me) continue;
    const dz = o.z - me.z, dx = Math.abs(riderX(o) - mx);
    if (!o.extra && dz > 3 * m && dz < 30 * m && (!ahead || dz < ahead.z - me.z)) ahead = o;
    if (!o.extra && dz < 0 && dz > -10 * m) behind = o;
    if (dz > 0 && dz < L + 6 * m && dx < RIDER_W && (!block || dz < block.z - me.z)) block = o;
    if (dz > L && dz < 10 * m && dx < 0.35) draft = true;
  }
  return { ahead, behind, block, draft };
}
// เลือกข้างที่จะแซง: ข้างที่ว่าง ไม่มีคน/สิ่งกีดขวาง และใกล้ตัวเอง
function passSide(me, blk, all) {
  const mx = riderX(me), bx = riderX(blk);
  let best = mx, bestS = -1e9;
  for (const s of [-1, 1]) {
    const x = bx + s * (RIDER_W + 0.12);
    if (x < -0.85 || x > 0.85) continue;
    let sc = -Math.abs(x - mx);
    for (const o of all) if (o !== me && o !== blk && Math.abs(o.z - me.z) < 8 * U_PER_M && Math.abs(riderX(o) - x) < RIDER_W) sc -= 2;
    for (const o of S.objects) if (o.kind === 'obst' && !o.done && OB[o.type].bad && OB[o.type].w < 0.9 && o.z > me.z && o.z - me.z < 15 * U_PER_M && Math.abs(o.x - x) < o.w + 0.1) sc -= 1.5;
    if (sc > bestS) { bestS = sc; best = x; }
  }
  return best;
}
// ไม่ให้ทับกัน: ชนท้าย → ต่อแถวหลังคันหน้า, คู่กัน → ดันออกด้านข้าง
function separate(me, all) {
  const L = RIDER_LEN * U_PER_M;
  for (const o of all) {
    if (o === me) continue;
    const dz = o.z - me.z, dx = me.x - riderX(o);
    if (Math.abs(dx) >= RIDER_W || Math.abs(dz) >= L) continue;
    if (dz >= L * 0.45) { me.z = o.z - L; me.speed = Math.min(me.speed, riderSpeed(o)); }
    else if (dz > -L * 0.45) {
      const dir = dx > 0 || (dx === 0 && me.x < 0) ? 1 : -1;
      if (o.me) { me.x = clamp(riderX(o) + dir * RIDER_W, -0.95, 0.95); me.tx = me.x; }   // ไม่ไปดันผู้เล่น หลบเอง
      else {
        const push = (RIDER_W - Math.abs(dx)) * 0.5 * dir;
        me.x = clamp(me.x + push, -0.95, 0.95); o.x = clamp(o.x - push, -0.95, 0.95);
      }
    }
  }
}
// ผู้เล่นห้ามทะลุคันหน้า → ต่อท้าย (ระบบหลบจะพาเบี่ยงแซงเอง) · เรียกหลังทุกคนขยับแล้ว
function resolvePlayer() {
  if (SP.on) return;
  // เกลี่ยทุกคนอีก 2 รอบ กันกรณีโดนดันไปทับคนที่สาม
  const all = riders(), npc = S.rivals.concat(S.pack);
  for (let it = 0; it < 2; it++) for (const r of npc) separate(r, all);
  const L = RIDER_LEN * U_PER_M;
  for (const o of S.rivals.concat(S.pack)) {
    const pz = S.position + PLAYER_Z, dz = o.z - pz;
    if (Math.abs(S.playerX - o.x) >= RIDER_W || dz <= -L || dz >= L) continue;
    if (dz >= L * 0.45) { S.position = o.z - L - PLAYER_Z; S.speed = Math.min(S.speed, o.speed); }
    else if (dz > -L * 0.45) { const dir = o.x >= S.playerX ? 1 : -1; o.x = clamp(S.playerX + dir * RIDER_W, -0.95, 0.95); o.tx = o.x; }
    else { o.z = pz - L; o.speed = Math.min(o.speed, S.speed); }
  }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
// คำพูดแซว/ด่าแบบขำๆ ตามสถานการณ์
const TALK = {
  overtakePlayer: ['บ๊ายบาย! 👋', 'กินฝุ่นไปซะ!', 'ช้าเป็นเต่าเลยนะ!', 'หลบไป๊! ทางของข้า!', 'ตามมาสิ ถ้าแน่จริง!', 'ขาไก่ชัดๆ!'],
  passedByPlayer: ['เฮ้ย! อย่าแซงนะ!', 'เดี๋ยวเจอกัน!', 'โชคช่วยล่ะสิ!', 'ไม่ยอมหรอก!', 'อย่าเพิ่งดีใจ!'],
  cheat: ['ฮ่าๆ ไม่มีใครเห็น!', 'โกงนิดหน่อยไม่เป็นไร!', 'กติกามีไว้แหก!', 'อุ๊ปส์ มือลั่น!', 'ชนะคือชนะ!'],
  victim: ['แกโกง!', 'โอ๊ย! ใครทำวะ!', 'จำไว้เลยนะ!', 'ขี้โกงชัดๆ!', 'เดี๋ยวแก้แค้น!', 'กรรมการ! มันโกง!'],
  lead: ['ข้าคือที่หนึ่ง!', 'ตามไม่ทันหรอก!', 'แชมป์มาแล้ว!', 'ใครจะหยุดข้าได้!'],
  hit: ['โอ๊ยยย!', 'ใครวางไว้เนี่ย!', 'เจ็บนะเว้ย!', 'ซวยจริงๆ!'],
  taunt: ['เหนื่อยยัง?', 'ขาสั่นแล้วมั้ง!', 'ปั่นแรงๆ หน่อย!', 'แค่นี้เองเหรอ?', 'มาดวลกันเลย!'],
  thanks: ['ขอบคุณที่เชียร์!', 'ใจดีจัง!', 'พลังมาเต็ม!', 'เชียร์ต่อเลย!'],
};
const PLAYER_REF = { me: true, name: 'คุณ', char: 0, z: 0, x: 0 };
function racers() {
  PLAYER_REF.z = S.position + PLAYER_Z; PLAYER_REF.x = S.playerX; PLAYER_REF.speed = S.speed;
  PLAYER_REF.effort = S.pe.effort; PLAYER_REF.stopT = S.stopT;
  return [PLAYER_REF, ...S.rivals];
}
function initRivals() {
  const bases = [0.99, 0.985, 1.0, 0.98, 0.995].sort(() => Math.random() - 0.5);
  const lanes = [-0.5, 0.4, -0.1, 0.55, -0.6];
  const pitches = [0.8, 1.4, 1.0, 1.7, 0.65];
  S.rivals = RIVAL_DEFS.map((d, i) => ({
    ...d, idx: i, char: i + 1, z: PLAYER_Z + 350 + i * 320, x: lanes[i], tx: lanes[i], speed: 0, base: bases[i],
    stam: 70 + Math.random() * 30, effort: 55, effTarget: 55, effT: Math.random() * 4, tired: false, stopT: 0, passT: 0, lvMsgT: -99,
    slowT: 0, boostT: 0, jumpT: 0, wheelieT: 0, driftT: 0, driftDir: 1, fallT: 0, motorT: 0, talkT: 0,
    phase: Math.random() * 6, retarget: 2 + Math.random() * 3, pitch: pitches[i], say: null, splat: null, gapSign: 0,
  }));
}
function rivalVisible(r) { const g = r.z - S.position; return g > 260 && g < DRAW * SEG_L * 0.7; }
function say(r, text, prio) {
  if (!r || r.me || !text) return;
  if (r.talkT > 0 && !prio) return;
  r.talkT = 2.2;
  r.say = { text, t: 2.8 };
  if (!rivalVisible(r)) toast(`💬 ${r.name}: ${text}`, r.jersey);
  if (Math.abs(r.z - (S.position + PLAYER_Z)) < 80 * U_PER_M) speak(text, r.pitch, prio);
}
function later(t, fn) { S.delayed.push({ t, fn }); }

function updateRivals(dt) {
  const pz = S.position + PLAYER_Z;
  const all = riders();
  const m = U_PER_M, L = RIDER_LEN * m;
  for (const r of S.rivals) {
    const gap = r.z - pz;
    const near = raceNear(r, all);
    const ri = Math.floor(r.z / SEG_L);
    const slope = (getSeg(ri + 1).y - getSeg(ri).y) / SEG_L;
    // แรงปั่นจริง ไม่มีการดึงให้อยู่ใกล้ผู้เล่น → ทิ้งห่างกันได้ไกล
    const lv0 = effortLv(r.effort);
    if (r.stopT > 0 || r.fallT > 0) r.effort = Math.max(0, r.effort - 80 * dt);
    else thinkEffort(r, r.stam, dt, near);
    r.stam = clamp(r.stam + staminaRate(r.effort, slope, near.draft) * dt, 0, 100);
    const lv = effortLv(r.effort);
    if (lv !== lv0 && Math.abs(gap) < 40 * m && S.gt - r.lvMsgT > 6) {
      if (lv.name === 'สู้มาก') { toast(`🔥 ${r.name} สู้มาก! เร่งสุดแรง`, r.jersey); r.lvMsgT = S.gt; }
      else if (lv.name === 'เหนื่อย') { toast(`🥵 ${r.name} หมดแรง ปั่นช้าลง`, '#e0e0e0'); r.lvMsgT = S.gt; }
    }
    const slopeMult = slope > 0 ? 1 - clamp(slope * 2.2, 0, 0.6) : 1 + clamp(-slope * 1.8, 0, 0.7);
    let target = MAX_SPEED * r.base * effortSpeed(r.effort) * (near.draft ? 1.05 : 1) * wp('maxMult') * surfAt(getSeg(ri)).speed * slopeMult;
    if (SP.on) target = S.speed * r.base;
    if (r.slowT > 0) { r.slowT -= dt; target *= 0.55; }
    if (r.boostT > 0) { r.boostT -= dt; target *= 1.3; }
    if (r.motorT > 0) { r.motorT -= dt; target *= 1.35; }
    if (r.wheelieT > 0) r.wheelieT -= dt;
    if (r.jumpT > 0) r.jumpT -= dt;
    if (r.talkT > 0) r.talkT -= dt;
    if (r.driftT > 0) {
      r.driftT -= dt;
      r.tx = clamp(r.x + r.driftDir * 0.5, -0.85, 0.85);
      if (r.driftT <= 0) r.boostT = Math.max(r.boostT, 2);
    }
    if (r.fallT > 0) { r.fallT -= dt; target = 0; }
    // ชนสิ่งกีดขวาง → หยุดนิ่ง แล้วค่อยออกตัวปั่นใหม่จาก 0
    if (r.stopT > 0) {
      r.stopT -= dt; target = 0;
      if (r.stopT <= 0 && Math.abs(gap) < 40 * m) toast(`🚴 ${r.name} ออกตัวปั่นใหม่`, r.jersey);
    }
    if (r.splat && (r.splat.t -= dt) <= 0) r.splat = null;
    if (r.say && (r.say.t -= dt) <= 0) r.say = null;
    // มีคนขวางเลนข้างหน้า: ห้ามทะลุ → ชะลอตาม แล้วเบี่ยงหาช่องแซง
    const blk = near.block;
    if (blk && !SP.on && r.stopT <= 0) {
      const bs = riderSpeed(blk);
      if (target > bs || r.speed > bs) {
        if (r.passT <= 0) { r.tx = passSide(r, blk, all); r.passT = 1.2; }
        if (blk.z - r.z < L + 1.5 * m) target = Math.min(target, bs);
      }
    }
    target = Math.min(target, SP.on ? S.speed * 1.5 : TOP_SPEED * 0.95);
    const stopping = r.fallT > 0 || r.stopT > 0;
    r.speed += clamp(target - r.speed, -MAX_SPEED * (stopping ? 3 : 0.8) * dt, ACCEL * 1.1 * effortAccel(r.effort) * dt);
    r.speed = Math.max(0, r.speed);
    const prevZ = r.z;
    r.z += r.speed * dt;

    r.passT -= dt;
    r.retarget -= dt;
    if (r.retarget <= 0 && r.passT <= 0) { r.tx = -0.65 + Math.random() * 1.3; r.retarget = 2 + Math.random() * 4; }
    let fast = r.passT > 0;
    const look = 700 + r.speed * 1.1;   // มองไกลตามความเร็ว (~1 วิข้างหน้า) หลบทัน
    const inRange = gap > -3500 && gap < (DRAW - 8) * SEG_L;
    for (const o of S.objects) {
      if (o.kind !== 'obst') continue;
      const def = OB[o.type];
      const d = o.z - r.z;
      if (d > 0 && d < look && o.dodge[r.idx] && def.bad && def.w < 0.9 && Math.abs(o.x - r.x) < o.w + 0.18) {
        r.tx = clamp(o.x + (o.x > r.x ? -1 : 1) * (o.w + 0.3), -0.85, 0.85);
        if (Math.abs(r.tx) >= 0.85) r.tx = o.x + (o.x > 0 ? -1 : 1) * (o.w + 0.3);
        fast = true;
      }
      if (o.z > prevZ && o.z <= r.z && Math.abs(o.x - r.x) < o.w + 0.08 && (r.jumpT <= 0 || o.type === 'kicker') && !(o.hitR && o.hitR[r.idx])) {
        (o.hitR = o.hitR || [])[r.idx] = true;   // ชนอันเดิมซ้ำไม่ได้
        if (def.fx === 'air') {   // คู่แข่งลอยข้ามโนนดินด้วย
          const sz = o.size || 0.5;
          r.jumpT = r.jumpMax = 0.7 + sz * 1.1; r.jumpH = 400 + sz * 1500;
        } else if (def.fx === 'hit') {
          if (o.type === 'bump') r.speed *= 0.7;   // ลูกระนาดขวางทั้งทาง แค่สะเทือน
          else {
            r.speed = 0; r.stopT = 1.4 + Math.random() * 1.2; r.z = Math.min(r.z, o.z);
            if (Math.abs(gap) < 40 * m) toast(`💥 ${r.name} ${def.label} หยุดกึก!`, '#ffccbc');
            if (Math.random() < 0.6) say(r, pick(TALK.hit));
          }
        } else if (def.fx === 'boost') r.boostT = def.dur;
        else { r.slowT = def.dur; if (o.dropped && Math.random() < 0.6) { r.fallT = 1.8; say(r, pick(TALK.victim)); } }
      }
    }
    // อยู่ไกลเกินระยะที่มีสิ่งกีดขวางจริง → สุ่มชนเป็นครั้งคราวให้ยุติธรรม
    if (!inRange && !SP.on && r.stopT <= 0 && Math.random() < DIFFS[S.diff].obst * (r.speed / SEG_L) * 0.06 * dt) {
      r.speed = 0; r.stopT = 1.4 + Math.random() * 1.2;
    }
    r.x = lerp(r.x, clamp(r.tx, -0.85, 0.85), clamp(dt * (fast ? 3.2 : 1.5), 0, 1));
    if (!SP.on) separate(r, all);
    r.phase += dt * (3 + r.speed / MAX_SPEED * 8);
  }
}
function updateRank() {
  const pz = S.position + PLAYER_Z;
  const order = [{ me: true, z: pz }, ...S.rivals].sort((a, b) => b.z - a.z);
  S.order = order;
  S.rank = order.findIndex(o => o.me) + 1;
  if (S.rank !== S.prevRank) {
    if (S.gt - S.lastRankMsg > 1.2) {
      if (S.rank < S.prevRank) { toast(`⬆️ แซงขึ้นอันดับ ${S.rank}!`, '#b9f6ca'); sfx.whoosh(); confetti(18); }
      else toast(`⬇️ ถูกแซง! ตกไปอันดับ ${S.rank}`, '#ffccbc');
      S.lastRankMsg = S.gt;
    }
    S.prevRank = S.rank;
  }
  // คู่แข่งแซง/ถูกแซง → พูดแซว
  for (const r of S.rivals) {
    const sign = r.z > pz ? 1 : -1;
    if (r.gapSign && sign !== r.gapSign) say(r, pick(sign > 0 ? TALK.overtakePlayer : TALK.passedByPlayer));
    r.gapSign = sign;
  }
  const leadKey = order[0].me ? 'me' : order[0].name;
  if (S.leader && leadKey !== S.leader) {
    if (order[0].me) { banner('👑 คุณขึ้นนำ!', 'รักษาตำแหน่งไว้!'); comic('ที่ 1!!', '#ffd54f'); confetti(70); sfx.cheer(); }
    else { banner(`👑 ${order[0].name} ขึ้นนำ!`, 'ไล่ตามให้ทัน!'); say(order[0], pick(TALK.lead), true); }
  }
  S.leader = leadKey;
}

// ---------------------------------------------------- race director (โกงกัน)
function updateDirector(dt) {
  const pz = S.position + PLAYER_Z;
  S.cheatT -= dt;
  if (S.cheatT <= 0) {
    S.cheatT = (3 + Math.random() * 5) * [1.3, 1, 0.8, 0.6][S.diff];
    const near = S.rivals.filter(r => Math.abs(r.z - pz) < 60 * U_PER_M && r.fallT <= 0);
    if (near.length) doCheat(pick(near));
  }
  // ดวลกันสูสี
  const close = S.rivals.filter(r => Math.abs(r.z - pz) < 5 * U_PER_M);
  S.battleT = close.length ? S.battleT + dt : Math.max(0, S.battleT - dt * 2);
  if (S.battleT > 1.5 && S.gt - S.lastBattleMsg > 15) {
    S.lastBattleMsg = S.gt;
    banner('⚔️ ดวลกันสูสี!', 'คุณ vs ' + close.map(r => r.name).join(' vs '));
    comic('สูสี!!', '#ffd54f');
    say(close[0], pick(TALK.taunt), true);
  }
  const turbo = S.effects.some(e => e.key === 'turbo');
  S.hype = lerp(S.hype, clamp((S.battleT > 1 ? 0.6 : 0) + (S.speed > MAX_SPEED * 1.4 ? 0.4 : 0) + (turbo ? 0.5 : 0), 0, 1), clamp(dt * 1.5, 0, 1));
}
function affect(t, kind, by) {
  if (t.me) {
    if (kind === 'grab') { addEffect({ key: 'grab', icon: '🫳', label: 'โดนดึงเสื้อ', dur: 2, maxMult: 0.7 }); S.speed *= 0.85; S.shake = 0.6; }
    if (kind === 'shove') { S.playerX = clamp(S.playerX + (S.playerX >= by.x ? 1 : -1) * 0.55, -2, 2); S.speed *= 0.8; S.shake = 1; S.hitFlash = 0.6; sfx.hit(); }
  } else {
    if (kind === 'grab') t.slowT = Math.max(t.slowT, 2);
    if (kind === 'shove') {
      t.x = t.tx = clamp(t.x + (t.x >= by.x ? 1 : -1) * 0.5, -0.9, 0.9);
      t.slowT = Math.max(t.slowT, 1.5);
      if (Math.random() < 0.35) t.fallT = 2.2;
    }
  }
}
function throwAt(from, tgt, by) {
  if (!tgt) return;
  const emoji = pick(THROWABLES);
  const fz = from.me ? S.position + PLAYER_Z : from.z, fx = from.me ? S.playerX : from.x;
  const name = by || from.name;
  if (tgt.me && fz < S.position + 260) {
    later(0.6, () => hitPlayer(emoji, name));   // ปามาจากข้างหลัง มองไม่เห็น
  } else {
    S.projectiles.push({ emoji, tgt, z0: fz, x0: fx, z: fz, x: fx, h: 0, t: 0, dur: 0.9, by: name });
  }
  toast(`${emoji} ${name} ปาของใส่ ${tgt.me ? 'คุณ' : tgt.name}!`, '#fff3e0');
  beep(500, 0.2, 'triangle', 0.1, 300);
}
function dropTrap(r) {
  const type = pick(['banana', 'nails', 'oil']);
  S.objects.push({ kind: 'obst', type, z: r.z - 700, x: r.x, w: OB[type].w, dodge: S.rivals.map(() => Math.random() < 0.75), dropped: true });
  toast(`${OB[type].icon} ${r.name} ทิ้ง${OB[type].name}ไว้ข้างหลัง!`, '#ffe0b2');
}
function prankTarget(t, byName) {
  const what = pick(PRANKS);
  camFocus(t.me ? PLAYER_REF : t);
  if (t.me) {
    S.trickQ.unshift({ action: 'crash', user: byName });
    comic('โดนแกล้ง!!', '#ff8a80');
  } else {
    t.fallT = 2.6; t.speed *= 0.25; t.slowT = 3.5;
    later(1, () => say(t, pick(TALK.victim), true));
  }
  banner(`🍌 ${byName} แกล้ง ${t.me ? 'คุณ' : t.name}!`, `${what} — ล้มกลิ้ง!`);
  sfx.good();
}
function doCheat(r) {
  const pz = S.position + PLAYER_Z;
  const all = racers().filter(o => o !== r);
  const ahead = all.filter(o => o.z > r.z && o.z - r.z < 40 * U_PER_M).sort((a, b) => a.z - b.z)[0];
  const nearby = all.filter(o => Math.abs(o.z - r.z) < 6 * U_PER_M)[0];
  const opts = ['motor', 'shortcut'];
  if (ahead) opts.push('throw', 'throw', 'grab');
  if (nearby) opts.push('shove', 'shove');
  if (r.z > pz + 8 * U_PER_M) opts.push('drop', 'drop');
  const type = pick(opts);
  let victim = null;
  camFocus(r);
  switch (type) {
    case 'throw': throwAt(r, ahead); victim = ahead; break;
    case 'grab': affect(ahead, 'grab', r); r.boostT = Math.max(r.boostT, 1.5); victim = ahead; toast(`🫳 ${r.name} ดึงเสื้อ ${ahead.name}!`, '#ffccbc'); break;
    case 'shove': affect(nearby, 'shove', r); victim = nearby; toast(`🤜 ${r.name} ผลัก ${nearby.name}!`, '#ffccbc'); break;
    case 'drop': dropTrap(r); break;
    case 'motor': r.motorT = 4; toast(`⚡ ${r.name} แอบใช้มอเตอร์ไฟฟ้า!`, '#fff59d'); break;
    case 'shortcut': r.z += 15 * U_PER_M; r.x = r.tx = (Math.random() < 0.5 ? -0.8 : 0.8); toast(`🌀 ${r.name} ตัดทางลัด! ขี้โกง!`, '#e1bee7'); break;
  }
  comic(victim && victim.me ? 'โดนโกง!!' : 'โกง!!', '#ff8a80');
  sfx.boo();
  say(r, pick(TALK.cheat), true);
  if (victim && !victim.me) later(1.3, () => say(victim, pick(TALK.victim), true));
}

// ---------------------------------------------------------- objects
function spawnObjects() {
  const base = playerSegIdx();
  const until = base + DRAW - 5;
  if (S.nextSpawn < base + 20) S.nextSpawn = base + 20;
  const d = DIFFS[S.diff];
  while (S.nextSpawn < until) {
    const i = S.nextSpawn++;
    const sg = getSeg(i), sc = sg.scene;
    if (sg.kick) {   // ปากโนนดิน: วางทุกโนน ไม่สุ่ม
      S.objects.push({ kind: 'obst', type: 'kicker', z: i * SEG_L + SEG_L * 0.5, x: 0, w: OB.kicker.w, size: sg.kick.size, dodge: S.rivals.map(() => false) });
      S.lastSpawnSeg = i;
      continue;
    }
    if (i < 120 || i - S.lastSpawnSeg < 7 || (sg.sec && sg.sec.kicks)) continue;
    const r = Math.random();
    const z = i * SEG_L + SEG_L / 2;
    if (r < d.obst) {
      const so = SURFACES[sg.surf].obst || [];
      const list = sc.obst.concat(WEATHER_OBST[S.wCur] || [], so, so);   // สิ่งกีดขวางตามพื้นผิวช่วงทาง
      const type = list[Math.floor(Math.random() * list.length)];
      const wide = OB[type].w > 0.9;   // ลูกระนาด/ลำธาร ขวางทั้งทาง หลบไม่ได้
      S.objects.push({ kind: 'obst', type, z, x: wide ? 0 : -0.72 + Math.random() * 1.44, w: OB[type].w, dodge: S.rivals.map(() => Math.random() < 0.9) });
      if (!wide && S.diff >= 2 && Math.random() < 0.35) {
        const narrow = sc.obst.filter(t => OB[t].w <= 0.9);
        const t2 = narrow[Math.floor(Math.random() * narrow.length)];
        const last = S.objects[S.objects.length - 1];
        S.objects.push({ kind: 'obst', type: t2, z, x: clamp(-last.x + (Math.random() - 0.5) * 0.3, -0.8, 0.8), w: OB[t2].w, dodge: S.rivals.map(() => Math.random() < 0.9) });
      }
      S.lastSpawnSeg = i;
    } else if (r < d.obst + d.item) {
      const type = pickWeighted(ITEM_W, Math.random());
      const x = type === 'tent' ? (Math.random() < 0.5 ? -0.82 : 0.82) : -0.7 + Math.random() * 1.4;
      S.objects.push({ kind: 'item', type, z, x, w: type === 'tent' ? 0.26 : 0.2, food: FOODS[Math.floor(Math.random() * FOODS.length)] });
      S.lastSpawnSeg = i;
    }
  }
  S.objects = S.objects.filter(o => o.z > S.position - 4000);   // เก็บไว้ให้กล้องด้านหลังยังเห็น
}
function collide() {
  const pz = S.position + PLAYER_Z;
  const eff = effTotals();
  for (const o of S.objects) {
    if (o.done) continue;
    if (o.z > S.prevPZ && o.z <= pz) {
      o.done = true;
      if (Math.abs(o.x - S.playerX) >= o.w + 0.1) continue;
      o.taken = true;
      if (o.kind === 'item') takeItem(o);
      else hitObstacle(o, eff);
    }
  }
}
function hitObstacle(o, eff) {
  const def = OB[o.type];
  if (def.fx === 'air') {
    // ยิ่งโนนใหญ่และปั่นเร็ว ยิ่งลอยสูงและนาน
    if (S.jumpT > 0.15) return;   // ยังลอยอยู่ ข้ามโนนนี้ไปเลย
    const sz = o.size || 0.5, sp = clamp(0.4 + S.speed / MAX_SPEED, 0.5, 1.4);
    S.jumpT = S.jumpDur = (0.6 + sz * 1.0) * sp;
    S.jumpH = (300 + sz * 1100) * sp;
    S.airBig = sz;
    S.speed = Math.min(S.speed * 1.04, TOP_SPEED);
    floater(sz > 0.95 ? '🛫 โนนยักษ์! ลอยสูงมาก' : sz > 0.6 ? '🛫 ลอยกระโดด!' : '🦘 เด้งข้ามโนน', '#fff59d');
    sfx.boost();
    return;
  }
  if (def.bad && S.jumpT > 0) { floater('ลอยข้าม! 🤸', '#fff59d'); return; }
  if (def.bad && eff.shield) { floater('🛡️ กันไว้ได้!', '#80d8ff'); beep(1200, 0.08, 'triangle', 0.1); return; }
  if (def.fx === 'hit' && o.type === 'bump') {   // ลูกระนาดขวางทั้งทาง หลบไม่ได้ → แค่สะเทือน
    S.speed *= def.keep; S.shake = 0.6;
    toast(def.label, '#ffe0b2');
  } else if (def.fx === 'hit') {
    // ชนสิ่งกีดขวาง → หยุดนิ่ง แล้วออกตัวปั่นใหม่จาก 0
    S.speed = 0;
    S.stopT = 1.6 + def.dmg / 10;
    S.health = Math.max(0, S.health - def.dmg);
    S.shake = 1; S.hitFlash = 1;
    banner(`💥 ${def.label}`, 'หยุดกึก! ตั้งหลักแล้วปั่นใหม่');
    comic('ชน!!', '#ff8a80');
    sfx.hit();
  } else if (def.fx === 'slow') {
    addEffect({ key: o.type, icon: def.draw === 'mud' ? '🟫' : def.draw === 'sand' ? '🏖️' : '💦', label: def.label, dur: def.dur, maxMult: def.mult });
    S.speed *= 0.85; S.shake = 0.5;
    if (def.splash) { S.splashT = 1; sfx.splash(); } else sfx.bad();
    toast(def.label, '#ffe0b2');
  } else if (def.fx === 'slip') {
    addEffect({ key: 'slip', icon: '🧊', label: def.label, dur: def.dur, maxMult: def.mult, slip: true });
    S.steerVel += (Math.random() < 0.5 ? -1 : 1) * 1.6;
    toast(def.label, '#b3e5fc');
    sfx.bad();
  } else if (def.fx === 'boost') {
    addEffect({ key: 'boost', icon: '⚡', label: 'เร่ง', dur: def.dur, maxMult: def.mult, accel: 2 });
    S.speed = Math.min(S.speed + MAX_SPEED * 0.25, TOP_SPEED * 0.85);
    S.boostFlash = 1;
    if (def.jump) { S.jumpT = S.jumpDur = 0.9; S.jumpH = 260; }
    toast(def.label, '#b9f6ca');
    sfx.boost();
  }
}
function takeItem(o) {
  sfx.pick();
  if (o.type === 'water') { S.water = Math.min(100, S.water + 40); floater('+40 💧 ขวดน้ำ', '#80d8ff'); }
  else if (o.type === 'food') { S.energy = Math.min(100, S.energy + 40); floater(`+40 ⚡ ${o.food} อาหาร`, '#ffe57f'); }
  else if (o.type === 'med') {
    S.health = Math.min(100, S.health + 35);
    S.effects = S.effects.filter(e => !(e.maxMult < 1 || e.reverse || e.accel < 1 || e.slip));
    floater('+35 ❤️ ยา (ล้างอาการแย่)', '#ff80ab');
  } else if (o.type === 'tent') {
    S.sleepT = 4.5;
    toast('⛺ พักนอน... ฟื้นพลัง', '#d1c4e9');
  } else if (o.type === 'gift') {
    const good = Math.random() < 0.6;
    const pool = GIFTS.filter(g => g.good === good);
    const g = pool[Math.floor(Math.random() * pool.length)];
    if (g.instant) { S.energy = 100; S.water = 100; S.health = Math.min(100, S.health + 30); }
    else addEffect({ key: g.key, icon: g.icon, label: g.label, dur: g.dur, maxMult: g.maxMult, accel: g.accel, shield: g.shield, noDrain: g.noDrain, reverse: g.reverse });
    if (g.hitSpeed) S.speed *= g.hitSpeed;
    if (g.key === 'turbo') { S.boostFlash = 1; S.speed = Math.max(S.speed, MAX_SPEED); }
    banner(`🎁 ${g.icon} ${g.label}`, good ? 'โชคดี!' : 'โชคร้าย!');
    good ? sfx.good() : sfx.bad();
  }
}

// ---------------------------------------------------------- player
function updatePlayer(dt) {
  const pz = S.position + PLAYER_Z;
  const si = Math.floor(pz / SEG_L), seg = getSeg(si), nseg = getSeg(si + 1);
  const slope = (nseg.y - seg.y) / SEG_L;
  S.slope = slope;
  // แจ้งเตือนทางขึ้น-ลงเขาชัน
  const hillState = slope > 0.12 ? 1 : slope < -0.12 ? -1 : 0;
  if (hillState && hillState !== S.hillState && S.gt - (S.hillMsgT || -99) > 6) {
    toast(hillState > 0 ? '⛰️ ทางขึ้นเขาชัน! ช้าลง' : '🎢 ทางลงเขา! ความเร็วพุ่ง', hillState > 0 ? '#ffccbc' : '#c8e6c9');
    S.hillMsgT = S.gt;
  }
  S.hillState = hillState;
  // ช่วงทาง: แจ้งเมื่อเข้าช่วงใหม่ + เตือนล่วงหน้าช่วงอันตราย
  const sec = seg.sec;
  if (sec && sec.id !== S.secId) {
    S.secId = sec.id; S.curSec = sec;
    if (sec.id > 0 && sectionLabel(sec)) toast(sectionLabel(sec), sec.terrain === 'cliff' || sec.width === 'narrow' ? '#ffccbc' : '#e1f5fe');
  }
  if (sec && sec.len < 1e9) {
    const nx = sectionAt(sec.from + sec.len);
    if (nx.id !== S.warnId && nx.from - si < 90 && (nx.terrain === 'cliff' || nx.terrain === 'water' || nx.surface === 'snow' || nx.surface === 'mud')) {
      S.warnId = nx.id;
      toast(`⚠️ ข้างหน้า: ${sectionLabel(nx)}`, '#fff59d');
    }
  }
  const sf = surfAt(seg);
  const eff = effTotals();
  const grip = wp('grip') * (eff.slip ? 0.35 : 1) * sf.grip;
  // แรงปั่น 0-100%: เลือกเองตามพลังที่เหลือและคู่แข่งรอบตัว (⚡ = พลังกาย)
  S.near = raceNear(racers()[0], riders());
  const lv0 = effortLv(S.pe.effort);
  if (S.stopT > 0 || S.sleepT > 0) S.pe.effort = Math.max(0, S.pe.effort - 80 * dt);
  else thinkEffort(S.pe, S.energy, dt, S.near);
  const lv = effortLv(S.pe.effort);
  if (lv !== lv0 && (lv.name === 'สู้มาก' || lv.name === 'เหนื่อย') && S.gt - (S.lvMsgT || -99) > 5) {
    floater(lv.name === 'สู้มาก' ? '🔥 สู้มาก! ปั่นสุดแรง' : '🥵 เหนื่อยแล้ว... ผ่อนแรง', lv.color);
    S.lvMsgT = S.gt;
  }
  let maxS = MAX_SPEED * wp('maxMult') * eff.maxMult * sf.speed * effortSpeed(S.pe.effort) * (S.near.draft ? 1.05 : 1);
  if (S.water < 20) maxS *= 0.85;
  if (S.health < 30) maxS *= 0.85;
  const offroad = Math.abs(S.playerX) > 1;
  if (offroad) maxS *= 0.6;
  // ขึ้นเขาช้าลง / ลงเขาเร็วขึ้น (ทางลงชันได้ถึง ~100+ km/h)
  const cap = maxS * (slope > 0 ? 1 - clamp(slope * 2.2, 0, 0.6) : 1 + clamp(-slope * 1.8, 0, 0.7));
  const crashing = S.trick && S.trick.type === 'crash';
  const stopped = S.stopT > 0;
  const wantPedal = S.sleepT <= 0 && !crashing && !stopped;   // ปั่นอัตโนมัติตลอด
  S.pedaling = wantPedal;

  if (stopped) {
    S.stopT -= dt;
    S.speed = Math.max(0, S.speed - BRAKE * 3 * dt);
    if (S.stopT <= 0) { toast('🚴 ออกตัวปั่นใหม่!', '#b9f6ca'); S.pe.effort = Math.max(S.pe.effort, 60); S.pe.effTarget = 75; S.pe.effT = 3; }
  } else if (S.sleepT > 0) {
    S.sleepT -= dt;
    S.speed = Math.max(0, S.speed - BRAKE * 1.5 * dt);
    S.energy = Math.min(100, S.energy + 25 * dt);
    S.health = Math.min(100, S.health + 8 * dt);
    S.water = Math.min(100, S.water + 6 * dt);
    if (S.sleepT <= 0) toast('☀️ ตื่นแล้ว! พร้อมลุยต่อ 💪', '#fff59d');
  } else if (wantPedal) {
    const a = ACCEL * eff.accel * effortAccel(S.pe.effort);
    if (S.speed < cap) S.speed = Math.min(cap, S.speed + a * dt);
    // คันหน้าขวางเลน → ชะลอตาม ไม่ทะลุ
    const nb = S.near.block;
    if (nb && nb.z - (pz) < (RIDER_LEN + 1.5) * U_PER_M) S.speed = Math.min(S.speed, Math.max(riderSpeed(nb), S.speed - BRAKE * dt));
  } else {
    S.speed -= DECEL * dt;
  }
  if (S.sleepT <= 0 && !crashing && !stopped && (!wantPedal || slope < 0)) S.speed -= slope * GRAV * dt * 0.6;
  if (crashing) S.speed = Math.max(0, S.speed - BRAKE * 2.2 * dt);
  if (S.speed > cap) S.speed -= (S.speed - cap) * 1.5 * dt;
  S.speed = clamp(S.speed, 0, TOP_SPEED);
  if (offroad) S.shake = Math.max(S.shake, 0.35 * S.speed / MAX_SPEED);
  const sp = S.speed / MAX_SPEED;

  let steerIn = autoPilot(dt);
  if (eff.reverse) steerIn = steerIn * 0.3 + Math.sin(S.t * 2.7) * 0.7;   // มึนงง: รถส่าย
  if (S.sleepT > 0 || S.jumpT > 0) steerIn *= 0.3;
  if (crashing) steerIn = 0;
  S.steerVel = lerp(S.steerVel, steerIn, clamp(dt * 8 * grip, 0, 1));
  S.playerX += S.steerVel * dt * 1.6 * (0.25 + 0.75 * Math.min(1, sp));
  S.playerX -= dt * 2 * Math.min(sp, 1.3) ** 2 * seg.curve * 0.11 * (1 + (1 - grip));
  S.playerX = clamp(S.playerX, -2.2, 2.2);
  // ทางเลียบเหว: หลุดขอบ = เกือบตก ดึงกลับแต่เสียความเร็ว
  if (seg.cliff && S.playerX * seg.cliff > 1.05) {
    S.playerX = seg.cliff * 0.8; S.speed *= 0.5; S.shake = 1; S.hitFlash = 0.5; S.steerVel = 0;
    if (S.gt - (S.cliffMsgT || -99) > 3) { toast('😱 เกือบตกเหว! ดึงกลับทัน', '#ffccbc'); S.cliffMsgT = S.gt; sfx.hit(); }
  }
  if (sf.shake) S.shake = Math.max(S.shake, sf.shake * Math.min(1, sp));   // ทางหินสะเทือน
  if (sf.splash && sp > 0.3) S.splashT = Math.max(S.splashT, 0.3 + 0.2 * Math.sin(S.t * 5));   // น้ำกระเซ็น
  S.steerVis = lerp(S.steerVis, S.steerVel, clamp(dt * 10, 0, 1));

  const ed = wp('energyDrain');
  if (S.pedaling) {
    const rate = staminaRate(S.pe.effort, slope, S.near.draft);
    if (rate > 0 || !eff.noDrain) S.energy += rate * (rate < 0 ? ed : 1) * dt;
  } else if (S.sleepT <= 0) S.energy += 2 * dt;
  S.water -= 0.45 * wp('waterDrain') * dt * (S.pedaling ? 1.3 : 0.7);
  if (S.water <= 0) { S.water = 0; S.health -= 1.2 * dt; }
  S.energy = clamp(S.energy, 0, 100);
  S.health = clamp(S.health, 0, 100);
  if (S.health <= 0 && S.sleepT <= 0) { S.health = 1; S.sleepT = 6; banner('😵 หมดแรง!', 'นอนพักฟื้นสักครู่...'); sfx.bad(); }

  S.prevPZ = pz;
  S.position += S.speed * dt;
  S.pedalPhase += dt * (S.pedaling ? 4 + sp * 8 : 0);
  S.wheelRot += S.speed * dt;
  S.jumpT = Math.max(0, S.jumpT - dt);
  // ลงพื้นหลังลอยจากโนน = สะเทือนตามความสูง
  if (S.wasAir && S.jumpT <= 0 && S.airBig) {
    S.shake = Math.max(S.shake, 0.35 + S.airBig * 0.7);
    beep(90 + Math.random() * 30, 0.15, 'square', 0.1, -40);
    S.airBig = 0;
  }
  S.wasAir = S.jumpT > 0;
  // ทางลงชันมาก: สั่นตามความเร็ว
  if (slope < -0.15) S.shake = Math.max(S.shake, clamp((-slope - 0.15) * 2, 0, 0.45) * Math.min(1, S.speed / MAX_SPEED));
  S.shake = Math.max(0, S.shake - dt * 2);
  S.hitFlash = Math.max(0, S.hitFlash - dt * 3);
  S.splashT = Math.max(0, S.splashT - dt * 0.8);
  S.boostFlash = Math.max(0, S.boostFlash - dt * 1.5);
  S.effects = S.effects.filter(e => e.until > S.gt);
  S.bgOff += seg.curve * S.speed * dt / SEG_L * 3;
}

// ---------------------------------------------------------- main update
let lastClean = 0;
function update(dt) {
  S.t += dt;
  musicTick();
  updateFX(dt);
  updateAdminStatus(false);
  updateCamera(dt);
  const th = thaiTime();
  checkSlots(th);
  S.wT = Math.min(1, S.wT + dt / 8);
  updateParticles(dt);
  for (const t of S.toasts) t.t += dt;
  S.toasts = S.toasts.filter(t => t.t < t.dur);
  for (const f of S.floaters) f.t += dt;
  S.floaters = S.floaters.filter(f => f.t < 1.6);
  if (S.banner && (S.banner.t += dt) > 2.8) S.banner = null;

  // แจ้งเตือนเมื่อเข้าฉากใหม่
  const ps = playerScene();
  if (S.lastScene !== ps.sid) {
    if (S.lastScene) { banner(`${ps.scene.icon} ${ps.scene.name}`, 'เข้าสู่ฉากใหม่'); }
    S.lastScene = ps.sid;
  }

  if (AC && rainGain) {
    rainGain.gain.value = (wI('rain') * 0.05) * (S.paused ? 0 : 1);
    windGain.gain.value = Math.min(0.12, (S.speed / MAX_SPEED) * 0.07 + wI('snow') * 0.03) * (S.paused || !S.started ? 0 : 1);
  }
  if (!S.started || S.paused) return;
  if (S.countdown > 0) {
    const before = Math.ceil(S.countdown);
    S.countdown -= dt;
    const after = Math.ceil(S.countdown);
    if (after !== before) beep(after > 0 ? 520 : 1040, after > 0 ? 0.18 : 0.4, 'square', 0.12);
    if (S.countdown > 0) return;
    toast('🚵 GO! ปั่นเลย!', '#b9f6ca');
  }
  S.gt += dt;
  if (SP.on) updateSpace(dt); else updatePlayer(dt);
  updateTricks(dt);
  updateRivals(dt);
  updatePack(dt);
  resolvePlayer();
  updateTelemetry(dt);
  if (!SP.on) { spawnObjects(); collide(); }
  updateRank();
  updateDirector(dt);
  if (S.gt - lastClean > 2) {
    lastClean = S.gt;
    const minSeg = Math.min(playerSegIdx(), ...S.rivals.map(r => Math.floor(r.z / SEG_L))) - 260;
    for (const k of segCache.keys()) if (k < minSeg) segCache.delete(k);
  }
}

// =====================================================================
//                               RENDER
// =====================================================================
function computeEnv() {
  const th = thaiTime(), h = th.hf;
  let top = sampleKeys(SKY_TOP, h), bot = sampleKeys(SKY_BOT, h);
  const dark = sampleKeys(DARK, h), warm = sampleKeys(WARM, h);
  const rain = wI('rain'), snow = wI('snow'), cold = wI('cold'), hot = wI('hot'), dry = wI('dry');
  const overcast = clamp(rain * 0.85 + snow * 0.8 + cold * 0.35, 0, 1);
  const grey = mix([115, 120, 130], [28, 30, 40], dark / 0.62);
  top = mix(top, grey, overcast * 0.75);
  bot = mix(bot, mix(grey, [255, 255, 255], 0.18), overcast * 0.7);
  if (hot) bot = mix(bot, [255, 214, 160], hot * 0.35 * (1 - dark));
  if (dry) { top = mix(top, [200, 180, 140], dry * 0.25 * (1 - dark)); bot = mix(bot, [225, 200, 150], dry * 0.4 * (1 - dark)); }
  if (cold) bot = mix(bot, [200, 215, 235], cold * 0.3 * (1 - dark));
  const fogD = wp('fog') + (dark > 0.4 ? 1.5 : 0);
  return { th, h, top, bot, dark, warm, overcast, fog: bot, fogD, rain, snow, cold, hot, dry };
}

function drawSky(env) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, rgb(env.top));
  g.addColorStop(1, rgb(env.bot));
  ctx.fillStyle = g;
  ctx.fillRect(-500, -600, W + 1000, HORIZON + 602);
  const h = env.h;
  // ดาว
  if (env.dark > 0.3 && env.overcast < 0.7) {
    const a = (env.dark - 0.3) * 2.5 * (1 - env.overcast);
    for (let i = 0; i < 90; i++) {
      const sx = ((hash2(i, 1) * 1600 - S.bgOff * 0.05) % W + W) % W, sy = hash2(i, 2) * HORIZON * 0.9;
      ctx.fillStyle = `rgba(255,255,255,${a * (0.4 + 0.6 * Math.abs(Math.sin(S.t * 2 + i)))})`;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
  }
  // ดวงอาทิตย์ / ดวงจันทร์
  const vis = 1 - env.overcast * 0.85;
  const par = ((-S.bgOff * 0.05) % W + W) % W;
  if (h > 5.6 && h < 18.6) {
    const t = clamp((h - 6) / 12, 0, 1);
    const sx = (W * 0.12 + W * 0.76 * t + par) % (W * 1.3) - W * 0.15;
    const sy = HORIZON - Math.sin(t * Math.PI) * (HORIZON - 80) + 10;
    const low = 1 - Math.sin(t * Math.PI);
    const core = mix([255, 250, 225], [255, 150, 70], low);
    const rad = 26 + env.hot * 10;
    const gl = ctx.createRadialGradient(sx, sy, 2, sx, sy, rad * (4 + env.hot * 3));
    gl.addColorStop(0, rgb(core, 0.9 * vis));
    gl.addColorStop(0.25, rgb(core, 0.35 * vis));
    gl.addColorStop(1, rgb(core, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(sx - 300, sy - 300, 600, 600);
    ell(sx, sy, rad, rad, rgb(core, vis));
  } else {
    const hh = h < 12 ? h + 24 : h;
    const t = clamp((hh - 18.8) / 10.8, 0, 1);
    const mx = (W * 0.15 + W * 0.7 * t + par) % (W * 1.3) - W * 0.15;
    const my = HORIZON - Math.sin(t * Math.PI) * (HORIZON - 90) + 10;
    const gl = ctx.createRadialGradient(mx, my, 2, mx, my, 110);
    gl.addColorStop(0, `rgba(220,230,255,${0.4 * vis})`);
    gl.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(mx - 120, my - 120, 240, 240);
    ell(mx, my, 20, 20, `rgba(240,240,225,${vis})`);
    ell(mx + 8, my - 5, 16, 16, rgb(env.top, vis * 0.9));
  }
  // เมฆ
  const ccol = mix(mix([255, 255, 255], [120, 125, 135], env.overcast), [40, 42, 55], env.dark / 0.62);
  const ca = 0.55 + env.overcast * 0.4;
  const n = 4 + Math.round(env.overcast * 5);
  for (let i = 0; i < n; i++) {
    const c = S.clouds[i];
    const cx = ((c.x - S.bgOff * 0.25) % 1600 + 1600) % 1600 - 300;
    const s = c.s * (1 + env.overcast * 0.8);
    for (let k = 0; k < 5; k++) ell(cx + k * 34 * s, c.y + Math.sin(k * 1.7) * 8 * s, 42 * s, 22 * s, rgb(ccol, ca));
  }
}

function drawLayer(L, offset, baseY, col, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.moveTo(-500, baseY + 2);
  const sample = x => { const u = ((x + offset * L.speed) % L.P + L.P) % L.P; return L.h[Math.floor(u / L.P * L.N)]; };
  for (let x = -500; x <= W + 500; x += 4) ctx.lineTo(x, baseY - sample(x) * L.amp);
  ctx.lineTo(W + 500, baseY + 2);
  ctx.closePath();
  ctx.fill();
  if (L.cap) {
    ctx.fillStyle = `rgba(245,248,255,${0.85})`;
    ctx.beginPath();
    let open = false;
    for (let x = -500; x <= W + 500; x += 4) {
      const v = sample(x);
      if (v > L.cap) {
        if (!open) { ctx.moveTo(x, baseY - L.cap * L.amp); open = true; }
        ctx.lineTo(x, baseY - v * L.amp);
      } else if (open) { ctx.lineTo(x, baseY - L.cap * L.amp); ctx.closePath(); open = false; }
    }
    if (open) { ctx.lineTo(W, baseY - L.cap * L.amp); ctx.closePath(); }
    ctx.fill();
  }
  if (L.wins && ENV.dark > 0.2) {
    ctx.fillStyle = `rgba(255,220,130,${(ENV.dark - 0.2) * 2})`;
    for (const w of L.wins) {
      const u = w.j / L.N * L.P;
      let x = ((u - offset * L.speed) % L.P + L.P) % L.P;
      if (x > W) continue;
      ctx.fillRect(x, baseY - w.v * L.amp, 2.5, 3);
    }
  }
  ctx.globalAlpha = 1;
}
function drawBackground(env) {
  const pIdx = playerSegIdx();
  const k = sceneIndexAt(pIdx);
  const t = k > 0 ? clamp((pIdx - sceneChanges[k].from) / 80, 0, 1) : 1;
  const cur = SCENES[sceneChanges[k].id];
  const prev = k > 0 ? SCENES[sceneChanges[k - 1].id] : null;
  const baseY = HORIZON + 1;
  const layerSet = (sc, a) => {
    if (a <= 0.01) return;
    if (sc.sea) {
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(0, HORIZON - 4, 0, H);
      g.addColorStop(0, rgb(mix([60, 130, 180], env.fog, 0.45)));
      g.addColorStop(1, rgb(mix([20, 80, 140], env.fog, 0.15)));
      ctx.fillStyle = g;
      ctx.fillRect(-500, HORIZON - 4, W + 1000, H - HORIZON + 600);
      ctx.globalAlpha = 1;
    }
    for (const L of LAYERS[sc.bg]) {
      let col = mix(L.color, env.fog, L.haze);
      if (env.snow > 0.2 && sc.bg !== 'city' && sc.bg !== 'sea') col = mix(col, [230, 235, 245], env.snow * 0.5);
      drawLayer(L, S.bgOff, baseY - (sc.sea ? 4 : 0), col, a);
    }
  };
  if (prev && t < 1) layerSet(prev, 1);
  layerSet(cur, prev ? t : 1);
}

// ----------------------------------------------------------- road
function project(p, camX, camY, camZ, wy, wz, wm = 1) {
  const cz = wz - camZ;
  p.cz = cz;
  if (cz <= 1) { p.scale = 0; return; }
  const sc = CAM_D / cz;
  p.scale = sc;
  p.x = W / 2 - sc * camX * W / 2;
  p.y = HORIZON - sc * (wy - camY) * W / 2;
  p.w = sc * ROAD_W * wm * W / 2;
}
function surfColor(key, base) {
  const sf = SURFACES[key];
  return sf && sf.col ? mix(base, sf.col, 0.8) : base;
}
function drawSegment(s, env) {
  const p1 = s.p1, p2 = s.p2, sc = s.scene, st = s.stripe;
  const fog = s.fog;
  const sh = (c, grass) => {
    let col = c;
    if (env.snow > 0.05) col = mix(col, [236, 240, 248], env.snow * (grass ? 0.8 : 0.35));
    if (env.rain > 0.05 && !grass) col = mix(col, [col[0] * 0.75, col[1] * 0.75, col[2] * 0.8], env.rain);
    return rgb(mix(col, env.fog, 1 - fog));
  };
  // พื้นผิวของช่วงทาง (ผสมจากช่วงก่อนหน้าตรงรอยต่อ)
  const sCur = s.surf !== 'normal' ? s.sb : 0, sPrev = s.psurf !== 'normal' ? 1 - s.sb : 0, ns = sCur + sPrev;
  const roadBase = sc.road[st];
  const roadC = ns > 0 ? mix(surfColor(s.psurf, roadBase), surfColor(s.surf, roadBase), s.sb) : roadBase;
  const snowAmt = (s.surf === 'snow' ? sCur : 0) + (s.psurf === 'snow' ? sPrev : 0);
  let grassC = sc.grass[st];
  if (snowAmt > 0) grassC = mix(grassC, [238, 242, 250], snowAmt * 0.7);
  if (s.wet > 0) grassC = mix(grassC, st ? [38, 108, 158] : [44, 120, 170], s.wet);   // ทางน้ำ: สองข้างเป็นน้ำ
  ctx.fillStyle = sh(grassC, true);
  ctx.fillRect(-500, p2.y, W + 1000, p1.y - p2.y + 1);
  if (sc.sea) {
    const o1 = p1.x - MIR * p1.w * 3.2, o2 = p2.x - MIR * p2.w * 3.2, far = MIR > 0 ? -500 : W + 500;
    poly([far, p1.y + 1, o1, p1.y + 1, o2, p2.y, far, p2.y], rgb(mix(st ? [30, 110, 170] : [36, 120, 180], env.fog, 1 - fog)));
    poly([o1, p1.y + 1, o1 + MIR * p1.w * 0.18, p1.y + 1, o2 + MIR * p2.w * 0.18, p2.y, o2, p2.y], rgb(mix([240, 248, 255], env.fog, 1 - fog), 0.8));
  }
  if (s.cliff) {
    const cs = s.cliff * MIR;   // ฝั่งที่เป็นเหว
    const e1 = p1.x + cs * p1.w * (1 + sc.rumbleW * 1.5), e2 = p2.x + cs * p2.w * (1 + sc.rumbleW * 1.5), far = cs > 0 ? W + 500 : -500;
    poly([far, p1.y + 1, e1, p1.y + 1, e2, p2.y, far, p2.y], rgb(mix(st ? [26, 28, 40] : [32, 34, 48], env.fog, (1 - fog) * 0.8)));
    poly([e1 - cs * p1.w * 0.06, p1.y + 1, e1, p1.y + 1, e2, p2.y, e2 - cs * p2.w * 0.06, p2.y], rgb(mix([90, 84, 78], env.fog, 1 - fog)));
  }
  if (sc.bridge) {
    const wc = rgb(mix(st ? [30, 100, 150] : [36, 112, 165], env.fog, 1 - fog));
    const l1 = p1.x - p1.w * 1.25, l2 = p2.x - p2.w * 1.25, q1 = p1.x + p1.w * 1.25, q2 = p2.x + p2.w * 1.25;
    poly([-500, p1.y + 1, l1, p1.y + 1, l2, p2.y, -500, p2.y], wc);
    poly([q1, p1.y + 1, W + 500, p1.y + 1, W + 500, p2.y, q2, p2.y], wc);
  }
  const r1 = p1.w * sc.rumbleW, r2 = p2.w * sc.rumbleW;
  const rc = sh(ns > 0 ? mix(sc.rumble[st], roadC, ns * 0.4) : sc.rumble[st], false);
  poly([p1.x - p1.w - r1, p1.y + 1, p1.x - p1.w, p1.y + 1, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y], rc);
  poly([p1.x + p1.w + r1, p1.y + 1, p1.x + p1.w, p1.y + 1, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y], rc);
  poly([p1.x - p1.w, p1.y + 1, p1.x + p1.w, p1.y + 1, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y], sh(roadC, false));
  const nl = s.lanes || 1;
  if (nl >= 2) {
    // เส้นแบ่งเลน (ประ) ตามจำนวนเลน 2-4
    if (st === 0 || sc.laneSolid) {
      const lc = sc.lane && ns < 0.5 ? sh(sc.lane, false) : rgb(mix([245, 240, 225], env.fog, 1 - fog), 0.7);
      const l1 = p1.w * 0.022 * 2 / nl + 0.4, l2 = p2.w * 0.022 * 2 / nl + 0.4;
      for (let q = 1; q < nl; q++) {
        const o = -1 + 2 * q / nl, a1 = p1.x + p1.w * o, a2 = p2.x + p2.w * o;
        poly([a1 - l1, p1.y + 1, a1 + l1, p1.y + 1, a2 + l2, p2.y, a2 - l2, p2.y], lc);
      }
    }
  } else if (sc.lane && ns < 0.5) {
    // ถนน 1 เลน: เส้นขอบทางสองข้าง
    const l1 = p1.w * 0.03, l2 = p2.w * 0.03, lc = sh(sc.lane, false);
    for (const o of [-0.92, 0.92]) {
      const a1 = p1.x + p1.w * o, a2 = p2.x + p2.w * o;
      poly([a1 - l1, p1.y + 1, a1 + l1, p1.y + 1, a2 + l2, p2.y, a2 - l2, p2.y], lc);
    }
  } else {
    const rutBase = sc.rut || mix(sc.road[0], [0, 0, 0], 0.15);
    let rut = st ? rutBase : mix(rutBase, sc.road[0], 0.4);
    if (ns > 0) rut = mix(rut, roadC.map(v => v * 0.86), ns * 0.8);
    const rc2 = sh(rut, false);
    for (const o of [-0.35, 0.35]) {
      const a1 = p1.x + p1.w * o, a2 = p2.x + p2.w * o, l1 = p1.w * 0.07, l2 = p2.w * 0.07;
      poly([a1 - l1, p1.y + 1, a1 + l1, p1.y + 1, a2 + l2, p2.y, a2 - l2, p2.y], rc2);
    }
  }
  const cur = s.sb > 0.5 ? s.surf : s.psurf;
  if (cur === 'water' && st === 0) {   // ประกายน้ำ
    const o = (hash2(s.i, 61) - 0.5) * 1.4, a1 = p1.x + p1.w * o * MIR, a2 = p2.x + p2.w * o * MIR, l1 = p1.w * 0.12, l2 = p2.w * 0.12;
    poly([a1 - l1, p1.y + 1, a1 + l1, p1.y + 1, a2 + l2, p2.y, a2 - l2, p2.y], rgb(mix([190, 225, 250], env.fog, 1 - fog), 0.45));
  } else if (cur === 'rock' && p1.w > 12) {   // ก้อนหินกรวด
    for (let q = 0; q < 3; q++) {
      const o = (hash2(s.i, 70 + q) - 0.5) * 1.8, f = hash2(s.i, 80 + q);
      const w = lerp(p1.w, p2.w, f);
      ell(lerp(p1.x, p2.x, f) + w * o * MIR, lerp(p1.y, p2.y, f), w * 0.035, w * 0.016, rgb(mix([84, 78, 70], env.fog, 1 - fog)));
    }
  } else if (cur === 'sand' && st === 0 && p1.w > 12) {   // ลอนทราย
    const o = (hash2(s.i, 64) - 0.5) * 1.2, a = p1.x + p1.w * o * MIR;
    ell(a, p1.y, p1.w * 0.22, Math.max(1, (p1.y - p2.y) * 0.25), rgb(mix([240, 220, 170], env.fog, 1 - fog), 0.6));
  }
}

// ----------------------------------------------------------- sprites
function tri(x1, y1, x2, y2, x3, y3, col) { poly([x1, y1, x2, y2, x3, y3], col); }
const LIGHTS = [];
function drawDeco(d, x, y, k) {
  const v = d.v, snow = ENV.snow > 0.3;
  switch (d.type) {
    case 'pine': {
      const h = (2200 + v * 1600) * k, w = h * 0.42;
      ctx.fillStyle = '#4a3020'; ctx.fillRect(x - w * 0.06, y - h * 0.22, w * 0.12, h * 0.22);
      const cols = v < 0.5 ? ['#1d4a2c', '#24583a', '#2d6a45'] : ['#173f25', '#1f5130', '#2a6138'];
      for (let t = 0; t < 3; t++) {
        const bot = y - h * (0.16 + 0.25 * t), top = y - h * (0.5 + 0.25 * t), half = w / 2 * (1 - 0.24 * t);
        tri(x, top, x - half, bot, x + half, bot, cols[t]);
        if (snow) tri(x, top, x - half * 0.45, top + (bot - top) * 0.45, x + half * 0.45, top + (bot - top) * 0.45, '#f2f6fb');
      }
      break;
    }
    case 'tree': {
      const h = (1800 + v * 1200) * k, r = h * 0.3;
      ctx.fillStyle = '#5b3a22'; ctx.fillRect(x - h * 0.04, y - h * 0.55, h * 0.08, h * 0.55);
      const g = v < 0.5 ? ['#2e7d32', '#388e3c', '#43a047'] : ['#33691e', '#558b2f', '#689f38'];
      ell(x - r * 0.55, y - h * 0.58, r * 0.75, r * 0.7, g[0]);
      ell(x + r * 0.55, y - h * 0.6, r * 0.75, r * 0.7, g[0]);
      ell(x, y - h * 0.72, r, r * 0.85, g[1]);
      ell(x - r * 0.25, y - h * 0.8, r * 0.5, r * 0.4, g[2]);
      if (snow) ell(x, y - h * 0.9, r * 0.7, r * 0.25, '#f2f6fb');
      break;
    }
    case 'bush': {
      const s = (500 + v * 400) * k;
      ell(x - s * 0.4, y - s * 0.35, s * 0.55, s * 0.4, '#2e6b2f');
      ell(x + s * 0.4, y - s * 0.35, s * 0.55, s * 0.4, '#2e6b2f');
      ell(x, y - s * 0.5, s * 0.6, s * 0.5, snow ? '#e8eef4' : '#3b8a3c');
      break;
    }
    case 'palm': {
      const h = (2000 + v * 1200) * k, dir = v < 0.5 ? -1 : 1;
      ctx.strokeStyle = '#8d6e4c'; ctx.lineWidth = Math.max(1, h * 0.05); ctx.lineCap = 'round';
      const tx = x + dir * h * 0.18, ty = y - h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - dir * h * 0.08, y - h * 0.5, tx, ty); ctx.stroke();
      ctx.strokeStyle = '#2e8b3e'; ctx.lineWidth = Math.max(1, h * 0.045);
      for (let a = 0; a < 7; a++) {
        const ang = -Math.PI + a * Math.PI / 6;
        const ex = tx + Math.cos(ang) * h * 0.38, ey = ty + Math.sin(ang) * h * 0.18 + h * 0.12;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, ty - h * 0.12, ex, ey); ctx.stroke();
      }
      ell(tx, ty + h * 0.03, h * 0.04, h * 0.04, '#6d4c2f');
      ctx.lineCap = 'butt';
      break;
    }
    case 'rock': {
      const s = (380 + v * 300) * k;
      poly([x - s, y, x - s * 0.7, y - s * 0.6, x - s * 0.1, y - s * 0.85, x + s * 0.6, y - s * 0.55, x + s, y], '#7d7a76');
      poly([x - s * 0.1, y - s * 0.85, x + s * 0.6, y - s * 0.55, x + s * 0.2, y - s * 0.3], '#99958f');
      if (snow) poly([x - s * 0.7, y - s * 0.6, x - s * 0.1, y - s * 0.85, x + s * 0.6, y - s * 0.55, x, y - s * 0.6], '#f2f6fb');
      break;
    }
    case 'boulder': {
      const s = (800 + v * 500) * k;
      ell(x, y - s * 0.5, s, s * 0.6, '#6f6b66');
      ell(x - s * 0.3, y - s * 0.75, s * 0.45, s * 0.25, '#8a857f');
      ell(x + s * 0.2, y - s * 0.95, s * 0.5, s * 0.15, snow ? '#f2f6fb' : '#5d7a3a');
      break;
    }
    case 'sign': {
      const h = 1000 * k;
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x - h * 0.03, y - h, h * 0.06, h);
      poly([x, y - h * 1.25, x + h * 0.25, y - h, x, y - h * 0.75, x - h * 0.25, y - h], '#fbc02d');
      if (h > 20) textC('!', x, y - h, '#222', Math.max(6, h * 0.3), 800);
      break;
    }
    case 'umbrella': {
      const h = 1300 * k;
      ctx.fillStyle = '#eee'; ctx.fillRect(x - h * 0.02, y - h, h * 0.04, h);
      const cols = ['#e53935', '#fff', '#1e88e5', '#fff', '#e53935', '#fff'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[(i + Math.floor(v * 3)) % 6];
        ctx.beginPath(); ctx.moveTo(x, y - h * 1.05);
        ctx.arc(x, y - h * 0.85, h * 0.6, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6);
        ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'pole': {
      const h = 2600 * k;
      ctx.fillStyle = '#6d5440'; ctx.fillRect(x - h * 0.02, y - h, h * 0.04, h);
      ctx.fillRect(x - h * 0.16, y - h * 0.92, h * 0.32, h * 0.025);
      break;
    }
    case 'fence': {
      const h = 400 * k, w = 1200 * k;
      ctx.fillStyle = snow ? '#e8e4dc' : '#a1887f';
      for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * w / 4 - h * 0.05, y - h, h * 0.1, h);
      ctx.fillRect(x - w / 2, y - h * 0.85, w, h * 0.12);
      ctx.fillRect(x - w / 2, y - h * 0.45, w, h * 0.12);
      break;
    }
    case 'house': {
      const w = (1400 + v * 600) * k, h = w * 0.7;
      const wall = ['#ffe0b2', '#d7ccc8', '#c5e1a5', '#b3e5fc'][Math.floor(v * 4)];
      ctx.fillStyle = wall; ctx.fillRect(x - w / 2, y - h, w, h);
      tri(x - w * 0.6, y - h, x + w * 0.6, y - h, x, y - h * 1.6, snow ? '#f2f6fb' : '#b23c17');
      ctx.fillStyle = '#5d4037'; ctx.fillRect(x - w * 0.1, y - h * 0.55, w * 0.2, h * 0.55);
      ctx.fillStyle = ENV.dark > 0.25 ? '#ffd54f' : '#90caf9';
      ctx.fillRect(x - w * 0.38, y - h * 0.7, w * 0.18, h * 0.22);
      ctx.fillRect(x + w * 0.2, y - h * 0.7, w * 0.18, h * 0.22);
      if (ENV.dark > 0.25) LIGHTS.push({ x: x - w * 0.29, y: y - h * 0.6, r: w * 0.4, c: '255,200,100' });
      break;
    }
    case 'building': {
      const w = d.bw * k, h = d.bh * k;
      const cols = [[96, 110, 130], [140, 130, 120], [80, 90, 110], [170, 160, 150], [110, 120, 105]];
      let c = cols[Math.floor(v * 5) % 5];
      if (snow) c = mix(c, [230, 235, 245], 0.2);
      ctx.fillStyle = rgb(c); ctx.fillRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - w / 2, y - h, w, h * 0.03);
      if (snow) { ctx.fillStyle = '#f2f6fb'; ctx.fillRect(x - w / 2, y - h, w, h * 0.015); }
      if (w > 24) {
        const nx = Math.max(2, Math.round(d.bw / 450)), ny = Math.max(3, Math.round(d.bh / 600));
        const cw = w / nx, ch = h / ny, lit = ENV.dark > 0.25, seed = Math.floor(v * 99991);
        for (let iy = 0; iy < ny - 1; iy++) {
          for (let ix = 0; ix < nx; ix++) {
            const hv = hash2(ix * 31 + iy * 7, seed);
            ctx.fillStyle = lit && hv < 0.5 ? `rgb(255,${200 + hv * 100 | 0},120)` : lit ? '#1b2333' : (hv < 0.3 ? '#b3cde0' : '#40556e');
            ctx.fillRect(x - w / 2 + ix * cw + cw * 0.22, y - h + ch * 0.5 + iy * ch, cw * 0.56, ch * 0.5);
          }
        }
      }
      break;
    }
    case 'snowpine': {
      const save = ENV.snow; ENV.snow = 1;
      drawDeco({ type: 'pine', v }, x, y, k);
      ENV.snow = save;
      break;
    }
    case 'cactus': {
      const h = (900 + v * 700) * k, w = h * 0.16, col = '#3d8b40';
      rr(x - w / 2, y - h, w, h, w / 2, col);
      rr(x - w * 1.9, y - h * 0.62, w * 0.8, h * 0.32, w * 0.4, col);
      rr(x - w * 1.9, y - h * 0.42, w * 1.6, w * 0.7, w * 0.35, col);
      rr(x + w * 1.1, y - h * 0.78, w * 0.8, h * 0.36, w * 0.4, col);
      rr(x + w * 0.3, y - h * 0.5, w * 1.6, w * 0.7, w * 0.35, col);
      break;
    }
    case 'dune': ell(x, y - 120 * k, (900 + v * 600) * k, (200 + v * 120) * k, '#e8c98e'); break;
    case 'flower': {
      const s = (260 + v * 200) * k;
      const cols = ['#e91e63', '#ffeb3b', '#ff5722', '#9c27b0', '#ffffff', '#03a9f4'];
      ell(x, y - s * 0.2, s * 1.2, s * 0.35, '#2e7d32');
      for (let i = 0; i < 7; i++)
        ell(x + (hash2(i, Math.floor(v * 999)) - 0.5) * s * 2, y - s * (0.3 + hash2(i, 7) * 0.4), s * 0.17, s * 0.17, cols[(i + Math.floor(v * 6)) % 6]);
      break;
    }
    case 'bench': {
      const w = 700 * k, h = 300 * k;
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(x - w / 2, y - h * 0.6, w, h * 0.14);
      ctx.fillRect(x - w / 2, y - h, w, h * 0.12);
      ctx.fillRect(x - w * 0.45, y - h * 0.6, w * 0.05, h * 0.6);
      ctx.fillRect(x + w * 0.4, y - h * 0.6, w * 0.05, h * 0.6);
      break;
    }
    case 'fountain': {
      const w = 900 * k;
      ell(x, y - w * 0.08, w * 0.6, w * 0.14, '#9e9e9e');
      ell(x, y - w * 0.12, w * 0.5, w * 0.09, '#64b5f6');
      ctx.fillStyle = '#bdbdbd'; ctx.fillRect(x - w * 0.05, y - w * 0.5, w * 0.1, w * 0.4);
      ctx.strokeStyle = 'rgba(180,220,255,0.85)'; ctx.lineWidth = Math.max(1, w * 0.02);
      for (const dir of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(x, y - w * 0.5);
        ctx.quadraticCurveTo(x + dir * w * 0.25, y - w * (0.75 + Math.sin(S.t * 5) * 0.03), x + dir * w * 0.42, y - w * 0.14);
        ctx.stroke();
      }
      break;
    }
    case 'temple': {
      const w = (2600 + v * 1200) * k, h = w * 0.9;
      ctx.fillStyle = '#f5f0e6'; ctx.fillRect(x - w * 0.42, y - h * 0.38, w * 0.84, h * 0.38);
      ctx.fillStyle = '#b71c1c'; ctx.fillRect(x - w * 0.08, y - h * 0.3, w * 0.16, h * 0.3);
      for (let t = 0; t < 3; t++) {
        const ww = w * (0.6 - t * 0.14), yb = y - h * (0.38 + t * 0.17), yt = yb - h * 0.2;
        poly([x - ww, yb, x + ww, yb, x + ww * 0.55, yt, x - ww * 0.55, yt], t % 2 ? '#c62828' : '#d84315');
        ctx.fillStyle = '#ffca28'; ctx.fillRect(x - ww, yb - h * 0.012, ww * 2, h * 0.024);
      }
      poly([x - w * 0.03, y - h * 0.89, x + w * 0.03, y - h * 0.89, x, y - h * 1.15], '#ffca28');
      if (ENV.dark > 0.25) LIGHTS.push({ x, y: y - h * 0.5, r: w * 0.6, c: '255,200,90' });
      break;
    }
    case 'hut': {
      const w = (1100 + v * 400) * k, h = w * 0.9;
      ctx.fillStyle = '#6d4c41';
      for (const dx of [-0.4, 0.4]) ctx.fillRect(x + dx * w - w * 0.03, y - h * 0.45, w * 0.06, h * 0.45);
      ctx.fillStyle = '#a1887f'; ctx.fillRect(x - w * 0.45, y - h * 0.62, w * 0.9, h * 0.2);
      poly([x - w * 0.6, y - h * 0.6, x + w * 0.6, y - h * 0.6, x, y - h], snow ? '#f2f6fb' : '#c8a165');
      break;
    }
    case 'scarecrow': {
      const h = 1300 * k;
      ctx.fillStyle = '#795548';
      ctx.fillRect(x - h * 0.02, y - h, h * 0.04, h);
      ctx.fillRect(x - h * 0.3, y - h * 0.75, h * 0.6, h * 0.04);
      ctx.fillStyle = '#e57373'; ctx.fillRect(x - h * 0.14, y - h * 0.78, h * 0.28, h * 0.32);
      ell(x, y - h * 0.88, h * 0.09, h * 0.09, '#ffe0b2');
      poly([x - h * 0.18, y - h * 0.93, x + h * 0.18, y - h * 0.93, x, y - h * 1.08], '#c8a165');
      break;
    }
    case 'redrock': {
      const w = (900 + v * 900) * k, h = (2000 + v * 2600) * k;
      poly([x - w * 0.5, y, x + w * 0.5, y, x + w * 0.4, y - h * 0.9, x + w * 0.3, y - h, x - w * 0.35, y - h, x - w * 0.45, y - h * 0.85], '#b5532b');
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + w * 0.15, y - h, w * 0.25, h);
      ctx.fillStyle = 'rgba(255,220,180,0.25)';
      for (let i = 1; i < 4; i++) ctx.fillRect(x - w * 0.45, y - h * i * 0.25, w * 0.9, h * 0.02);
      break;
    }
    case 'person': {
      const h = 680 * k, wave = Math.sin(S.t * 7 + v * 20) * 0.5;
      const shirt = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'][Math.floor(v * 5)];
      ctx.fillStyle = '#37474f';
      ctx.fillRect(x - h * 0.08, y - h * 0.45, h * 0.06, h * 0.45);
      ctx.fillRect(x + h * 0.02, y - h * 0.45, h * 0.06, h * 0.45);
      rr(x - h * 0.13, y - h * 0.82, h * 0.26, h * 0.4, h * 0.06, shirt);
      ell(x, y - h * 0.92, h * 0.1, h * 0.1, '#c68c5a');
      ctx.strokeStyle = '#c68c5a'; ctx.lineWidth = Math.max(1, h * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + h * 0.12, y - h * 0.75); ctx.lineTo(x + h * (0.25 + wave * 0.1), y - h * 1.05); ctx.stroke();
      ctx.lineCap = 'butt';
      break;
    }
    case 'stand': {
      // อัฒจันทร์ + ผู้ชม
      const w = 2600 * k, h = 1150 * k;
      if (w < 2) break;
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(x - w / 2, y - h, w, h);
      const rows = 5, cols = Math.min(18, Math.max(3, Math.round(w / 14)));
      const crowd = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#ffffff', '#8e24aa', '#ff7043'];
      for (let r = 0; r < rows; r++) {
        const y0 = y - h * (0.12 + r * 0.17);
        ctx.fillStyle = r % 2 ? '#78909c' : '#607d8b';
        ctx.fillRect(x - w / 2, y0 - h * 0.15, w, h * 0.15);
        if (w > 40) {
          for (let c = 0; c < cols; c++) {
            const hv = hash2(r * 37 + c, Math.floor(d.v * 9973));
            if (hv < 0.25) continue;
            const bob = Math.abs(Math.sin(S.t * 5 + hv * 20)) * h * 0.02;
            ell(x - w / 2 + (c + 0.5) * w / cols, y0 - h * 0.06 - bob, w / cols * 0.3, h * 0.05, crowd[Math.floor(hv * 7)]);
          }
        }
      }
      poly([x - w * 0.55, y - h, x + w * 0.55, y - h, x + w * 0.5, y - h * 1.12, x - w * 0.5, y - h * 1.12], '#eceff1');
      ctx.fillStyle = '#eceff1'; ctx.fillRect(x - w / 2, y - h * 0.08, w, h * 0.08);
      break;
    }
    case 'lamp': {
      const h = 2300 * k;
      ctx.fillStyle = '#37474f'; ctx.fillRect(x - h * 0.015, y - h, h * 0.03, h);
      const dir = d.off > 0 ? -1 : 1;
      ctx.fillRect(x, y - h, dir * h * 0.2, h * 0.02);
      ell(x + dir * h * 0.2, y - h * 0.97, h * 0.05, h * 0.025, ENV.dark > 0.2 ? '#fff3c4' : '#cfd8dc');
      if (ENV.dark > 0.2) LIGHTS.push({ x: x + dir * h * 0.2, y: y - h * 0.95, r: h * 0.35, c: '255,230,160' });
      break;
    }
  }
}
function drawObstacle(o, x, y, k, rw) {
  const def = OB[o.type];
  const rx = o.w * rw;
  if (def.emoji) {
    const s = def.size * k * 1.6;
    ell(x, y, s * 0.4, s * 0.08, 'rgba(0,0,0,0.3)');
    drawEmo(def.emoji, x, y + s * 0.12, s);
    return;
  }
  switch (def.draw) {
    case 'cone': {
      const h = 380 * k;
      for (const dx of [-rx * 0.5, rx * 0.5]) {
        poly([x + dx - h * 0.35, y, x + dx + h * 0.35, y, x + dx, y - h], '#ff6d00');
        poly([x + dx - h * 0.22, y - h * 0.38, x + dx + h * 0.22, y - h * 0.38, x + dx + h * 0.15, y - h * 0.58, x + dx - h * 0.15, y - h * 0.58], '#fff');
      }
      break;
    }
    case 'hole': ell(x, y, rx, rx * 0.2, '#555'); ell(x, y + rx * 0.02, rx * 0.85, rx * 0.15, '#111'); break;
    case 'mud': ell(x, y, rx, rx * 0.22, '#4e342e'); ell(x - rx * 0.3, y - rx * 0.03, rx * 0.4, rx * 0.08, '#6d4c41'); break;
    case 'puddle': ell(x, y, rx, rx * 0.2, 'rgba(70,110,150,0.85)'); ell(x - rx * 0.25, y - rx * 0.04, rx * 0.35, rx * 0.05, 'rgba(220,240,255,0.6)'); break;
    case 'sand': ell(x, y, rx, rx * 0.22, '#e6c98f'); ell(x + rx * 0.2, y - rx * 0.04, rx * 0.5, rx * 0.08, '#f3dcaa'); break;
    case 'ice': ell(x, y, rx, rx * 0.2, 'rgba(200,235,255,0.9)'); ell(x - rx * 0.2, y - rx * 0.05, rx * 0.5, rx * 0.05, '#fff'); break;
    case 'oil': ell(x, y, rx, rx * 0.2, 'rgba(20,20,25,0.85)'); ell(x - rx * 0.2, y - rx * 0.03, rx * 0.45, rx * 0.05, 'rgba(120,80,200,0.5)'); ell(x + rx * 0.25, y + rx * 0.02, rx * 0.3, rx * 0.04, 'rgba(60,200,180,0.45)'); break;
    case 'bump': {
      const hh = 90 * k;
      poly([x - rx, y, x + rx, y, x + rx * 0.97, y - hh, x - rx * 0.97, y - hh], '#424242');
      ctx.fillStyle = '#fdd835';
      for (let i = -4; i <= 4; i += 2) ctx.fillRect(x + i * rx / 5 - rx * 0.06, y - hh, rx * 0.12, hh);
      break;
    }
    case 'stream': {
      ell(x, y, rx * 1.15, rx * 0.16, 'rgba(60,130,190,0.85)');
      ctx.strokeStyle = 'rgba(230,245,255,0.7)'; ctx.lineWidth = Math.max(1, rx * 0.015);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        const yy = y + i * rx * 0.04, ph = S.t * 4 + i;
        ctx.moveTo(x - rx * 0.9, yy);
        for (let q = -0.9; q <= 0.9; q += 0.15) ctx.lineTo(x + q * rx, yy + Math.sin(q * 9 + ph) * rx * 0.012);
        ctx.stroke();
      }
      ell(x - rx * 0.5, y + rx * 0.03, rx * 0.08, rx * 0.03, '#8d8d8d');
      ell(x + rx * 0.4, y - rx * 0.04, rx * 0.06, rx * 0.025, '#9e9e9e');
      break;
    }
    case 'roots': {
      ctx.strokeStyle = '#5d4037'; ctx.lineWidth = Math.max(1, 55 * k); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - rx, y - i * rx * 0.05);
        ctx.quadraticCurveTo(x, y - rx * (0.15 + i * 0.04), x + rx, y - i * rx * 0.05 + rx * 0.03);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      break;
    }
    case 'kicker': {
      // ปากโนนดิน: เนินดินเต็มทาง ขอบบนสีอ่อน + ลายบั้งเตือน
      const sz = o.size || 0.5, hh = (120 + sz * 340) * k;
      poly([x - rx, y, x + rx, y, x + rx * 0.92, y - hh, x - rx * 0.92, y - hh], '#795548');
      poly([x - rx * 0.92, y - hh, x + rx * 0.92, y - hh, x + rx * 0.86, y - hh * 1.18, x - rx * 0.86, y - hh * 1.18], '#a1887f');
      if (rx > 20) {
        for (let q = -2; q <= 2; q++) textC('▲', x + q * rx * 0.36, y - hh * 0.5, q % 2 ? '#212121' : '#ffd600', Math.max(8, hh * 0.55), 800);
      }
      break;
    }
    case 'ramp': {
      const hh = 260 * k;
      poly([x - rx, y, x + rx, y, x + rx * 0.85, y - hh, x - rx * 0.85, y - hh], '#8d6e63');
      poly([x - rx * 0.85, y - hh, x + rx * 0.85, y - hh, x + rx * 0.75, y - hh * 1.25, x - rx * 0.75, y - hh * 1.25], '#bcaaa4');
      if (rx > 16) textC('▲', x, y - hh * 0.5, '#ffeb3b', rx * 0.4, 800);
      break;
    }
    case 'arrows': {
      ell(x, y, rx, rx * 0.22, 'rgba(0,230,118,0.45)');
      ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = Math.max(1, rx * 0.08);
      for (let i = 0; i < 3; i++) {
        const yy = y - i * rx * 0.07;
        ctx.beginPath(); ctx.moveTo(x - rx * 0.5, yy + rx * 0.04); ctx.lineTo(x, yy - rx * 0.05); ctx.lineTo(x + rx * 0.5, yy + rx * 0.04); ctx.stroke();
      }
      break;
    }
  }
}
function drawBottle(x, y, s) {
  rr(x - s * 0.18, y - s * 0.8, s * 0.36, s * 0.8, s * 0.1, 'rgba(100,180,255,0.9)', 'rgba(255,255,255,0.8)', Math.max(1, s * 0.02));
  rr(x - s * 0.12, y - s * 0.95, s * 0.24, s * 0.18, s * 0.04, '#1565c0');
  rr(x - s * 0.18, y - s * 0.55, s * 0.36, s * 0.2, 0, '#fff');
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - s * 0.12, y - s * 0.75, s * 0.06, s * 0.6);
}
function drawItem(o, x, y, k) {
  const s = (o.type === 'tent' ? 900 : 300) * k * 1.6;
  const lift = o.type === 'tent' ? 0 : (230 + Math.sin(S.t * 3 + o.z) * 50) * k;
  ell(x, y, s * 0.35, s * 0.07, 'rgba(0,0,0,0.3)');
  if (o.type !== 'tent') {
    const g = ctx.createRadialGradient(x, y - lift - s * 0.45, 1, x, y - lift - s * 0.45, s * 0.8);
    const gc = { gift: '255,213,79', water: '128,216,255', food: '255,241,118', med: '255,128,171' }[o.type];
    g.addColorStop(0, `rgba(${gc},0.7)`); g.addColorStop(1, `rgba(${gc},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - s, y - lift - s * 1.3, s * 2, s * 1.7);
  }
  if (o.type === 'water') drawBottle(x, y - lift, s);
  else if (o.type === 'gift') drawEmo('🎁', x, y - lift, s);
  else if (o.type === 'med') drawEmo('💊', x, y - lift, s);
  else if (o.type === 'food') drawEmo(o.food, x, y - lift, s);
  else if (o.type === 'tent') {
    drawEmo('⛺', x, y + s * 0.1, s);
    if (s > 40) { rr(x - s * 0.3, y - s * 1.05, s * 0.6, s * 0.18, 6, '#4527a0'); textC('พักนอน', x, y - s * 0.96, '#fff', s * 0.11, 600); }
  }
}
function drawRider(x, y, k, r) {
  if (k * 700 < 2) return;
  if (r.jumpT > 0) y -= Math.sin((1 - r.jumpT / (r.jumpMax || 1.2)) * Math.PI) * (r.jumpH || 420) * k;
  if (r.motorT > 0 || r.boostT > 0) drawEmo('🔥', x, y + 40 * k, 230 * k * (0.85 + Math.random() * 0.3));
  if (r.fallT > 0) {
    // ล้มนอนข้างทาง
    const ang = (r.idx % 2 ? 1 : -1) * Math.min(1.4, (2.6 - r.fallT) * 5);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.translate(-x, -y);
    drawRiderBody(x, y, k, r);
    ctx.restore();
    drawEmo('💫', x, y - 450 * k + Math.sin(S.t * 8) * 20 * k, 260 * k);
    drawEmo('🍌', x - (r.idx % 2 ? -1 : 1) * 260 * k, y + 40 * k, 220 * k);
  } else if (r.wheelieT > 0 || r.driftT > 0) {
    const ang = r.driftT > 0 ? r.driftDir * 0.3 : Math.sin(S.t * 6) * 0.05;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); if (r.wheelieT > 0) ctx.scale(1, 0.92); ctx.translate(-x, -y);
    if (r.wheelieT > 0) ell(x, y - 830 * k, 26 * k, 130 * k, '#111');   // ล้อหน้าลอยขึ้นเหนือหัว
    drawRiderBody(x, y, k, r);
    ctx.restore();
    if (r.driftT > 0) ell(x - r.driftDir * 160 * k, y - 40 * k, 170 * k, 60 * k, 'rgba(190,170,140,0.5)');
  } else drawRiderBody(x, y, k, r);
  if (r.motorT > 0) drawEmo('⚡', x + 130 * k, y - 600 * k, 200 * k);
  if (r.splat) drawEmo(r.splat.emoji, x + 40 * k, y - 520 * k, 230 * k);
  // แถบแรงปั่นเหนือหัว + ไอคอนอาการ (เหนื่อย/หอบ/ปกติ/สู้/สู้มาก)
  if (!r.extra && r.effort !== undefined && k * 700 > 12 && !r.say) {
    const lv = effortLv(r.effort), bw = 60, by = y - 840 * k - 16;
    rr(x - bw / 2, by, bw, 8, 4, 'rgba(0,0,0,0.5)');
    rr(x - bw / 2, by, Math.max(8, bw * r.effort / 100), 8, 4, lv.color);
    textC(r.stopT > 0 ? '💥' : lv.icon, x, by - 12, '#fff', 17, 600);
  }
  if (r.say && k * 700 > 22) drawBubble(x, y - 840 * k - 36, r.say.text, r.say.t);
}
function drawBubble(x, y, text, t) {
  const a = clamp(Math.min((2.8 - t) * 6, t * 3), 0, 1);
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.95;
  font(15, 600);
  const tw = Math.min(280, ctx.measureText(text).width + 22);
  const bx = clamp(x - tw / 2, 6, W - tw - 6);
  rr(bx, y - 30, tw, 30, 13, 'rgba(255,255,255,0.93)');
  poly([x - 8, y - 1, x + 8, y - 1, x, y + 10], 'rgba(255,255,255,0.93)');
  textC(text, bx + tw / 2, y - 14, '#222', 15, 600);
  ctx.globalAlpha = prevA;
}
function drawRiderBody(x, y, k, r) {
  if (MIR < 0) return drawRiderFront(x, y, k, r);
  const s = k;
  const ph = r.phase;
  ell(x, y, 120 * s, 22 * s, 'rgba(0,0,0,0.3)');
  ell(x, y - 140 * s, 24 * s, 140 * s, '#111');
  ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = Math.max(1, 4 * s);
  ctx.beginPath(); ctx.ellipse(x, y - 140 * s, 10 * s, 112 * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const a = side < 0 ? ph : ph + Math.PI;
    const hipX = x + side * 45 * s, hipY = y - 430 * s;
    const footX = x + side * 62 * s, footY = y - (170 + 75 * Math.sin(a)) * s;
    const kneeX = x + side * 80 * s, kneeY = (hipY + footY) / 2 - 30 * s;
    ctx.strokeStyle = r.shorts; ctx.lineWidth = Math.max(1, 46 * s);
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = '#c68c5a'; ctx.lineWidth = Math.max(1, 34 * s);
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ell(footX, footY + 8 * s, 22 * s, 14 * s, '#222');
  }
  poly([x - 70 * s, y - 420 * s, x + 70 * s, y - 420 * s, x + 105 * s, y - 640 * s, x - 105 * s, y - 640 * s], r.jersey);
  poly([x - 18 * s, y - 425 * s, x + 18 * s, y - 425 * s, x + 22 * s, y - 635 * s, x - 22 * s, y - 635 * s], 'rgba(255,255,255,0.35)');
  ctx.strokeStyle = r.jersey; ctx.lineWidth = Math.max(1, 36 * s);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + side * 95 * s, y - 620 * s); ctx.lineTo(x + side * 165 * s, y - 470 * s); ctx.stroke(); }
  ctx.lineCap = 'butt';
  ell(x, y - 690 * s, 50 * s, 46 * s, '#c68c5a');
  ell(x, y - 705 * s, 62 * s, 50 * s, r.helmet);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 22 * s - 4 * s, y - 745 * s, 8 * s, 40 * s);
  if (ENV.dark > 0.25) {
    ell(x, y - 300 * s, 14 * s, 10 * s, '#ff1744');
    LIGHTS.push({ x, y: y - 300 * s, r: 90 * s + 4, c: '255,40,60' });
  }
  if (r.name && s * 700 > 45) {
    const fs = clamp(s * 120, 11, 22);
    font(fs, 600);
    const tw = ctx.measureText(r.name).width + 12;
    rr(x - tw / 2, y - 800 * s - fs - 4, tw, fs + 8, 6, 'rgba(0,0,0,0.55)');
    textC(r.name, x, y - 800 * s - fs / 2, '#fff', fs, 600);
  }
}

// ----------------------------------------------------------- space adventure
// กระโดดขึ้นฟ้า → กลายเป็นจรวดในอวกาศ → หลบดาวเคราะห์/ดาวหาง → เข้าหลุมดำ → ร่วงผ่านเมฆกลับลงภูเขา
const SPACE_PHASES = [
  { id: 'launch', name: 'ทะยานสู่ท้องฟ้า', icon: '🚀', dur: 4.5, sub: 'จักรยานกลายร่างเป็นจรวด!' },
  { id: 'space', name: 'อวกาศ', icon: '🪐', dur: 18, sub: 'หลบดาวเคราะห์ให้ดี!' },
  { id: 'comets', name: 'พายุดาวหาง', icon: '☄️', dur: 14, sub: 'ดาวหางพุ่งมาเป็นฝูง!' },
  { id: 'blackhole', name: 'หลุมดำ', icon: '🕳️', dur: 7, sub: 'ดูดทุกอย่างเข้าไป!!' },
  { id: 'descent', name: 'ร่วงผ่านเมฆ', icon: '☁️', dur: 8, sub: 'กลับสู่โลก ลงจอดบนภูเขา!' },
];
const PLANETS = [
  { c1: [120, 190, 255], c2: [20, 60, 160], band: [60, 160, 80] },           // โลกสีฟ้า
  { c1: [255, 150, 100], c2: [140, 40, 20] },                                // ดาวอังคาร
  { c1: [240, 210, 160], c2: [150, 100, 60], band: [200, 140, 90], bands: true },   // ดาวพฤหัส
  { c1: [250, 230, 170], c2: [170, 130, 70], ring: true },                   // ดาวเสาร์
  { c1: [180, 240, 255], c2: [40, 120, 170], ring: true },                   // ดาวน้ำแข็ง
  { c1: [230, 160, 255], c2: [80, 30, 140], bands: true, band: [190, 120, 230] },   // ดาวม่วง
];
const SP = { on: false, phase: 0, t: 0, rx: 0, ry: 0, vx: 0, vy: 0, objs: [], stars: [], clouds: [], spawnT: 0, flash: 0 };
const SPF = 320;   // focal length
function spPhase() { return SPACE_PHASES[SP.phase] || SPACE_PHASES[0]; }
function newStar(anyZ) { return { x: (Math.random() - 0.5) * 5000, y: (Math.random() - 0.5) * 5000, z: anyZ ? 10 + Math.random() * 3000 : 3000 }; }
function startSpace(by) {
  if (SP.on) return;
  Object.assign(SP, { on: true, phase: 0, t: 0, rx: 0, ry: 0, vx: 0, vy: 0, objs: [], clouds: [], spawnT: 0, flash: 0 });
  SP.stars = [];
  for (let i = 0; i < 260; i++) SP.stars.push(newStar(true));
  S.trick = null; S.fx.crash = 0;
  banner('🚀 ทะยานสู่อวกาศ!', by ? `ของขวัญจาก ${by}` : 'จักรยานกลายร่างเป็นจรวด!');
  comic('สู่อวกาศ!!', '#80d8ff');
  sfx.boost(); confetti(40);
}
function endSpace() {
  SP.on = false;
  addSceneChange('mountain', playerSegIdx() - 30);
  S.lastScene = 'mountain';
  banner('🌍 กลับสู่โลก!', 'ลงจอดบนภูเขา ปั่นต่อเลย!');
  S.speed = MAX_SPEED * 0.9;
  CAM.snap = true; CAM.flash = 1;
  sfx.cheer();
}
function spawnSpace(id, dt) {
  SP.spawnT -= dt;
  if (SP.spawnT > 0) return;
  if (id === 'space') {
    SP.spawnT = 0.9;
    if (Math.random() < 0.4) {
      const r = 300 + Math.random() * 700, side = Math.random() < 0.5 ? -1 : 1;
      SP.objs.push({ type: 'planet', kind: Math.floor(Math.random() * PLANETS.length), x: side * (r * 0.6 + Math.random() * 900), y: (Math.random() - 0.5) * 700, z: 3200, r, dodge: Math.random() < 0.85 });
    } else if (Math.random() < 0.6) {
      SP.objs.push({ type: 'rock', x: (Math.random() - 0.5) * 1400, y: (Math.random() - 0.5) * 700, z: 3000, r: 50 + Math.random() * 50, rot: Math.random() * 6, dodge: Math.random() < 0.8 });
    } else spawnComet();
  } else if (id === 'comets') {
    SP.spawnT = 0.35;
    spawnComet();
    if (Math.random() < 0.3) SP.objs.push({ type: 'rock', x: (Math.random() - 0.5) * 1400, y: (Math.random() - 0.5) * 700, z: 3000, r: 50 + Math.random() * 40, rot: 0, dodge: Math.random() < 0.8 });
  } else if (id === 'descent') {
    SP.spawnT = 0.12;
    SP.clouds.push({ x: (Math.random() - 0.5) * 2400, y: 600 + Math.random() * 400, z: 2400, s: 300 + Math.random() * 400 });
  }
}
function spawnComet() {
  const side = Math.random() < 0.5 ? -1 : 1;
  SP.objs.push({ type: 'comet', x: side * (600 + Math.random() * 800), y: (Math.random() - 0.5) * 800, z: 2800, vx: -side * (250 + Math.random() * 450), vy: (Math.random() - 0.5) * 200, r: 55 + Math.random() * 40, dodge: Math.random() < 0.8 });
}
function updateSpace(dt) {
  SP.t += dt;
  SP.flash = Math.max(0, SP.flash - dt * 2);
  if (SP.t >= spPhase().dur) {
    SP.phase++; SP.t = 0; SP.flash = 1;
    if (SP.phase >= SPACE_PHASES.length) { endSpace(); return; }
    const n = spPhase();
    banner(`${n.icon} ${n.name}!`, n.sub);
    if (n.id === 'blackhole') { comic('หลุมดำ!!', '#b388ff'); sfx.boo(); }
    if (n.id === 'descent') { SP.objs = []; comic('กลับโลก!!', '#80d8ff'); }
    if (n.id === 'comets') comic('ระวัง!!', '#ffcc80');
  }
  const id = spPhase().id;
  // ความเร็ว: จรวดเร็วสุด ตอนร่วงลงช้าลงเหลือปกติ
  const want = id === 'launch' ? MAX_SPEED * (1 + SP.t / 4.5) : id === 'descent' ? MAX_SPEED * 1.1 : MAX_SPEED * 1.8;
  S.speed = lerp(S.speed, want, clamp(dt * 1.5, 0, 1));
  S.prevPZ = S.position + PLAYER_Z;
  S.position += S.speed * dt;
  S.pedalPhase += dt * 6;
  S.wheelRot += S.speed * dt;
  S.energy = Math.min(100, S.energy + 2 * dt);
  S.effects = S.effects.filter(e => e.until > S.gt);
  if (id === 'launch') return;

  const v = id === 'blackhole' ? 1400 : id === 'descent' ? 900 : 1100;
  for (const s of SP.stars) {
    s.z -= v * dt;
    if (id === 'blackhole') { const a = dt * 1.5; const x = s.x; s.x = x * Math.cos(a) - s.y * Math.sin(a); s.y = x * Math.sin(a) + s.y * Math.cos(a); }
    if (s.z < 10) Object.assign(s, newStar(false));
  }
  spawnSpace(id, dt);
  for (const o of SP.objs) {
    o.z -= v * dt;
    if (o.vx) { o.x += o.vx * dt; o.y += o.vy * dt; }
    if (o.rot !== undefined) o.rot += dt;
    if (!o.passed && o.z < 60) {
      o.passed = true;
      const dx = o.x - SP.rx, dy = o.y - SP.ry;
      if (Math.hypot(dx, dy) < o.r * (o.type === 'planet' ? 0.9 : 1) + 70) {
        S.health = Math.max(1, S.health - (o.type === 'planet' ? 10 : 5));
        S.shake = 1; S.hitFlash = 1; S.speed *= 0.7;
        const what = o.type === 'planet' ? 'ชนดาวเคราะห์!' : o.type === 'comet' ? 'โดนดาวหาง!' : 'ชนอุกกาบาต!';
        toast(`💥 ${what}`, '#ff8a80'); comic('ตูม!!', '#ffab91'); sfx.hit();
      } else if (Math.hypot(dx, dy) < o.r + 260) floater('เฉียดฉิว! 😱', '#fff59d');
    }
  }
  SP.objs = SP.objs.filter(o => o.z > -50);
  for (const c of SP.clouds) c.z -= 1300 * dt;
  SP.clouds = SP.clouds.filter(c => c.z > 20);
  // autopilot หลบ
  let tx = Math.sin(S.t * 0.6) * 350, ty = Math.cos(S.t * 0.45) * 180;
  let best = 1e9;
  for (const o of SP.objs) {
    if (!o.dodge || o.z < 60 || o.z > 1500 || o.z > best) continue;
    const ox = o.x + (o.vx || 0) * (o.z / v), oy = o.y + (o.vy || 0) * (o.z / v);
    const dx = ox - SP.rx, dy = oy - SP.ry, rad = o.r + 160;
    if (dx * dx + dy * dy < rad * rad) {
      best = o.z;
      tx = ox - (dx >= 0 ? 1 : -1) * (rad + 120);
      ty = oy - (dy >= 0 ? 1 : -1) * rad * 0.4;
    }
  }
  if (id === 'blackhole') { tx = 0; ty = 0; }
  SP.vx = lerp(SP.vx, clamp((tx - SP.rx) * 3, -1100, 1100), clamp(dt * 4, 0, 1));
  SP.vy = lerp(SP.vy, clamp((ty - SP.ry) * 3, -800, 800), clamp(dt * 4, 0, 1));
  SP.rx = clamp(SP.rx + SP.vx * dt, -1000, 1000);
  SP.ry = clamp(SP.ry + SP.vy * dt, -550, 550);
}

// ---- วาด
function spProj(x, y, z) {
  const camx = SP.rx * 0.85, camy = SP.ry * 0.85;
  const s = SPF / Math.max(1, z);
  return { x: W / 2 + (x - camx) * s, y: H * 0.45 + (y - camy) * s, s };
}
function drawPlanet(o) {
  const p = spProj(o.x, o.y, o.z), r = o.r * p.s;
  if (r < 0.5 || r > 3000) return;
  const P = PLANETS[o.kind];
  const a = clamp((3200 - o.z) / 600, 0, 1);
  ctx.globalAlpha = a;
  if (P.ring) { ctx.strokeStyle = rgb(P.c1, 0.55); ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.9, r * 0.45, -0.3, Math.PI, Math.PI * 2); ctx.stroke(); }
  const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, rgb(P.c1)); g.addColorStop(1, rgb(P.c2));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  if (P.bands || P.band) {
    ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = rgb(P.band || P.c2, 0.45);
    for (let i = -3; i <= 3; i++) ctx.fillRect(p.x - r, p.y + i * r * 0.28 - r * 0.06, r * 2, r * (P.bands ? 0.1 : 0.16));
    ctx.restore();
  }
  if (P.ring) { ctx.strokeStyle = rgb(P.c1, 0.75); ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.9, r * 0.45, -0.3, 0, Math.PI); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function drawComet(o) {
  const p = spProj(o.x, o.y, o.z), q = spProj(o.x - o.vx * 0.9, o.y - o.vy * 0.9, o.z + 250);
  const r = o.r * p.s;
  if (r < 0.3) return;
  const g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
  g.addColorStop(0, 'rgba(180,240,255,0.9)'); g.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.strokeStyle = g; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.lineCap = 'butt';
  const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
  hg.addColorStop(0, 'rgba(255,255,255,1)'); hg.addColorStop(0.4, 'rgba(160,230,255,0.7)'); hg.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = hg; ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);
}
function drawBoosters(x, y, k) {
  for (const side of [-1, 1]) {
    const bx = x + side * 120 * k, by = y - 170 * k;
    ell(bx, by, 62 * k, 62 * k, '#455a64');
    ell(bx, by, 46 * k, 46 * k, '#263238');
    const f = 0.8 + Math.random() * 0.4;
    ell(bx, by, 40 * k * f, 40 * k * f, 'rgba(255,160,40,0.95)');
    ell(bx, by, 22 * k * f, 22 * k * f, 'rgba(255,255,200,1)');
  }
  poly([x - 190 * k, y - 120 * k, x - 140 * k, y - 230 * k, x - 140 * k, y - 110 * k], '#e53935');
  poly([x + 190 * k, y - 120 * k, x + 140 * k, y - 230 * k, x + 140 * k, y - 110 * k], '#e53935');
}
function drawRocketRider(x, y, k, r, chute) {
  if (chute) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, 3 * k);
    ctx.beginPath(); ctx.moveTo(x - 90 * k, y - 600 * k); ctx.lineTo(x - 300 * k, y - 1150 * k); ctx.moveTo(x + 90 * k, y - 600 * k); ctx.lineTo(x + 300 * k, y - 1150 * k); ctx.stroke();
    drawEmo('🪂', x, y - 1050 * k, 700 * k);
  }
  drawRiderBody(x, y, k, r);
  if (!chute) drawBoosters(x, y, k);
}
function drawSpace(env) {
  const id = spPhase().id, u = SP.t / spPhase().dur;
  ctx.save();
  if (id === 'descent') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(mix([10, 10, 40], [90, 160, 240], clamp(u * 2, 0, 1))));
    g.addColorStop(1, rgb(mix([40, 40, 90], [200, 230, 255], clamp(u * 2, 0, 1))));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ภูเขาที่กำลังลงจอด
    const rise = u * u * 520;
    ctx.fillStyle = '#5d7a5a';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H + 260 - rise - (Math.sin(x * 0.012) * 0.5 + 0.5) * 260 - Math.sin(x * 0.04) * 30);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#f2f6fb';
    ctx.beginPath(); ctx.moveTo(W * 0.24, H + 260 - rise - 255); ctx.lineTo(W * 0.15, H + 260 - rise - 190); ctx.lineTo(W * 0.33, H + 260 - rise - 190); ctx.fill();
    for (const c of SP.clouds) {
      const p = spProj(c.x, c.y - (2400 - c.z) * 0.9, c.z), s = c.s * p.s;
      if (s < 1) continue;
      ctx.globalAlpha = clamp(c.z / 600, 0, 0.85);
      ell(p.x, p.y, s, s * 0.45, '#ffffff');
      ell(p.x - s * 0.5, p.y + s * 0.1, s * 0.6, s * 0.3, '#f1f6fb');
      ell(p.x + s * 0.5, p.y + s * 0.05, s * 0.7, s * 0.35, '#f6f9fc');
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W * 0.3, H * 0.3, 10, W * 0.3, H * 0.3, H * 0.6);
    neb.addColorStop(0, 'rgba(120,60,200,0.25)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    if (id === 'blackhole') { ctx.translate(W / 2, H * 0.45); ctx.rotate(u * u * 2.5); ctx.scale(1 + u * u * 0.8, 1 + u * u * 0.8); ctx.translate(-W / 2, -H * 0.45); }
    // ดาว (เป็นเส้นตอนเร็ว)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const s of SP.stars) {
      const p = spProj(s.x, s.y, s.z), q = spProj(s.x, s.y, s.z + 90);
      ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    if (id === 'blackhole') {
      const bz = lerp(2600, 120, u), p = spProj(0, 0, bz), r = 380 * p.s;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(255,${150 + i * 40},${60 + i * 50},${0.6 - i * 0.15})`;
        ctx.lineWidth = r * (0.35 - i * 0.08);
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * (2.1 + i * 0.3), r * (0.55 + i * 0.08), S.t * 0.8 + i, 0, Math.PI * 2); ctx.stroke();
      }
      const hg = ctx.createRadialGradient(p.x, p.y, r * 0.9, p.x, p.y, r * 1.5);
      hg.addColorStop(0, 'rgba(255,220,160,0.9)'); hg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    const objs = SP.objs.slice().sort((a, b) => b.z - a.z);
    for (const o of objs) {
      if (o.z < 30) continue;
      if (o.type === 'planet') drawPlanet(o);
      else if (o.type === 'comet') drawComet(o);
      else { const p = spProj(o.x, o.y, o.z), s = o.r * p.s * 2.4; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(o.rot); drawEmo('🪨', 0, s / 2, s); ctx.restore(); }
    }
  }
  // คู่แข่งในอวกาศ
  const pz = S.position + PLAYER_Z;
  const vis = S.rivals.map(r => ({ r, gap: r.z - pz })).filter(e => e.gap > 50 && e.gap < 70 * CAM_U).sort((a, b) => b.gap - a.gap);
  for (const { r, gap } of vis) {
    const z = 260 + gap / CAM_U * 28;
    const p = spProj(r.x * 650 + Math.sin(S.t * 0.7 + r.idx) * 160, (r.idx - 2) * 130 + Math.cos(S.t * 0.9 + r.idx) * 80, z);
    const k = p.s * 0.55;
    drawRocketRider(p.x, p.y + 300 * k, k, r, id === 'descent');
    if (k * 700 > 40) { font(13, 600); const tw = ctx.measureText(r.name).width + 12; rr(p.x - tw / 2, p.y - 520 * k - 22, tw, 20, 6, 'rgba(0,0,0,0.5)'); textC(r.name, p.x, p.y - 520 * k - 12, '#fff', 13, 600); }
    if (r.say) drawBubble(p.x, p.y - 520 * k - 30, r.say.text, r.say.t);
  }
  ctx.restore();
  // จรวดของผู้เล่น (มุมหลัง)
  const shake = (Math.random() - 0.5) * S.shake * 14;
  const px = W / 2 + (SP.rx - SP.rx * 0.85) * SPF / 250 + shake, py = H * 0.86 + (SP.ry - SP.ry * 0.85) * SPF / 250;
  ctx.save();
  ctx.translate(px, py); ctx.rotate(clamp(SP.vx / 3000, -0.3, 0.3)); ctx.translate(-px, -py);
  syncPlayerSprite(); PLAYER_SPRITE.jumpT = 0; PLAYER_SPRITE.fallT = 0; PLAYER_SPRITE.wheelieT = 0; PLAYER_SPRITE.driftT = 0;
  drawRocketRider(px, py, 0.42, PLAYER_SPRITE, id === 'descent');
  ctx.restore();
  if (SP.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${SP.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
  if (id === 'blackhole' && u > 0.75) { ctx.fillStyle = `rgba(0,0,0,${(u - 0.75) * 4})`; ctx.fillRect(0, 0, W, H); }
}
// ช่วงทะยานขึ้น: ภาพโลกเงยขึ้นฟ้า + เมฆพุ่งลง
function drawLaunchFX() {
  const u = SP.t / spPhase().dur;
  for (let i = 0; i < 14; i++) {
    const y = ((hash2(i, 5) * H + S.t * (600 + u * 1800)) % (H + 200)) - 100;
    const x = hash2(i, 6) * W, s = 60 + hash2(i, 7) * 120;
    ctx.globalAlpha = u * 0.8;
    ell(x, y, s, s * 0.4, '#ffffff');
    ctx.globalAlpha = 1;
  }
  syncPlayerSprite(); PLAYER_SPRITE.jumpT = 0;
  drawRocketRider(W / 2, H * 0.92 - u * 120, 0.42, PLAYER_SPRITE, false);
  if (u > 0.8) { ctx.fillStyle = `rgba(255,255,255,${(u - 0.8) * 5})`; ctx.fillRect(0, 0, W, H); }
}

// ----------------------------------------------------------- cameras
// broadcast = ถ่ายทอดสด สุ่มสลับมุมไปเรื่อยๆ และตัดไปหาคนที่กำลังมีเรื่อง
const CAM_MODES = ['broadcast', 'pov', 'wide', 'roadside', 'leader', 'side', 'headon', 'rearcam', 'riderpov', 'top'];
const CAM_NAMES = {
  broadcast: 'ถ่ายทอดสด (สลับมุมอัตโนมัติ)', pov: 'มุมมองผู้ปั่น', wide: 'มุมกว้าง', roadside: 'มุมผู้ชมข้างทาง',
  leader: 'มุมท้ายผู้นำ', riderpov: 'มุมสายตานักปั่น', top: 'มุมสูง อันดับ 1-3 (Top view)', follow: 'กล้องตามติด',
  side: 'มุมข้างผู้นำ', headon: 'มุมหน้าผู้นำ (หันหาผู้ปั่น)', rearcam: 'กล้องหลังรถ (หันหลัง)',
};
function shotLabel() {
  if (CAM.shot === 'top') return `มุมสูง · ${TOP_KINDS[CAM.topKind] || ''}`;
  if (CAM.shot === 'riderpov' && CAM.target) return `มุมสายตา ${CAM.target.name}`;
  if (CAM.shot === 'follow' && CAM.target) return `ตามติด ${CAM.target.name}`;
  return CAM_NAMES[CAM.shot];
}
// มุมทั่วไป (30% ของการตัดภาพในโหมดถ่ายทอดสด)
const SHOT_W = { pov: 2, wide: 1.6, leader: 1.6, roadside: 1.4, riderpov: 1.5, top: 1, headon: 2, rearcam: 1.6 };
// ผู้กำกับกล้อง: 70% ของการตัดภาพจะจับอันดับ 1-3 แบ่งเป็น
//   top view 50% · หน้าผู้นำ 5% · ข้างผู้นำ 20% · มุมอื่นๆ ของอันดับ 1-3 25%
const TOP3_CHANCE = 0.7;
const TOP3_W = { top: 50, headon: 5, side: 20, other: 25 };
// Top view 3 แบบ (สุ่มเท่าๆ กัน) · ล็อกแบบเดียวได้ด้วย ?topview=overview|front|zoom
const TOP_KINDS = { overview: 'ภาพรวม', front: 'หน้ากลุ่มผู้นำ', zoom: 'ซูมกลุ่มผู้นำ' };
const TOP_KIND_W = { overview: 1, front: 1, zoom: 1 };
let TOP_LOCK = TOP_KINDS[params.get('topview')] ? params.get('topview') : null;
let SPACE_ON = params.get('space') !== '0';   // สุ่มด่านอวกาศทุกครั้งที่เปลี่ยนฉาก (20%)
const CAM = { mode: 'broadcast', shot: 'pov', shotT: 0, dur: 6, target: null, spotZ: 0, spotSide: 1, z: 0, x: 0, h: CAM_H, hz: H * 0.42, flash: 0, povOf: 'player', focus: null, snap: true, move: 0, glideUntil: 0 };
function top3() { return racers().slice().sort((a, b) => b.z - a.z).slice(0, 3); }
function smooth01(p) { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); }
function directorCut() {
  if (Math.random() < TOP3_CHANCE) {
    const k = pickWeighted(TOP3_W, Math.random());
    if (k !== 'other') return cutShot(k);
    // มุมอื่นๆ ของอันดับ 1-3: ตามติดหลัง / สายตานักปั่น / ท้ายผู้นำ
    const who = pick(top3());
    const shot = pick(['follow', 'follow', 'riderpov', 'leader']);
    if (shot === 'riderpov') return who.me ? cutShot('pov') : cutShot('riderpov', who);
    return cutShot(shot, who);
  }
  const w = Object.assign({}, SHOT_W); delete w[CAM.shot];
  cutShot(pickWeighted(w, Math.random()));
}
const PLAYER_SPRITE = { name: 'คุณ', jersey: '#ff7043', helmet: '#ffeb3b', shorts: '#222', idx: 6, char: 0, me: true };
(() => {
  const m = params.get('cam');   // ค่าเริ่มต้น = ถ่ายทอดสด สลับมุมอัตโนมัติ
  CAM.mode = CAM_MODES.includes(m) ? m : 'broadcast';
  CAM.shot = CAM.mode === 'broadcast' ? 'pov' : CAM.mode;
})();
function setCamMode(m) {
  CAM.mode = m;
  CAM.focus = null;
  cutShot(m === 'broadcast' ? 'pov' : m);
  try { localStorage.setItem('mtbCam', m); } catch (e) { /* ignore */ }
  toast(`📷 ${CAM_NAMES[m]}`, '#e1f5fe');
}
function nextCamMode() { setCamMode(CAM_MODES[(CAM_MODES.indexOf(CAM.mode) + 1) % CAM_MODES.length]); }
function cutShot(shot, target) {
  // มุมเคลื่อนไหว (top / side) ซ้ำมุมเดิม = เลื่อนกล้องต่อแบบนุ่มๆ ไม่ตัดภาพ
  const prevKind = CAM.topKind;
  if (shot === 'top') CAM.topKind = TOP_LOCK || pickWeighted(TOP_KIND_W, Math.random());
  // มุมหน้ากลุ่มผู้นำหันกล้องกลับด้าน → ต้องตัดภาพ ห้ามเลื่อนต่อ
  const glide = shot === CAM.shot && (shot === 'side' || (shot === 'top' && (CAM.topKind === 'front') === (prevKind === 'front')));
  CAM.shot = shot; CAM.shotT = 0;
  if (glide) CAM.glideUntil = S.t + 1.6;
  else { CAM.flash = 1; CAM.snap = true; CAM.panSnap = true; }
  CAM.dur = 5 + Math.random() * 5;   // 5-10 วินาทีต่อมุม
  CAM.target = shot === 'riderpov' ? (target || pick(S.rivals)) : shot === 'follow' ? target : null;
  CAM.move = Math.floor(Math.random() * 4);   // รูปแบบการเคลื่อนกล้อง
  if (shot === 'roadside') placeSpot();
  if (shot === 'headon' || shot === 'side' || shot === 'top') CAM.spotSide = Math.random() < 0.5 ? -1 : 1;
}
function camFocus(who) {
  if (CAM.mode !== 'broadcast' || !who) return;
  // ตัดไปหาเหตุการณ์ไม่บ่อยเกินไป (อย่างมาก 1 ครั้ง/12 วิ และแค่ครึ่งหนึ่ง) ให้มุมสุ่มยังหลากหลาย
  if (CAM.focus || S.t - (CAM.lastFocus || -99) < 12 || Math.random() < 0.5) return;
  CAM.lastFocus = S.t;
  CAM.focus = { who, until: S.t + 4 + Math.random() * 2 };
  const shot = who.me ? pick(['follow', 'follow', 'headon']) : pick(['follow', 'riderpov', 'headon']);
  cutShot(shot, who.me && shot === 'riderpov' ? null : who);
}
function placeSpot() {
  const last = Math.min(...racers().map(o => o.z));
  CAM.spotZ = last - 12 * CAM_U;
  CAM.spotSide = Math.random() < 0.5 ? -1 : 1;
}
function syncPlayerSprite() {
  const p = PLAYER_SPRITE;
  p.x = S.playerX; p.z = S.position + PLAYER_Z; p.phase = S.pedalPhase;
  p.jumpT = S.jumpT > 0 ? S.jumpT / S.jumpDur * 1.2 : 0;
  p.jumpMax = 1.2; p.jumpH = Math.max(420, S.jumpH * 1.5);
  p.wheelieT = S.fx.wheelie > 0.3 ? 1 : 0;
  p.driftT = S.fx.drift > 0.3 ? 1 : 0; p.driftDir = S.fx.dir;
  p.fallT = S.fx.crash > 0.3 ? 0.5 : 0;
  p.motorT = S.effects.some(e => e.key === 'turbo') ? 1 : 0;
  p.boostT = S.boostFlash > 0.2 ? 1 : 0;
  p.splat = S.splatFx ? { emoji: S.splatFx.emoji } : null;
  p.say = null;
}
// จุดโฟกัสของแต่ละมุม (null = มุมมองสายตา ไม่ต้องจัดเฟรม)
const FOCUS_Y = 0.5;
function groundAt(zz) { const i = Math.floor(zz / SEG_L), t = (zz % SEG_L) / SEG_L; return lerp(getSeg(i).y, getSeg(i + 1).y, t); }
function shotFocus(all, leader) {
  const one = o => ({ z: o.z, x: o.x, lift: 380 });
  const grp = list => ({ z: list.reduce((a, o) => a + o.z, 0) / list.length, x: list.reduce((a, o) => a + o.x, 0) / list.length, lift: 250 });
  switch (CAM.shot) {
    case 'wide': return one(PLAYER_REF);
    case 'leader': case 'side': case 'headon': return one(leader);
    case 'follow': return one(CAM.target || PLAYER_REF);
    case 'roadside': { const c = all.filter(o => o.z - CAM.spotZ > 600).sort((a, b) => a.z - b.z)[0]; return c ? one(c) : null; }
    case 'top': return CAM.topKind === 'overview' ? grp(all) : grp(top3());
  }
  return null;
}
function updateCamera(dt) {
  const all = racers();
  syncPlayerSprite();
  CAM.shotT += dt;
  CAM.flash = Math.max(0, CAM.flash - dt * 4);
  if (CAM.mode === 'broadcast') {
    if (CAM.focus && S.t > CAM.focus.until) CAM.focus = null;
    if ((!CAM.focus && CAM.shotT > CAM.dur) || CAM.shotT > 10) {
      CAM.focus = null;
      directorCut();
    }
  } else if (CAM.mode === 'riderpov' && CAM.shotT > 7) {
    cutShot('riderpov', S.rivals[((CAM.target ? CAM.target.idx : -1) + 1) % S.rivals.length]);
  } else if ((CAM.mode === 'top' || CAM.mode === 'side') && CAM.shotT > CAM.dur) {
    cutShot(CAM.mode);   // เปลี่ยนรูปแบบการเคลื่อนกล้องต่อเนื่อง
  }
  const leader = all.slice().sort((a, b) => b.z - a.z)[0];
  let z, x, h = CAM_H, hz = H * 0.42, povOf = null, rev = false;
  switch (CAM.shot) {
    case 'wide':
      z = PLAYER_REF.z - PLAYER_Z - 2400; x = S.playerX * 0.5; h = 1700; hz = H * 0.36; break;
    case 'leader': case 'follow': {
      const t = CAM.shot === 'leader' ? leader : (CAM.target || PLAYER_REF);
      z = t.z - PLAYER_Z - 1300; x = t.x * 0.8; h = 1050; hz = H * 0.4; break;
    }
    case 'roadside':
      if (all.every(o => o.z - CAM.spotZ > 70 * CAM_U)) { placeSpot(); CAM.snap = true; CAM.flash = 1; }
      z = CAM.spotZ; x = CAM.spotSide * 1.7; h = 520; hz = H * 0.45; break;
    case 'riderpov': {
      const r = CAM.target || S.rivals[0];
      z = r.z - PLAYER_Z; x = r.x; povOf = r; break;
    }
    case 'top': {
      // มุมสูง 3 แบบ เน้นกลุ่มอันดับ 1-3 และเคลื่อนกล้องตลอด
      const t3 = top3();
      const front = t3[0].z, back = t3[t3.length - 1].z;
      const midZ = (front + back) / 2;
      const midX = t3.reduce((a, o) => a + o.x, 0) / t3.length;
      const p = smooth01(CAM.shotT / CAM.dur), sd = CAM.spotSide, tt = CAM.shotT;
      if (CAM.topKind === 'overview') {
        // แบบ 1 ภาพรวม: สูงและไกล เห็นนักปั่นทุกคน แพนช้าๆ ข้ามถนน
        const zs = all.map(o => o.z), fz = Math.max(...zs), bz = Math.min(...zs);
        const spread = clamp((fz - bz) / (60 * CAM_U), 0, 1);
        const dist = lerp(4800, 7600, spread) * (1 + 0.08 * Math.sin(tt * 0.4));
        z = (fz + bz) / 2 - PLAYER_Z - dist; x = lerp(-0.6, 0.6, p) * sd; h = dist * 1.55; hz = 70;
      } else if (CAM.topKind === 'front') {
        // แบบ 2 หน้ากลุ่มผู้นำ: กล้องลอยนำหน้า หันกลับมามองอันดับ 1-3 ที่ปั่นตามมา
        const spread = clamp((front - back) / (35 * CAM_U), 0, 1);
        const dist = lerp(2400, 1600, p) * lerp(1, 1.5, spread);
        z = front + dist; x = midX * 0.7 + Math.sin(tt * 0.6) * 0.45 * sd; h = dist * 2.1; hz = 85; rev = true;
      } else {
        // แบบ 3 ซูมเข้า: เริ่มสูงแล้วค่อยๆ ดันกล้องลงไปใกล้กลุ่มผู้นำ
        const spread = clamp((front - back) / (35 * CAM_U), 0, 1);
        const dist = lerp(4200, 1200, p) * lerp(1, 1.35, spread);
        z = midZ - PLAYER_Z - dist; x = midX * 0.8 + Math.sin(tt * 0.5) * 0.25 * sd; h = dist * 1.8; hz = lerp(70, 120, p);
      }
      break;
    }
    case 'side': {
      // กล้องวิ่งคู่ข้างผู้นำ ค่อยๆ ไล่ขึ้นจากด้านหลังมาเทียบข้าง
      const p = smooth01(CAM.shotT / CAM.dur), sw = Math.sin(CAM.shotT * 0.9);
      const back = CAM.move % 2 ? lerp(520, 1200, p) : lerp(1200, 520, p);
      z = leader.z - PLAYER_Z - back; x = leader.x + CAM.spotSide * (0.8 + 0.12 * sw); h = 520 + 90 * sw; hz = H * 0.45; break;
    }
    case 'rearcam':
      z = PLAYER_REF.z + 120; x = S.playerX; h = 620; hz = H * 0.44; rev = true; break;
    case 'headon':
      z = leader.z + 14 * CAM_U; x = CAM.spotSide * 0.9; h = 1050; hz = H * 0.42; rev = true; break;
    default:   // pov
      z = S.position; x = S.playerX; povOf = 'player';
  }
  // จัดเฟรม: นักปั่น/กลุ่มที่ถ่ายอยู่ต้องอยู่กลางจอมือถือ (จุดนำสายตา) → ปรับขอบฟ้าให้เป้าอยู่ระดับกลางจอ
  const focus = shotFocus(all, leader);
  CAM.focus2 = focus;
  if (focus) {
    const cz = rev ? z - focus.z : focus.z - z;
    if (cz > 300) {
      const off = CAM_D / cz * (groundAt(z + (rev ? 0 : PLAYER_Z)) + h - (groundAt(focus.z) + focus.lift)) * W / 2;
      hz = clamp(H * FOCUS_Y - off, 20, H * 0.8);
    }
  }
  const k = clamp(dt * (S.t < CAM.glideUntil ? 1.5 : 5), 0, 1);
  CAM.rev = rev;
  if (CAM.snap || povOf || CAM.shot === 'rearcam') { CAM.z = z; CAM.x = x; CAM.h = h; CAM.hz = hz; CAM.snap = false; }
  else { CAM.z = lerp(CAM.z, z, k); CAM.x = lerp(CAM.x, x, k); CAM.h = lerp(CAM.h, h, k); CAM.hz = lerp(CAM.hz, hz, k); }
  CAM.povOf = povOf;
  // เอียงกล้องตามความชัน: ขึ้นเขา = เงยขึ้น (ขอบฟ้าต่ำลง), ลงเขา = ก้มลง (ขอบฟ้าสูงขึ้น)
  let pt = 0;
  if (!focus && CAM.shot !== 'top') {
    const si = Math.floor((CAM.z + (rev ? 0 : PLAYER_Z)) / SEG_L), dir = rev ? -1 : 1;
    const sl = (getSeg(si + dir * 10).y - getSeg(si).y) / (10 * SEG_L);
    pt = clamp(sl * 650 * (h > 1500 ? 0.4 : 1), -170, 170);
  }
  CAM.pitch = lerp(CAM.pitch || 0, pt, clamp(dt * 3, 0, 1));
}
function drawCrowd() {
  // ผู้ชมข้างทางโบกมือเชียร์ (เบื้องหน้า)
  const side = CAM.spotSide;
  const cols = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#ff7043', '#00acc1'];
  for (let i = 0; i < 9; i++) {
    const x = side > 0 ? W - 30 - i * 34 : 30 + i * 34;
    const bob = Math.abs(Math.sin(S.t * 6 + i * 1.3)) * 10;
    const y = H - 10 - (i % 2) * 18 - bob;
    const s = 1.25 - i * 0.07;
    ell(x, y + 40 * s, 30 * s, 50 * s, cols[i % cols.length]);
    ell(x, y - 22 * s, 20 * s, 20 * s, '#c68c5a');
    ctx.strokeStyle = '#c68c5a'; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
    const wave = Math.sin(S.t * 8 + i) * 0.6;
    ctx.beginPath(); ctx.moveTo(x + 18 * s, y + 10 * s); ctx.lineTo(x + 30 * s + wave * 12, y - 40 * s); ctx.stroke();
    ctx.lineCap = 'butt';
    if (i % 3 === 0) { poly([x + 30 * s + wave * 12, y - 40 * s, x + 64 * s + wave * 14, y - 48 * s, x + 30 * s + wave * 12, y - 66 * s], cols[(i + 3) % cols.length]); }
  }
}

// นักปั่นมองจากด้านหน้า (ใช้ตอนกล้องหันหลัง / มุมหน้าขบวน)
function drawRiderFront(x, y, k, r) {
  const s = k, ph = r.phase;
  ell(x, y, 120 * s, 22 * s, 'rgba(0,0,0,0.3)');
  ell(x, y - 140 * s, 22 * s, 140 * s, '#111');
  ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = Math.max(1, 4 * s);
  ctx.beginPath(); ctx.ellipse(x, y - 140 * s, 9 * s, 112 * s, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1, 12 * s);
  ctx.beginPath(); ctx.moveTo(x - 16 * s, y - 150 * s); ctx.lineTo(x, y - 360 * s); ctx.lineTo(x + 16 * s, y - 150 * s); ctx.stroke();
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const a = side < 0 ? ph : ph + Math.PI;
    const hipX = x + side * 48 * s, hipY = y - 440 * s;
    const footX = x + side * 58 * s, footY = y - (170 + 75 * Math.sin(a)) * s;
    const kneeX = x + side * 72 * s, kneeY = y - (360 + 55 * Math.sin(a)) * s;
    ctx.strokeStyle = r.shorts; ctx.lineWidth = Math.max(1, 48 * s);
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = '#c68c5a'; ctx.lineWidth = Math.max(1, 34 * s);
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    ell(footX, footY + 8 * s, 20 * s, 14 * s, '#222');
  }
  // ลำตัว (เอนไปข้างหน้า)
  poly([x - 72 * s, y - 440 * s, x + 72 * s, y - 440 * s, x + 108 * s, y - 610 * s, x - 108 * s, y - 610 * s], r.jersey);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 108 * s, y - 560 * s, 216 * s, 22 * s);
  if (s * 700 > 30 && !r.extra) textC(String(r.idx + 1), x, y - 495 * s, '#222', Math.max(6, 50 * s), 800);
  // แขน + แฮนด์
  ctx.strokeStyle = r.jersey; ctx.lineWidth = Math.max(1, 34 * s);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + side * 98 * s, y - 600 * s); ctx.lineTo(x + side * 150 * s, y - 440 * s); ctx.stroke(); }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(1, 14 * s);
  ctx.beginPath(); ctx.moveTo(x - 175 * s, y - 425 * s); ctx.lineTo(x + 175 * s, y - 425 * s); ctx.stroke();
  ctx.lineCap = 'butt';
  ell(x - 150 * s, y - 430 * s, 22 * s, 18 * s, '#222');
  ell(x + 150 * s, y - 430 * s, 22 * s, 18 * s, '#222');
  // หน้า + แว่น + หมวก
  ell(x, y - 660 * s, 44 * s, 48 * s, '#c68c5a');
  rr(x - 44 * s, y - 680 * s, 88 * s, 22 * s, 10 * s, 'rgba(20,20,30,0.9)');
  if (r.say) ell(x, y - 630 * s, 12 * s, 9 * s, '#5d1f1f');
  ell(x, y - 700 * s, 60 * s, 40 * s, r.helmet);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 22 * s - 4 * s, y - 730 * s, 8 * s, 26 * s);
  if (ENV.dark > 0.25) {
    ell(x, y - 380 * s, 12 * s, 10 * s, '#fffde7');
    LIGHTS.push({ x, y: y - 380 * s, r: 140 * s + 6, c: '255,250,220' });
  }
  if (r.name && s * 700 > 45) {
    const fs = clamp(s * 120, 11, 22);
    font(fs, 600);
    const tw = ctx.measureText(r.name).width + 12;
    rr(x - tw / 2, y - 800 * s - fs - 4, tw, fs + 8, 6, 'rgba(0,0,0,0.55)');
    textC(r.name, x, y - 800 * s - fs / 2, '#fff', fs, 600);
  }
}
// ล้อหลังของตัวเองตอนติดกล้องหันหลัง
function drawRearCamBike() {
  ell(W / 2 + 150, H + 80, 48, 260, '#151515');
  ctx.fillStyle = '#2d2d2d';
  const off = (S.wheelRot * 0.08) % 28;
  for (let yy = 830 + off; yy < H; yy += 28) {
    const half = 48 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - H - 80) / 260, 2)));
    ctx.fillRect(W / 2 + 150 - half + 4, yy, half * 2 - 8, 10);
  }
  ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(W / 2 + 60, H + 20); ctx.lineTo(W / 2 + 150, H - 60); ctx.stroke();
  ctx.lineCap = 'butt';
  rr(W / 2 + 40, H - 40, 70, 40, 10, '#212121');
  ell(W / 2 + 75, H - 20, 10, 8, ENV.dark > 0.25 ? '#ff1744' : '#7f0000');
}

// ---- นักปั่นกลุ่มใหญ่ (เปโลตอง) ไม่นับอันดับ ใส่ไว้ให้ดูคึกคัก
const PACK_COLORS = ['#0d47a1', '#b71c1c', '#1b5e20', '#f57f17', '#4a148c', '#006064', '#ffffff', '#212121', '#e65100', '#c2185b', '#00838f', '#827717'];
let PACK_N = clamp(parseInt(params.get('pack'), 10) || 12, 0, 30);   // จำนวนนักปั่นกลุ่มใหญ่ (ปรับได้จากแผงผู้ดูแล)
function initPack() {
  const n = PACK_N;
  S.pack = [];
  for (let i = 0; i < n; i++) {
    S.pack.push({
      name: '', extra: true, idx: 20 + i, jersey: PACK_COLORS[i % PACK_COLORS.length], helmet: i % 3 ? '#fafafa' : '#212121', shorts: '#1a1a1a',
      z: S.position + PLAYER_Z - (i + 1) * 260, x: -0.7 + Math.random() * 1.4, tx: 0, speed: 0, phase: Math.random() * 6,
      off: (Math.random() - 0.6) * 30 * U_PER_M, offT: Math.random() * 8, retarget: Math.random() * 3,
      jumpT: 0, wheelieT: 0, driftT: 0, fallT: 0, motorT: 0, boostT: 0, say: null, splat: null,
    });
  }
}
function updatePack(dt) {
  if (!S.pack.length) return;
  // กลุ่มนักปั่นประกอบฉาก: ปั่นอยู่รอบๆ ผู้เล่น · ห้ามทะลุใครเหมือนกัน
  const all = riders();
  const center = S.position + PLAYER_Z;
  const ref = Math.max(S.speed, MAX_SPEED * 0.6);
  const L = RIDER_LEN * U_PER_M;
  for (const r of S.pack) {
    if ((r.offT -= dt) <= 0) { r.off = (Math.random() - 0.6) * 30 * U_PER_M; r.offT = 6 + Math.random() * 8; }
    if ((r.retarget -= dt) <= 0) { r.tx = -0.8 + Math.random() * 1.6; r.retarget = 2 + Math.random() * 4; }
    let want = ref + clamp((center + r.off - r.z) * 0.4, -MAX_SPEED * 0.5, MAX_SPEED * 0.6);
    const near = raceNear(r, all);
    if (near.block && !SP.on) {
      const bs = riderSpeed(near.block);
      if (want > bs) { if ((r.passT = (r.passT || 0) - dt) <= 0) { r.tx = passSide(r, near.block, all); r.passT = 1.2; r.retarget = 2; } }
      if (near.block.z - r.z < L + 1.5 * U_PER_M) want = Math.min(want, bs);
    }
    r.speed += clamp(want - r.speed, -MAX_SPEED * dt, ACCEL * 1.2 * dt);
    r.speed = Math.max(0, r.speed);
    r.z += r.speed * dt;
    r.x = lerp(r.x, r.tx, clamp(dt * 1.5, 0, 1));
    if (!SP.on) separate(r, all);
    r.phase += dt * (3 + r.speed / MAX_SPEED * 8);
  }
}

// ----------------------------------------------------------- telemetry (แบบกล้อง action cam)
const TEL = { hr: 105, acc: 0, prevV: 0, heading: 0, cad: 0, pow: 0 };
function updateTelemetry(dt) {
  const ms = S.speed * KMH / 3.6;   // m/s
  TEL.acc = lerp(TEL.acc, (ms - TEL.prevV) / Math.max(dt, 0.001) / 9.81, clamp(dt * 3, 0, 1));
  TEL.prevV = ms;
  const seg = getSeg(playerSegIdx());
  TEL.heading = (TEL.heading + seg.curve * 0.0032 * (S.speed * dt / SEG_L) * 180 / Math.PI + 540) % 360 - 180;
  const sp = S.speed / MAX_SPEED;
  const cad = S.pedaling ? 62 + sp * 30 + Math.max(0, S.slope) * 60 + Math.sin(S.t * 1.7) * 3 : 0;
  const pow = S.pedaling ? 90 + sp * 140 + Math.max(0, S.slope) * 1600 + Math.sin(S.t * 2.3) * 12 : 0;
  TEL.cad = lerp(TEL.cad, cad, clamp(dt * 3, 0, 1));
  TEL.pow = lerp(TEL.pow, pow, clamp(dt * 3, 0, 1));
  TEL.hr = lerp(TEL.hr, 92 + TEL.pow * 0.25 + (100 - S.energy) * 0.3, clamp(dt * 0.4, 0, 1));
}
function telValue(label, val, unit, x, y, barFrac) {
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  font(12, 600); ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(label, x, y - 30);
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  font(28, 800);
  const vw = ctx.measureText(val).width;
  ctx.strokeText(val, x, y); ctx.fillStyle = '#fff'; ctx.fillText(val, x, y);
  font(13, 800); ctx.fillStyle = '#ff9800';
  ctx.fillText(unit, x + vw + 4, y);
  if (barFrac !== undefined) {
    rr(x, y + 5, 70, 4, 2, 'rgba(255,255,255,0.25)');
    rr(x, y + 5, 70 * clamp(barFrac, 0, 1), 4, 2, '#69f0ae');
  }
}
function drawTelemetry(env) {
  const who = CAM.shot === 'riderpov' && CAM.target ? CAM.target : null;
  const spd = (who ? who.speed : S.speed) * KMH;
  const seed = who ? who.idx * 13 : 0;
  const cad = who ? (who.speed > 100 ? 70 + who.speed / MAX_SPEED * 28 + Math.sin(S.t + seed) * 3 : 0) : TEL.cad;
  const pow = who ? cad * 2.6 + Math.sin(S.t * 1.3 + seed) * 15 : TEL.pow;
  const hr = who ? 120 + Math.sin(S.t * 0.3 + seed) * 12 + who.speed / MAX_SPEED * 25 : TEL.hr;
  const zz = who ? who.z : S.position + PLAYER_Z;
  const si = Math.floor(zz / SEG_L);
  // ซ้าย
  telValue('ความเร่ง', `${TEL.acc >= 0 ? '' : '-'}${Math.abs(who ? 0 : TEL.acc).toFixed(1)}`, 'G', 14, 512);
  telValue('รอบขา', `${Math.round(cad)}`, 'RPM', 14, 568, cad / 120);
  telValue('กำลัง', `${Math.round(pow)}`, 'W', 14, 624, pow / 600);
  telValue('ชีพจร', `${Math.round(hr)}`, 'BPM', 14, 680, (hr - 60) / 130);
  // มาตรวัดความเร็ววงกลม
  const gx = 92, gy = 760, gr = 62;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  const frac = clamp(spd / 120, 0, 1);
  const g = ctx.createLinearGradient(gx - gr, gy, gx + gr, gy);
  g.addColorStop(0, '#69f0ae'); g.addColorStop(0.6, '#ffd740'); g.addColorStop(1, '#ff5252');
  ctx.strokeStyle = g; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * frac)); ctx.stroke();
  ctx.lineCap = 'butt';
  const na = Math.PI * (0.75 + 1.5 * frac);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * (gr - 16), gy + Math.sin(na) * (gr - 16)); ctx.stroke();
  ell(gx, gy, 24, 24, 'rgba(0,0,0,0.45)');
  textC(`${Math.round(spd)}`, gx, gy + 1, '#fff', 22, 800, true);
  textC('KM/H', gx, gy + 36, '#ff9800', 11, 800);
  // วันเวลาแบบกล้อง
  const th = env.th, d = new Date(th.ms);
  const stamp = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')} ${String(th.h).padStart(2, '0')}:${String(th.m).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
  font(13, 600); ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(stamp, W - 14, 660);
  ctx.textAlign = 'center';
}

// ----------------------------------------------------------- admin panel
// แผงผู้ดูแล: แสดงข้างจอเกม (นอกพื้นที่ 9:16) อธิบายปุ่ม/คีย์/ของขวัญ และมีปุ่มสั่งทดสอบ
const ADMIN = { open: false, el: null, statusEl: null, lastStat: 0 };
function adminEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function setupAdmin() {
  const el = $id('admin'), btn = $id('adminBtn');
  if (!el || !btn) return;
  ADMIN.el = el;
  btn.addEventListener('click', () => toggleAdmin());
  renderAdmin();
}
function toggleAdmin(force) {
  ADMIN.open = force !== undefined ? force : !ADMIN.open;
  document.body.classList.toggle('admin-open', ADMIN.open);
  if (ADMIN.open) renderAdmin();
  resize();
}
document.addEventListener('input', e => {
  const c = e.target.classList;
  if (!c || !(c.contains('sfxVol') || c.contains('envVol'))) return;
  initAudio();
  if (c.contains('sfxVol')) setSfxVol(e.target.value / 100); else setEnvVol(e.target.value / 100);
});
// ปล่อยสไลด์แล้วเล่นเสียงตัวอย่าง ให้รู้ว่าดังแค่ไหน
document.addEventListener('change', e => { if (e.target.classList && e.target.classList.contains('sfxVol')) sfx.pick(); });
function adminAct(kind, val) {
  initAudio();
  const target = parseInt((document.getElementById('admTarget') || {}).value || '0', 10) || 0;
  const other = (list, cur) => pick(list.filter(x => x !== cur));
  switch (kind) {
    case 'action': ADMIN.last = val; onLiveMessage({ type: 'gift', user: 'แอดมิน', giftName: 'ทดสอบ', count: 1, diamonds: 0, action: val, repeat: 1, target }); break;
    case 'cheat': ADMIN.last = 'cheat'; doCheat(pick(S.rivals)); break;
    case 'scene': {
      // เลือกฉาก = ล็อกไว้ · 🎲 = สุ่มฉากใหม่แล้วกลับไปสุ่มอัตโนมัติทุก 5 นาที
      const id = val === 'random' ? other(SCENE_IDS, playerScene().sid) : val;
      LOCK.scene = val === 'random' ? null : val;
      addSceneChange(id, playerSegIdx() - 30); S.lastScene = null; CAM.flash = 1; resetTrackAhead();
      if (val === 'random') toast(`🎲 สุ่มฉาก: ${SCENES[id].icon} ${SCENES[id].name}`, '#e1f5fe');
      break;
    }
    case 'weather': {
      const id = val === 'random' ? other(Object.keys(WEATHERS), S.wCur) : val;
      LOCK.weather = val === 'random' ? null : val;
      setWeather(id); break;
    }
    case 'diff': {
      const d = val === 'random' ? other([0, 1, 2, 3], S.diff) : parseInt(val, 10);
      LOCK.diff = val === 'random' ? null : d;
      setDiff(d); resetTrackAhead(); break;
    }
    case 'track':
      TRACK_MODE = val; resetTrackAhead();
      toast(`เส้นทาง: ${TRACK_MODES[val]}`, '#fff59d'); break;
    case 'terrain': case 'surface': case 'lanes': {
      const key = kind === 'lanes' ? 'width' : kind;
      FORCE_SEC[key] = val === 'random' ? null : val; resetTrackAhead(); break;
    }
    case 'topkind':
      TOP_LOCK = val === 'random' ? null : val;
      if (CAM.shot === 'top' || CAM.mode === 'top') cutShot('top'); break;
    case 'pack': PACK_N = parseInt(val, 10) || 0; initPack(); break;
    case 'hour0': S.hourOff = 0; break;
    case 'space': SPACE_ON = !SPACE_ON; toast(`🚀 สุ่มด่านอวกาศ: ${SPACE_ON ? 'เปิด' : 'ปิด'}`, '#e1f5fe'); break;
    case 'tkconnect': case 'tkstop': {
      if (!S.live.server) { toast('⚠️ ต้องเปิดเกมผ่านเซิร์ฟเวอร์ (npm start) ถึงจะเชื่อมไลฟ์ได้', '#ffccbc'); break; }
      const user = (($id('admTk') || {}).value || '').trim().replace(/^@/, '');
      if (kind === 'tkconnect' && !user) { toast('⚠️ ใส่ชื่อบัญชี TikTok ก่อน', '#ffccbc'); break; }
      fetch(kind === 'tkconnect' ? '/connect' : '/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) })
        .then(r => r.json()).then(j => toast((j.ok ? '' : '⚠️ ') + j.msg, j.ok ? '#b9f6ca' : '#ffccbc'))
        .catch(() => toast('⚠️ ติดต่อเซิร์ฟเวอร์ไม่ได้', '#ffccbc'));
      break;
    }
    case 'cam': setCamMode(val); break;
    case 'hour': S.hourOff = (S.hourOff + parseFloat(val) + 24) % 24; break;
    case 'pause': S.paused = !S.paused; break;
    case 'music': S.musicOn = !S.musicOn; break;
    case 'voice': S.voiceOn = !S.voiceOn; break;
    case 'gifts': { const p = $id('giftPanel'); if (p) p.classList.toggle('hidden'); break; }
  }
  updateAdminStatus(true);
  refreshAdminButtons();
}
// ปุ่มที่กำลังเลือกอยู่ = ค้างสีไว้
function adminActive(kind, val) {
  switch (kind) {
    case 'action': return ADMIN.last === val;
    case 'cheat': return ADMIN.last === 'cheat';
    case 'scene': return val === 'random' ? !LOCK.scene : LOCK.scene === val;
    case 'weather': return val === 'random' ? !LOCK.weather : LOCK.weather === val;
    case 'diff': return val === 'random' ? LOCK.diff === null : LOCK.diff === parseInt(val, 10);
    case 'track': return TRACK_MODE === val;
    case 'tkconnect': return !!S.live.username && S.live.status !== 'off';
    case 'terrain': return val === 'random' ? !FORCE_SEC.terrain : FORCE_SEC.terrain === val;
    case 'surface': return val === 'random' ? !FORCE_SEC.surface : FORCE_SEC.surface === val;
    case 'lanes': return val === 'random' ? !FORCE_SEC.width : FORCE_SEC.width === val;
    case 'topkind': return val === 'random' ? !TOP_LOCK : TOP_LOCK === val;
    case 'pack': return PACK_N === parseInt(val, 10);
    case 'hour0': return !S.hourOff;
    case 'space': return SPACE_ON;
    case 'cam': return CAM.mode === val;
    case 'pause': return S.paused;
    case 'music': return S.musicOn;
    case 'voice': return S.voiceOn;
    case 'gifts': { const p = $id('giftPanel'); return !!p && !p.classList.contains('hidden'); }
  }
  return false;
}
function refreshAdminButtons() {
  if (!ADMIN.el) return;
  ADMIN.el.querySelectorAll('button[data-k]').forEach(b => b.classList.toggle('on', adminActive(b.dataset.k, b.dataset.v)));
}
function renderAdmin() {
  const el = ADMIN.el;
  if (!el) return;
  const cfg = S.liveCfg;
  const giftRows = cfg && cfg.giftActions
    ? Object.entries(cfg.giftActions).map(([g, a]) => `<tr><td>🎁 ${adminEsc(g)}</td><td>${ACTIONS[a] ? ACTIONS[a].icon + ' ' + ACTIONS[a].name : adminEsc(a)}</td></tr>`).join('')
    : '<tr><td colspan="2">(เปิดผ่านเซิร์ฟเวอร์เพื่อดูตารางจาก config.json)</td></tr>';
  const tierRows = cfg && cfg.diamondTiers
    ? cfg.diamondTiers.slice().sort((a, b) => a.min - b.min).map(t => `<tr><td>💎 ${t.min}+</td><td>${ACTIONS[t.action] ? ACTIONS[t.action].icon + ' ' + ACTIONS[t.action].name : adminEsc(t.action)}</td></tr>`).join('')
    : '';
  const btn = (kind, val, label) => `<button data-k="${kind}" data-v="${adminEsc(val)}"${val === 'random' ? ' class="rnd"' : ''}>${label}</button>`;
  const rnd = kind => btn(kind, 'random', '🎲 สุ่มอัตโนมัติ');
  el.innerHTML = `
  <div class="ah"><b>🛠️ แผงผู้ดูแล (Admin)</b><button data-k="close">✕</button></div>
  <div id="admStatus" class="stat"></div>

  <h4>📱 ปุ่มบนจอเกม</h4>
  <table>
    <tr><td>🎁</td><td>เปิดแผงของขวัญ: เลือกนักปั่น 1-6 แล้วกดของขวัญเพื่อส่งเอง (ทดสอบเหมือนผู้ชมส่ง)</td></tr>
    <tr><td>📷</td><td>เปลี่ยนโหมดกล้อง (วนตามลำดับ) — โหมด "ถ่ายทอดสด" จะสุ่มสลับมุมเอง</td></tr>
    <tr><td>🎵 / 🗣️</td><td>(ในแผงของขวัญ) เปิด-ปิดเพลงประกอบ / เสียงพูดของบอท</td></tr>
    <tr><td>แตะจอ</td><td>เปิดเสียง (เบราว์เซอร์ต้องให้แตะก่อน 1 ครั้ง) / เล่นต่อเมื่อหยุดไว้</td></tr>
    <tr><td>ℹ️</td><td>เปิด-ปิดแผงนี้ (แสดงข้างจอ ไม่บังเกม)</td></tr>
  </table>

  <h4>🎮 สั่งทดสอบ</h4>
  <div class="row">ให้ท่ากับ: <select id="admTarget">${CHAR_NAMES.map((n, i) => `<option value="${i}">${i + 1}. ${adminEsc(n)}</option>`).join('')}</select></div>
  <div class="grid">${Object.entries(ACTIONS).map(([k, a]) => btn('action', k, `${a.icon} ${a.name}`)).join('')}${btn('cheat', '', '😈 บอทโกงทันที')}</div>
  <div class="row">เส้นทาง:</div>
  <div class="grid">${Object.entries(TRACK_MODES).map(([k, n]) => btn('track', k, n)).join('')}</div>
  <div class="row">ระดับทาง (บังคับทุกช่วง):</div>
  <div class="grid">${rnd('terrain')}${Object.entries(TERRAINS).map(([k, t]) => btn('terrain', k, `${t.icon} ${t.name}`)).join('')}</div>
  <div class="row">พื้นผิว:</div>
  <div class="grid">${rnd('surface')}${Object.entries(SURFACES).map(([k, t]) => btn('surface', k, k === 'normal' ? '🛣️ ปกติ' : `${t.icon} ${t.name}`)).join('')}</div>
  <div class="row">จำนวนเลน:</div>
  <div class="grid">${rnd('lanes')}${Object.entries(WIDTHS).map(([k, t]) => btn('lanes', k, t.name)).join('')}</div>
  <div class="row">ฉาก (เปลี่ยนทันที · เลือกแล้วล็อกไว้):</div>
  <div class="grid">${rnd('scene')}${SCENE_IDS.map(id => btn('scene', id, `${SCENES[id].icon} ${SCENES[id].name}`)).join('')}</div>
  <div class="row">อากาศ:</div>
  <div class="grid">${rnd('weather')}${Object.entries(WEATHERS).map(([id, w]) => btn('weather', id, `${w.icon} ${w.name}`)).join('')}</div>
  <div class="row">ความยาก:</div>
  <div class="grid">${rnd('diff')}${DIFFS.map((d, i) => btn('diff', i, d.name)).join('')}</div>
  <div class="row">มุมกล้อง:</div>
  <div class="grid">${CAM_MODES.map(m => m === 'broadcast' ? `<button data-k="cam" data-v="broadcast" class="rnd">🎲 สุ่มอัตโนมัติ (ถ่ายทอดสด)</button>` : btn('cam', m, CAM_NAMES[m])).join('')}</div>
  <div class="row">แบบมุมสูง (Top view):</div>
  <div class="grid">${rnd('topkind')}${Object.entries(TOP_KINDS).map(([k, n]) => btn('topkind', k, '🚁 ' + n)).join('')}</div>
  <div class="row">นักปั่นกลุ่มใหญ่ (เพิ่มจาก 6 คนหลัก):</div>
  <div class="grid">${[0, 6, 12, 20, 30].map(n => btn('pack', n, n ? `👥 ${n} คน` : '👤 ไม่มี')).join('')}</div>
  <div class="grid">${btn('hour', -1, '🕐 เวลา -1 ชม.')}${btn('hour', 1, '🕐 เวลา +1 ชม.')}${btn('hour0', '', '🕐 เวลาจริง')}${btn('space', '', '🚀 สุ่มด่านอวกาศ')}${btn('pause', '', '⏸ หยุด/เล่น')}${btn('music', '', '🎵 เพลง')}${btn('voice', '', '🗣️ เสียงพูด')}${btn('gifts', '', '🎁 แผงของขวัญ')}</div>
  <div class="vol">🔊 เสียงเอฟเฟกต์ <input type="range" class="sfxVol" min="0" max="100" step="5" value="${Math.round(SFX_VOL * 100)}"> <b class="sfxVolTxt">${SFX_VOL > 0 ? Math.round(SFX_VOL * 100) + '%' : 'ปิด'}</b></div>
  <div class="vol">🌧️ เสียงฝน/ลม <input type="range" class="envVol" min="0" max="100" step="5" value="${Math.round(ENV_VOL * 100)}"> <b class="envVolTxt">${ENV_VOL > 0 ? Math.round(ENV_VOL * 100) + '%' : 'ปิด'}</b></div>

  <h4>⌨️ คีย์ลัด (คีย์บอร์ด)</h4>
  <table>
    <tr><td>P / Esc</td><td>หยุด-เล่นต่อ</td></tr>
    <tr><td>B</td><td>เปลี่ยนมุมกล้อง</td></tr>
    <tr><td>G</td><td>แผงของขวัญ</td></tr>
    <tr><td>I</td><td>แผงผู้ดูแลนี้</td></tr>
    <tr><td>M / V</td><td>เพลง / เสียงพูด</td></tr>
    <tr><td>1 / 2 / 3 / 4</td><td>ฉากถัดไป / อากาศถัดไป / เวลา +1 ชม. / ความยากถัดไป</td></tr>
    <tr><td>J C H D X</td><td>กระโดด / ก้มหมอบ / ยกล้อหน้า / สไลด์ล้อหลัง / ล้ม</td></tr>
    <tr><td>T K U Y</td><td>ปาของ / แกล้งผู้นำ / เทอร์โบ / บินสู่อวกาศ</td></tr>
    <tr><td>O</td><td>ให้บอทโกงทันที</td></tr>
  </table>

  <h4>📡 TikTok Live</h4>
  <div class="tk">
    <input id="admTk" type="text" placeholder="ชื่อผู้ใช้ TikTok หรือวางลิงก์ tiktok.com/@..." value="${adminEsc(S.live.username || '')}" autocomplete="off" spellcheck="false">
    <div class="grid">${btn('tkconnect', '', '🔗 เชื่อมไลฟ์')}${btn('tkstop', '', '⛔ ตัดการเชื่อม')}</div>
    <div id="admTkStat" class="tkstat"></div>
  </div>
  <table>
    <tr><td>เชื่อมไลฟ์</td><td>ใส่ชื่อบัญชีแล้วกด 🔗 เชื่อมไลฟ์ (ระบบจำชื่อไว้ให้ครั้งหน้า) จากนั้นกด Go LIVE ใน TikTok — เชื่อมติดเองเมื่อไลฟ์เริ่ม</td></tr>
    <tr><td>แชท 1-6</td><td>ผู้ชมเลือกเชียร์นักปั่น (1 คุณ, 2 สมชาย, 3 มานี, 4 ปิติ, 5 ชูใจ, 6 วีระ) ของขวัญจะไปที่คนนั้น</td></tr>
    <tr><td>ไลก์</td><td>ครบ ${cfg ? cfg.likesPerJump : 100} ไลก์ = 🦘 กระโดด</td></tr>
  </table>
  <div class="row">ของขวัญ → ท่า (แก้ได้ใน config.json มีผลทันที):</div>
  <table>${giftRows}${tierRows}</table>
`;
  el.querySelectorAll('button[data-k]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.k === 'close') toggleAdmin(false); else adminAct(b.dataset.k, b.dataset.v);
  }));
  ADMIN.statusEl = el.querySelector('#admStatus');
  updateAdminStatus(true);
  refreshAdminButtons();
}
function updateAdminStatus(force) {
  if (!ADMIN.open || !ADMIN.statusEl) return;
  if (!force && S.t - ADMIN.lastStat < 0.5) return;
  ADMIN.lastStat = S.t;
  const th = thaiTime(), ps = playerScene().scene, L = S.live;
  const scene = SP.on ? `${spPhase().icon} ${spPhase().name}` : `${ps.icon} ${ps.name}`;
  const shot = shotLabel();
  ADMIN.statusEl.innerHTML = [
    `📡 TikTok: <b>${L.status === 'connected' ? '🔴 LIVE @' + adminEsc(L.username) : L.username ? adminEsc(L.status) + ' @' + adminEsc(L.username) : (L.server ? 'ยังไม่ตั้งชื่อผู้ใช้' : 'ไม่ได้ต่อเซิร์ฟเวอร์')}</b> ❤️ ${fmtK(L.likes)}`,
    `🗺️ ฉาก: <b>${scene}</b> · เปลี่ยนใน ${fmtMS(SCENE_MS - th.ms % SCENE_MS)}`,
    `🌦️ อากาศ: <b>${WEATHERS[S.wCur].name}</b>${LOCK.weather ? ' 🔒' : ''} · ความยาก: <b>${DIFFS[S.diff].name}</b>${LOCK.diff !== null ? ' 🔒' : ''} · เส้นทาง: <b>${TRACK_MODES[TRACK_MODE]}</b>`,
    `📷 กล้อง: <b>${CAM_NAMES[CAM.mode]}</b> → ${shot}`,
    `🏁 อันดับ ${S.rank}/6 · ${(S.speed * KMH).toFixed(0)} km/h · ${((S.position + PLAYER_Z) / SEG_L * M_PER_SEG / 1000).toFixed(2)} km`,
    `🎵 เพลง ${S.musicOn ? 'เปิด' : 'ปิด'} · 🗣️ เสียงพูด ${S.voiceOn ? 'เปิด' : 'ปิด'}${THAI_VOICE ? '' : ' (เครื่องนี้ไม่มีเสียงไทย ใช้เสียงการ์ตูน)'} · ${S.paused ? '⏸ หยุดอยู่' : '▶ กำลังเล่น'}`,
    `💎 ยอดเชียร์: ${CHAR_NAMES.map((n, i) => `${n} ${S.support[i]}`).join(' · ')}`,
  ].join('<br>');
  const ts = ADMIN.el && ADMIN.el.querySelector('#admTkStat');
  if (ts) {
    const st = { connected: '🔴 LIVE เชื่อมแล้ว', connecting: '🟡 กำลังเชื่อม…', offline: '⚪ ยังไม่เจอไลฟ์ — กด Go LIVE ใน TikTok แล้วรอสักครู่ (ลองใหม่อัตโนมัติ)', off: '⚪ ยังไม่ได้เชื่อม' }[L.status] || L.status;
    ts.innerHTML = !L.server ? '⚠️ ไม่ได้ต่อเซิร์ฟเวอร์ — เปิดเกมที่ http://localhost:3000' : `${L.username ? '@' + adminEsc(L.username) + ' · ' : ''}${st}${L.status === 'offline' && L.error ? '<br><small>' + adminEsc(L.error) + '</small>' : ''}`;
  }
  refreshAdminButtons();
}

// ----------------------------------------------------------- world
let ENV = null;
const SEGS = [];
function renderWorld(env) {
  drawSky(env);
  const ps = playerScene();
  ctx.fillStyle = rgb(mix(ps.scene.grass[0], env.fog, 0.6));
  ctx.fillRect(-500, HORIZON, W + 1000, H - HORIZON + 600);
  drawBackground(env);

  // rev = กล้องหันหลัง (มองย้อนไปทางที่ปั่นมา เห็นหน้านักปั่น)
  const rev = !!CAM.rev;
  MIR = rev ? -1 : 1;
  const camZ = CAM.z, camXo = CAM.x;
  const base = Math.floor(camZ / SEG_L);
  const basePct = (camZ % SEG_L) / SEG_L;
  const pz = camZ + (rev ? 0 : PLAYER_Z);
  const pIdx = Math.floor(pz / SEG_L), pPct = (pz % SEG_L) / SEG_L;
  const playerY = lerp(getSeg(pIdx).y, getSeg(pIdx + 1).y, pPct);
  const jump = S.jumpT > 0 ? Math.sin((1 - S.jumpT / S.jumpDur) * Math.PI) * S.jumpH : 0;
  const bump = Math.sin(S.pedalPhase * 2) * 6 * Math.min(1, S.speed / MAX_SPEED) + (Math.abs(S.playerX) > 1 ? (Math.random() - 0.5) * 30 * S.speed / MAX_SPEED : 0);
  // ก้มหมอบ = ตาต่ำลง, ยกล้อ = ตาสูงขึ้นเล็กน้อย, ล้ม = ตาเกือบติดพื้น
  let camY = playerY + CAM_H * (1 - 0.3 * S.fx.tuck - 0.7 * S.fx.crash) + 60 * S.fx.wheelie + jump + bump;
  if (CAM.povOf !== 'player') {
    const rj = CAM.povOf && CAM.povOf.jumpT > 0 ? Math.sin((1 - CAM.povOf.jumpT / 1.2) * Math.PI) * 420 : 0;
    camY = playerY + CAM.h + rj + (CAM.shot === 'rearcam' ? bump : 0);
  }

  const camRW = ROAD_W * getSeg(pIdx).wm;   // ตำแหน่งกล้องซ้าย-ขวา ตามความกว้างทางตรงนั้น
  let x = 0, dx = rev ? getSeg(base).curve * (1 - basePct) : -(getSeg(base).curve * basePct);
  let maxy = H;
  SEGS.length = 0;
  for (let n = 0; n < DRAW; n++) {
    const i = rev ? base - n : base + n;
    const s = getSeg(i), s2 = getSeg(i + 1);
    s.fog = Math.exp(-Math.pow(n / DRAW, 2) * env.fogD);
    if (!rev) {
      project(s.p1, camXo * camRW - x, camY, camZ, s.y, i * SEG_L, s.wm);
      project(s.p2, camXo * camRW - x - dx, camY, camZ, s2.y, (i + 1) * SEG_L, s2.wm);
      x += dx; dx += s.curve;
    } else {
      // ใกล้ = ปลาย segment, ไกล = ต้น segment; ซ้าย-ขวากลับด้าน
      project(s.p1, -camXo * camRW - x, camY, -camZ, s2.y, -(i + 1) * SEG_L, s2.wm);
      project(s.p2, -camXo * camRW - x - dx, camY, -camZ, s.y, -i * SEG_L, s.wm);
      x += dx; dx -= s.curve;
    }
    s.clip = maxy;
    SEGS.push(s);
    s.vis = !(s.p1.cz <= CAM_D || s.p2.y >= s.p1.y || s.p2.y >= maxy);
    if (s.vis) maxy = s.p2.y;
  }
  // แพนกล้องซ้าย-ขวาให้เป้าโฟกัสอยู่กลางจอ
  let panT = 0;
  const fc = CAM.focus2;
  if (fc) {
    const fi = Math.floor(fc.z / SEG_L), fs = SEGS.find(q => q.i === fi);
    if (fs && fs.p1.scale > 0) {
      const t = rev ? 1 - (fc.z % SEG_L) / SEG_L : (fc.z % SEG_L) / SEG_L;
      const sx = lerp(fs.p1.x, fs.p2.x, t) + lerp(fs.p1.w, fs.p2.w, t) * fc.x * MIR;
      panT = clamp(W / 2 - sx, -W * 0.7, W * 0.7);
      CAM.dbg = { sx, sy: lerp(fs.p1.y, fs.p2.y, t) - fc.lift * lerp(fs.p1.scale, fs.p2.scale, t) * W / 2, W, H };
    }
  }
  CAM.pan = CAM.panSnap ? panT : lerp(CAM.pan || 0, panT, 0.18);
  CAM.panSnap = false;
  ctx.save();
  ctx.translate(CAM.pan, 0);
  for (const s of SEGS) if (s.vis) drawSegment(s, env);

  // จัดกลุ่มสิ่งของ / นักปั่น ตาม segment
  const bySeg = new Map();
  const add = (z, e) => { const i = Math.floor(z / SEG_L); e.pct = (z % SEG_L) / SEG_L; let a = bySeg.get(i); if (!a) bySeg.set(i, a = []); a.push(e); };
  const ahead = (z, m) => rev ? camZ - z > m : z - camZ > m;
  for (const o of S.objects) if (!o.taken && ahead(o.z, 0)) add(o.z, { o });
  for (const r of S.rivals) if (r !== CAM.povOf && ahead(r.z, 260)) add(r.z, { r });
  if (!SP.on) for (const r of S.pack) if (ahead(r.z, 260)) add(r.z, { r });
  if (CAM.povOf !== 'player' && CAM.shot !== 'rearcam' && ahead(PLAYER_SPRITE.z, 260)) add(PLAYER_SPRITE.z, { r: PLAYER_SPRITE });
  for (const p of S.projectiles) if (ahead(p.z, 200)) add(p.z, { p });

  LIGHTS.length = 0;
  for (let n = DRAW - 1; n > 0; n--) {
    const s = SEGS[n];
    if (!s || s.p1.scale <= 0 || s.p1.cz <= CAM_D) continue;
    const list = bySeg.get(s.i);
    if (!s.decos.length && !list) continue;
    const clipY = s.clip;
    const needClip = s.p1.y > clipY + 1;
    if (needClip) { ctx.save(); ctx.beginPath(); ctx.rect(-500, -600, W + 1000, clipY + 600); ctx.clip(); }
    ctx.globalAlpha = clamp(s.fog * 1.3, 0, 1);
    const k = s.p1.scale * W / 2;
    for (const d of s.decos) {
      const sx = s.p1.x + s.p1.w * d.off * MIR;
      if (sx < -W * 1.5 || sx > W * 2.5) continue;
      drawDeco(d, sx, s.p1.y, k);
    }
    if (list) {
      // วาดจากไกลไปใกล้
      list.sort((a, b) => rev ? a.pct - b.pct : b.pct - a.pct);
      for (const e of list) {
        const t = rev ? 1 - e.pct : e.pct;
        const px = lerp(s.p1.x, s.p2.x, t), py = lerp(s.p1.y, s.p2.y, t), pw = lerp(s.p1.w, s.p2.w, t);
        const pk = lerp(s.p1.scale, s.p2.scale, t) * W / 2;
        if (e.o) {
          const sx = px + pw * e.o.x * MIR;
          if (e.o.kind === 'item') drawItem(e.o, sx, py, pk); else drawObstacle(e.o, sx, py, pk, pw);
        } else if (e.p) {
          const size = Math.min(160, 280 * pk * 1.6);
          ctx.save();
          ctx.translate(px + pw * e.p.x * MIR, py - e.p.h * pk - size / 2);
          ctx.rotate(S.t * 12);
          drawEmo(e.p.emoji, 0, size / 2, size);
          ctx.restore();
        } else drawRider(px + pw * e.r.x * MIR, py, pk, e.r);
      }
    }
    ctx.globalAlpha = 1;
    if (needClip) ctx.restore();
  }
  ctx.restore();
  MIR = 1;
}

// ----------------------------------------------------------- POV bike
function drawKnee(x, k, shorts) {
  const lift = 45 + 70 * (k * 0.5 + 0.5);
  const y = H - lift + 70;
  ell(x, y + 40, 62, 95, shorts || '#1b1b1b');
  ell(x, y - 40, 46, 40, '#c68c5a');
  ell(x - 10, y - 55, 18, 10, 'rgba(255,255,255,0.15)');
}
function drawHand(x, y, side, col) {
  ctx.strokeStyle = '#c68c5a'; ctx.lineWidth = 62; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - side * 70, H + 60); ctx.lineTo(x - side * 6, y + 28); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 66;
  ctx.beginPath(); ctx.moveTo(x - side * 70, H + 60); ctx.lineTo(x - side * 48, H - 40); ctx.stroke();
  ctx.lineCap = 'butt';
  ell(x, y + 6, 58, 40, '#2b2b2b');
  ell(x + side * 6, y - 4, 40, 22, col);
  for (let i = 0; i < 4; i++) ell(x - 33 + i * 22, y - 30, 12, 10, '#262626');
  ell(x - side * 46, y + 18, 18, 12, '#262626');
}
// who = null → ผู้เล่น, หรือ rival → มุมสายตาของคู่แข่งคนนั้น
function drawPOV(who) {
  const V = who ? {
    speed: who.speed, phase: who.phase, shake: who.fallT > 0 ? 0.6 : 0, steer: clamp((who.tx - who.x) * 2, -1, 1),
    wheel: who.z, lift: who.wheelieT > 0 ? -90 : 0, tuck: 0, jump: who.jumpT > 0 ? Math.sin((1 - who.jumpT / 1.2) * Math.PI) : 0,
    glove: who.jersey, shorts: who.shorts, km: who.z,
  } : {
    speed: S.speed, phase: S.pedalPhase, shake: S.shake, steer: S.steerVis, wheel: S.wheelRot,
    lift: -90 * S.fx.wheelie - 55 * S.fx.tuck + 60 * S.fx.crash, tuck: S.fx.tuck,
    jump: S.jumpT > 0 ? Math.sin((1 - S.jumpT / S.jumpDur) * Math.PI) : 0,
    glove: '#ff7043', shorts: '#1b1b1b', km: S.position + PLAYER_Z,
  };
  const sp = V.speed / MAX_SPEED;
  const bob = Math.sin(V.phase * 2) * 2.5 * Math.min(1, sp + 0.2);
  const ox = (Math.random() - 0.5) * V.shake * 14, oy = (Math.random() - 0.5) * V.shake * 12 + bob;
  ctx.save();
  // ยกล้อหน้า = แฮนด์ลอยขึ้นมาหาตัว, ก้มหมอบ = หน้าใกล้แฮนด์
  ctx.translate(ox, oy + V.lift - V.jump * 30);
  if (V.tuck > 0.01) { const sc = 1 + 0.12 * V.tuck; ctx.translate(W / 2, 800); ctx.scale(sc, sc); ctx.translate(-W / 2, -800); }
  drawKnee(W / 2 - 128, Math.sin(V.phase), V.shorts);
  drawKnee(W / 2 + 128, Math.sin(V.phase + Math.PI), V.shorts);

  ctx.translate(W / 2, 900); ctx.rotate(V.steer * 0.16); ctx.translate(-W / 2, -900);
  // ล้อหน้า
  ell(W / 2, 1040, 46, 230, '#151515');
  ctx.fillStyle = '#2d2d2d';
  const off = (V.wheel * 0.08) % 28;
  for (let yy = 812 + off; yy < H; yy += 28) {
    const half = 46 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - 1040) / 230, 2)));
    ctx.fillRect(W / 2 - half + 4, yy, half * 2 - 8, 10);
  }
  // โช้คหน้า
  for (const side of [-1, 1]) {
    poly([W / 2 + side * 72, 836, W / 2 + side * 54, 836, W / 2 + side * 50, H, W / 2 + side * 74, H], '#1e1e1e');
    poly([W / 2 + side * 70, 836, W / 2 + side * 56, 836, W / 2 + side * 55, 900, W / 2 + side * 69, 900], '#c9a227');
  }
  rr(W / 2 - 84, 818, 168, 30, 10, '#262626');
  // สเต็ม
  rr(W / 2 - 26, 768, 52, 64, 8, '#1c1c1c');
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(W / 2 - 18, 772, 8, 54);
  // แฮนด์
  ctx.lineCap = 'round';
  const bar = () => { ctx.beginPath(); ctx.moveTo(40, 760); ctx.bezierCurveTo(140, 768, 200, 792, W / 2, 790); ctx.bezierCurveTo(W - 200, 792, W - 140, 768, W - 40, 760); };
  ctx.strokeStyle = '#141414'; ctx.lineWidth = 20; bar(); ctx.stroke();
  ctx.save(); ctx.translate(0, -5); ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 4; bar(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#a0a0a0'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(150, 770); ctx.lineTo(78, 736); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 150, 770); ctx.lineTo(W - 78, 736); ctx.stroke();
  ctx.lineCap = 'butt';
  rr(W / 2 - 104, 776, 28, 26, 6, '#222');
  rr(W / 2 + 76, 776, 28, 26, 6, '#222');
  // ไฟหน้า
  const night = ENV.dark > 0.25;
  rr(W / 2 + 34, 798, 40, 22, 8, '#333');
  ell(W / 2 + 54, 809, 7, 7, night ? '#fffde7' : '#777');
  // มือ
  drawHand(78, 756, -1, V.glove);
  drawHand(W - 78, 756, 1, V.glove);
  // ไมล์จักรยาน
  rr(W / 2 - 72, 706, 144, 78, 14, '#101010');
  rr(W / 2 - 64, 714, 128, 62, 8, night ? '#4dd0e1' : '#a8c79a');
  const kmh = V.speed * KMH;
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  font(34, 800); ctx.fillStyle = '#0d1f14'; ctx.fillText(kmh.toFixed(1), W / 2 + 26, 750);
  font(12, 600); ctx.fillText('km/h', W / 2 + 60, 750);
  ctx.textAlign = 'center';
  font(13, 600);
  ctx.fillText(who ? who.name : `${(V.km / SEG_L * M_PER_SEG / 1000).toFixed(2)} km`, W / 2, 769);
  ctx.restore();
}

// ----------------------------------------------------------- weather FX
function drawWeatherFX(env) {
  if (env.rain > 0.02) {
    ctx.strokeStyle = `rgba(200,215,235,${0.45 * env.rain})`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = Math.floor(S.drops.length * env.rain);
    for (let i = 0; i < n; i++) { const d = S.drops[i]; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.18, d.y + d.l); }
    ctx.stroke();
  }
  if (env.snow > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * env.snow})`;
    const n = Math.floor(S.flakes.length * env.snow);
    for (let i = 0; i < n; i++) { const f = S.flakes[i]; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); }
  }
  if (env.dry > 0.02) {
    ctx.fillStyle = `rgba(210,180,130,${0.5 * env.dry})`;
    const n = Math.floor(S.dust.length * env.dry);
    for (let i = 0; i < n; i++) { const d = S.dust[i]; ctx.fillRect(d.x, d.y, d.r * 2, d.r); }
    ctx.fillStyle = `rgba(220,190,140,${0.12 * env.dry})`; ctx.fillRect(0, 0, W, H);
  }
  if (env.hot > 0.02) {
    ctx.strokeStyle = `rgba(255,230,190,${0.07 * env.hot})`; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const yy = HORIZON + 6 + i * 9;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, yy + Math.sin(x * 0.05 + S.t * 6 + i) * 2.5);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,160,60,${0.08 * env.hot})`; ctx.fillRect(0, 0, W, H);
  }
  if (env.cold + env.snow > 0.02) {
    ctx.fillStyle = `rgba(160,200,255,${0.1 * clamp(env.cold + env.snow, 0, 1)})`; ctx.fillRect(0, 0, W, H);
    for (const b of S.breath) {
      const a = (1 - b.t / 1.4) * 0.35;
      ell(b.x, 690 - b.t * 90, 30 + b.t * 70, 18 + b.t * 40, `rgba(255,255,255,${a})`);
    }
  }
  if (S.splashT > 0) {
    for (let i = 0; i < 14; i++) {
      const x = hash2(i, 3) * W, y = hash2(i, 4) * H * 0.8;
      ell(x, y, 10 + hash2(i, 5) * 22, 10 + hash2(i, 5) * 22, `rgba(200,225,255,${S.splashT * 0.35})`);
    }
  }
}
function drawGrading(env) {
  if (env.warm > 0.01) { ctx.fillStyle = `rgba(255,120,40,${env.warm * 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (env.dark > 0.01) {
    const g = ctx.createRadialGradient(W / 2, H * 0.6, 30, W / 2, H * 0.55, H * 0.72);
    g.addColorStop(0, `rgba(10,12,30,${env.dark * 0.3})`);
    g.addColorStop(0.45, `rgba(8,10,28,${env.dark * 0.75})`);
    g.addColorStop(1, `rgba(4,5,15,${env.dark * 1.15})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // ลำแสงไฟหน้า
    if (env.dark > 0.25) {
      const lg = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, 260);
      lg.addColorStop(0, `rgba(255,250,220,${(env.dark - 0.25) * 0.35})`);
      lg.addColorStop(1, 'rgba(255,250,220,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
  }
  if (LIGHTS.length && env.dark > 0.2) {
    ctx.globalCompositeOperation = 'lighter';
    for (const L of LIGHTS) {
      if (L.r < 2) continue;
      const lx = L.x + (CAM.pan || 0);   // ไฟถูกเก็บก่อนแพนกล้อง
      const g = ctx.createRadialGradient(lx, L.y, 0, lx, L.y, L.r);
      g.addColorStop(0, `rgba(${L.c},${0.5 * env.dark})`);
      g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(lx - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (S.lightning > 0) { ctx.fillStyle = `rgba(255,255,255,${S.lightning * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (S.hitFlash > 0) { ctx.fillStyle = `rgba(255,30,30,${S.hitFlash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  // เส้นความเร็ว
  const fast = Math.max(S.boostFlash, clamp((S.speed / MAX_SPEED - 1.05) * 3, 0, 1), S.effects.some(e => e.key === 'turbo') ? 0.8 : 0);
  if (fast > 0.02) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * fast})`; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = hash2(i + Math.floor(S.t * 12) * 37, 9) * Math.PI * 2;
      const r0 = 160 + hash2(i, 8) * 120, r1 = r0 + 140;
      ctx.moveTo(W / 2 + Math.cos(a) * r0, HORIZON + Math.sin(a) * r0);
      ctx.lineTo(W / 2 + Math.cos(a) * r1, HORIZON + Math.sin(a) * r1);
    }
    ctx.stroke();
  }
  if (S.sleepT > 0) {
    const a = clamp(Math.min(S.sleepT, 4.5 - S.sleepT + 0.5), 0, 1) * 0.85;
    ctx.fillStyle = `rgba(10,8,30,${a})`; ctx.fillRect(0, 0, W, H);
    textC('😴 พักนอน...', W / 2, H * 0.42, `rgba(255,255,255,${a})`, 38, 800);
    for (let i = 0; i < 3; i++) textC('z', W / 2 + 70 + i * 22, H * 0.36 - i * 26 - (S.t * 20 % 20), `rgba(200,200,255,${a})`, 22 + i * 8, 800);
    textC(`ฟื้นพลัง  ⚡${S.energy | 0}  ❤️${S.health | 0}  💧${S.water | 0}`, W / 2, H * 0.48, `rgba(220,220,255,${a})`, 18, 600);
  }
}

// ----------------------------------------------------------- HUD
function bar(x, y, w, h, val, col, icon, low) {
  rr(x, y, w, h, h / 2, 'rgba(0,0,0,0.5)');
  const blink = low && val < 20 && Math.sin(S.t * 10) > 0;
  rr(x + 2, y + 2, Math.max(0, (w - 4) * val / 100), h - 4, (h - 4) / 2, blink ? '#fff' : col);
  textC(icon, x + 13, y + h / 2 + 1, '#fff', 13, 600);
  font(12, 600); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(`${val | 0}`, x + w - 8, y + h / 2 + 1);
}
const MAP_S = 84, MAP_Y = 90;   // แผนที่มุมขวาบน
const RANK_W = 118;              // กล่องอันดับมุมซ้ายบน
const TOP_TEXT_W_PAD = Math.max(MAP_S, RANK_W) + 14;
let TOP_TEXT_W = 300;           // ความกว้างข้อความกลางจอที่ไม่ทับแผนที่ (คำนวณตาม W)
function fitFont(str, maxW, size, min, weight) {
  TOP_TEXT_W = Math.max(200, W - 2 * TOP_TEXT_W_PAD);
  let fs = size;
  font(fs, weight);
  while (fs > min && ctx.measureText(str).width > maxW) { fs--; font(fs, weight); }
  return fs;
}
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function drawGPS(x0, y0, w) {
  // GPS: ทิศ · ความสูง · ความชัน · ระยะทาง (ย่อไว้ใต้แผนที่)
  const zz = S.position + PLAYER_Z, si = Math.floor(zz / SEG_L);
  const elev = Math.round(getSeg(si).y / U_PER_M + 180);
  const slope = Math.round((getSeg(si + 1).y - getSeg(si).y) / SEG_L * 100);
  const hd = Math.round((TEL.heading + 360) % 360);
  const km = (zz / SEG_L * M_PER_SEG / 1000).toFixed(2);
  rr(x0, y0, w, 50, 10, 'rgba(0,0,0,0.16)', 'rgba(255,255,255,0.12)', 1);
  font(11, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#69f0ae'; ctx.fillText(`🧭 ${COMPASS[Math.round(hd / 45) % 8]} ${hd}°`, x0 + 6, y0 + 10);
  ctx.fillStyle = '#fff'; ctx.fillText(`⛰️ ${elev} ม.`, x0 + 6, y0 + 25);
  ctx.fillStyle = slope > 3 ? '#ffab91' : slope < -3 ? '#b9f6ca' : '#fff';
  ctx.fillText(`📐 ${slope > 0 ? '+' : ''}${slope}%`, x0 + 6, y0 + 39);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd54f'; ctx.fillText(`${km}km`, x0 + w - 5, y0 + 39);
  textC('GPS', x0 + w - 16, y0 + 10, 'rgba(255,255,255,0.5)', 9, 700);
  ctx.textAlign = 'center';
}
function drawMinimap(x0, y0, size) {
  rr(x0, y0, size, size, 12, 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.12)', 1);
  ctx.save();
  rrPath(x0 + 2, y0 + 2, size - 4, size - 4, 10); ctx.clip();
  const pIdx = playerSegIdx();
  const cx = x0 + size / 2, cy = y0 + size * 0.7;
  const sc = 0.2 * size / 142, K = 0.0032, STEP = 4;
  const fwd = [[0, 0, pIdx]];
  let hx = 0, hy = 0, h = 0;
  for (let i = pIdx; i < pIdx + 560; i += STEP) { h += getSeg(i).curve * K * STEP; hx += Math.sin(h) * STEP; hy -= Math.cos(h) * STEP; fwd.push([hx, hy, i + STEP]); }
  const back = [[0, 0, pIdx]];
  hx = 0; hy = 0; h = 0;
  for (let i = pIdx; i > pIdx - 220; i -= STEP) { h -= getSeg(i).curve * K * STEP; hx -= Math.sin(h) * STEP; hy += Math.cos(h) * STEP; back.push([hx, hy, i - STEP]); }
  const path = back.slice().reverse().concat(fwd.slice(1));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6;
  ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + p[0] * sc, cy + p[1] * sc)); ctx.stroke();
  ctx.lineWidth = 3.5;
  for (let i = 1; i < path.length; i++) {
    ctx.strokeStyle = getSeg(path[i][2]).scene.map;
    ctx.beginPath(); ctx.moveTo(cx + path[i - 1][0] * sc, cy + path[i - 1][1] * sc); ctx.lineTo(cx + path[i][0] * sc, cy + path[i][1] * sc); ctx.stroke();
  }
  // คู่แข่ง
  for (const r of S.rivals) {
    const ri = Math.floor(r.z / SEG_L);
    let p;
    if (ri >= pIdx) { const j = Math.floor((ri - pIdx) / STEP); p = fwd[Math.min(j, fwd.length - 1)]; if (j >= fwd.length) p = null; }
    else { const j = Math.floor((pIdx - ri) / STEP); p = back[Math.min(j, back.length - 1)]; if (j >= back.length) p = null; }
    if (p) {
      ell(cx + p[0] * sc, cy + p[1] * sc, 4, 4, '#000');
      ell(cx + p[0] * sc, cy + p[1] * sc, 3.2, 3.2, r.jersey);
    } else {
      const ahead = ri >= pIdx;
      textC(ahead ? '▲' : '▼', x0 + 10 + r.idx * 11, ahead ? y0 + 9 : y0 + size - 9, r.jersey, 9, 800);
    }
  }
  // ผู้เล่น
  poly([cx, cy - 7, cx - 5, cy + 5, cx + 5, cy + 5], '#fff');
  poly([cx, cy - 4.5, cx - 3, cy + 3, cx + 3, cy + 3], '#ff7043');
  ctx.restore();
  textC('MAP', x0 + size - 16, y0 + size - 9, 'rgba(255,255,255,0.6)', 9, 700);
}
function drawRankList(x0, y0) {
  const pz = S.position + PLAYER_Z;
  const order = S.order || [{ me: true, z: pz }, ...S.rivals].sort((a, b) => b.z - a.z);
  const w = RANK_W, rowH = 20, head = 20;
  rr(x0, y0, w, head + order.length * rowH + 4, 10, 'rgba(0,0,0,0.16)', 'rgba(255,255,255,0.12)', 1);
  font(11, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd54f';
  ctx.fillText(`🏆 อันดับ ${S.rank}/${order.length}`, x0 + 7, y0 + 11);
  order.forEach((o, i) => {
    const y = y0 + head + i * rowH + rowH / 2;
    if (o.me) rr(x0 + 3, y - rowH / 2 + 1, w - 6, rowH - 2, 6, 'rgba(255,112,67,0.3)');
    ell(x0 + 12, y, 6.5, 6.5, o.me ? '#ff7043' : o.jersey);
    textC(String(i + 1), x0 + 12, y + 1, i === 0 ? '#000' : '#fff', 9, 800);
    font(11, 600); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    const nm = (i === 0 ? '👑' : '') + (o.me ? 'คุณ' : o.name);
    ctx.fillText(nm, x0 + 22, y + 1);
    const sup = S.support[o.me ? 0 : o.char];
    if (sup > 0) { const nw = ctx.measureText(nm).width; font(8, 600); ctx.fillStyle = '#80d8ff'; ctx.fillText(`💎${fmtK(sup)}`, x0 + 24 + nw, y + 1); font(11, 600); }
    // แรงปั่นของแต่ละคน: แถบเล็กใต้ชื่อ + ไอคอนอาการ
    {
      const e = o.me ? S.pe.effort : o.effort || 0, lv = effortLv(e);
      rr(x0 + 22, y + 6, w - 30, 3, 1.5, 'rgba(255,255,255,0.15)');
      rr(x0 + 22, y + 6, Math.max(3, (w - 30) * e / 100), 3, 1.5, lv.color);
      font(9, 600); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.fillText((o.me ? S.stopT : o.stopT) > 0 ? '💥' : o.say ? '💬' : lv.icon, x0 + w - 46, y);
      font(11, 600);
    }
    ctx.textAlign = 'right';
    if (!o.me) {
      const m = (o.z - pz) / SEG_L * M_PER_SEG;
      ctx.fillStyle = m > 0 ? '#ff8a80' : '#b9f6ca';
      ctx.fillText(`${m > 0 ? '+' : ''}${m.toFixed(0)}ม.`, x0 + w - 6, y + 1);
    } else { ctx.fillStyle = '#ffccbc'; ctx.fillText('—', x0 + w - 6, y + 1); }
  });
  return y0 + head + order.length * rowH + 4;
}
function softText(str, x, y, col, size, weight) {
  font(size, weight);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}
function fmtK(n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n); }
function giftGuide() {
  const out = [];
  const c = S.liveCfg;
  if (c) {
    for (const [g, a] of Object.entries(c.giftActions || {})) if (ACTIONS[a]) out.push(`🎁 ${g} = ${ACTIONS[a].icon} ${ACTIONS[a].name}`);
    if (c.likesPerJump) out.push(`❤️ ไลก์ครบ ${c.likesPerJump} = 🦘 กระโดด`);
  }
  out.push('💬 พิมพ์ 1-6 ในแชท เลือกเชียร์: 1 คุณ • 2 สมชาย • 3 มานี • 4 ปิติ • 5 ชูใจ • 6 วีระ');
  const top = Object.entries(S.gifters).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) out.push('👑 ผู้สนับสนุน: ' + top.map(([n, v]) => `${n} ${v}💎`).join(' • '));
  return out;
}
function drawHUD(env) {
  const th = env.th;
  // แถบบน
  const tg = ctx.createLinearGradient(0, 0, 0, 120);
  tg.addColorStop(0, 'rgba(0,0,0,0.65)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 120);
  const hh = String(th.h).padStart(2, '0'), mm = String(th.m).padStart(2, '0');
  font(20, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(`🕐 ${hh}:${mm} น.`, 12, 20);
  const wc = WEATHERS[S.wCur];
  const temp = Math.round(lerp(wc.t[0], wc.t[1], 0.5 + 0.5 * Math.sin((env.h - 9) / 24 * Math.PI * 2)));
  font(14, 600); ctx.fillStyle = '#e3f2fd';
  ctx.fillText(`${wc.icon} ${wc.name} ${temp}°C  (ไทย GMT+7)`, 12, 44);
  const ps = playerScene().scene;
  const nextMs = SCENE_MS - (th.ms % SCENE_MS);
  textC(SP.on ? `${spPhase().icon} ${spPhase().name}` : `${ps.icon} ${ps.name}`, W / 2 + 50, 20, '#fff', 19, 800);
  textC(`ฉากใหม่ใน ${fmtMS(nextMs)}`, W / 2 + 50, 44, '#b3e5fc', 13, 600);
  const L = S.live;
  const liveTxt = L.status === 'connected' ? '🔴 LIVE' : L.status === 'connecting' ? '🟡 กำลังเชื่อม' : L.username ? '⚪ ไลฟ์ออฟไลน์' : (L.server ? '⚪ ไม่ได้เชื่อม TikTok' : '⚪ ออฟไลน์');
  font(13, 800); ctx.textAlign = 'right'; ctx.fillStyle = L.status === 'connected' ? '#ff8a80' : 'rgba(255,255,255,0.7)';
  ctx.fillText(liveTxt, W - 12, 20);
  if (L.username) { font(12, 600); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`@${L.username}  ❤️ ${fmtK(L.likes)}`, W - 12, 44); }

  // แถบสถานะ
  const bw = (W - 24 - 16) / 3;
  bar(12, 62, bw, 22, S.energy, '#ffca28', '⚡', true);
  bar(12 + bw + 8, 62, bw, 22, S.water, '#29b6f6', '💧', true);
  bar(12 + (bw + 8) * 2, 62, bw, 22, S.health, '#ef5350', '❤️', true);

  // ---- ข้อความเอฟเฟกต์: อยู่ด้านบนจอ สีจางโปร่งแสง
  if (S.banner) {
    const b = S.banner, a = clamp(Math.min(b.t * 4, (2.8 - b.t) * 3), 0, 1);
    ctx.globalAlpha = a * 0.95;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 92, W, 58);
    softText(b.title, W / 2, 110, 'rgba(255,255,255,0.95)', fitFont(b.title, TOP_TEXT_W, 24, 14, 800), 800);
    if (b.sub) softText(b.sub, W / 2, 136, 'rgba(255,240,200,0.9)', fitFont(b.sub, TOP_TEXT_W, 14, 10, 600), 600);
    ctx.globalAlpha = 1;
  }
  S.toasts.forEach((t, i) => {
    const a = clamp(Math.min(t.t * 5, (t.dur - t.t) * 3), 0, 1);
    const y = 168 + i * 28;
    const fs = fitFont(t.text, TOP_TEXT_W - 20, 15, 10, 600);   // ไม่ให้ทับแผนที่มุมขวาบน
    const tw = Math.min(TOP_TEXT_W, ctx.measureText(t.text).width + 20);
    ctx.globalAlpha = a * 0.92;
    rr(W / 2 - tw / 2, y - 12, tw, 24, 12, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.18)', 1);
    softText(t.text, W / 2, y + 1, t.color, fs, 600);
    ctx.globalAlpha = 1;
  });

  // ---- แผนที่ + GPS (มุมขวาบน ขนาดเล็ก)
  if (!SP.on) { drawMinimap(W - MAP_S - 8, MAP_Y, MAP_S); drawGPS(W - MAP_S - 8, MAP_Y + MAP_S + 4, MAP_S); }

  // ---- อันดับ & ความยาก
  const yEnd = drawRankList(8, MAP_Y);   // อันดับ: มุมซ้ายบน ระดับเดียวกับแผนที่
  const d = DIFFS[S.diff], DY = MAP_Y + MAP_S + 60, dx = W - MAP_S - 8, dc = dx + MAP_S / 2;
  rr(dx, DY, MAP_S, 34, 8, 'rgba(0,0,0,0.16)');
  textC(`ความยาก: ${d.name}`, dc, DY + 10, d.color, 10, 800);
  textC(LOCK.diff !== null ? '🔒 ล็อกไว้' : `สุ่มใหม่ใน ${fmtMS(DIFF_MS - th.ms % DIFF_MS)}`, dc, DY + 24, '#ddd', 9, 600);
  textC(LOCK.weather ? '🔒 อากาศล็อกไว้' : `อากาศเปลี่ยนใน ${fmtMS(WEATHER_MS - th.ms % WEATHER_MS)}`, dc, DY + 44, 'rgba(255,255,255,0.7)', 9, 600, true);

  // เอฟเฟกต์ที่ทำงานอยู่
  let ex = 12;
  for (const e of S.effects) {
    if (!e.icon) continue;
    const left = clamp((e.until - S.gt) / e.total, 0, 1);
    rr(ex, yEnd + 8, 38, 38, 10, 'rgba(0,0,0,0.18)');
    ctx.strokeStyle = (e.maxMult || 1) * (e.accel || 1) >= 1 && !e.reverse && !e.slip ? '#69f0ae' : '#ff5252';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ex + 19, yEnd + 27, 16, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
    textC(e.icon, ex + 19, yEnd + 28, '#fff', 17, 600);
    ex += 44;
  }

  // ช่วงทาง / ความชัน / ออกนอกทาง / ข้อความลอย (คอลัมน์กลาง ด้านบน)
  if (!SP.on && S.curSec && sectionLabel(S.curSec)) { const sl = sectionLabel(S.curSec); softText(sl, W / 2, 240, 'rgba(255,255,255,0.9)', fitFont(sl, W - 40, 13, 9, 700), 700); }
  if (Math.abs(S.slope) > 0.04) {
    const up = S.slope > 0;
    softText(`${up ? '⛰️ ขึ้นเขา' : '🎢 ลงเขา'} ${Math.abs(S.slope * 100).toFixed(0)}%`, W / 2, 268, up ? 'rgba(255,204,188,0.9)' : 'rgba(200,230,201,0.9)', 15, 800);
  }
  if (Math.abs(S.playerX) > 1) softText('⚠️ ออกนอกเส้นทาง!', W / 2, 292, 'rgba(255,245,157,0.9)', 16, 800);
  for (const f of S.floaters) {
    ctx.globalAlpha = (1 - f.t / 1.6) * 0.9;
    softText(f.text, W / 2, 330 - f.t * 50, f.color, 20, 800);
    ctx.globalAlpha = 1;
  }

  // ---- ป้ายมุมกล้อง
  {
    const shotName = shotLabel();
    const label = (CAM.mode === 'broadcast' ? '🔴 ถ่ายทอดสด • ' : '📷 ') + shotName;
    font(12, 600);
    const tw = ctx.measureText(label).width + 22;
    rr(W / 2 - tw / 2, 834, tw, 24, 12, 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.28)', 1);
    softText(label, W / 2, 847, 'rgba(255,255,255,0.9)', 12, 600);
  }
  // ---- ไกด์ของขวัญ TikTok (วนแสดง) + ผู้สนับสนุนสูงสุด
  const guide = giftGuide();
  if (guide.length) {
    const item = guide[Math.floor(S.t / 2.5) % guide.length];
    font(13, 600);
    const tw = Math.min(W - 40, ctx.measureText(item).width + 24);
    rr(W / 2 - tw / 2, 868, tw, 26, 13, 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.3)', 1);
    softText(item, W / 2, 882, 'rgba(255,255,255,0.92)', 13, 600);
  }

  // สถานะปั่นอัตโนมัติ
  // แรงปั่นของผู้เล่น 0-100% + อาการ
  {
    const lv = effortLv(S.pe.effort), pw = 270, px = W / 2 - pw / 2, py = 902;
    rr(px, py, pw, 46, 16, 'rgba(0,0,0,0.5)', lv.color, 2);
    const txt = S.sleepT > 0 ? '😴 กำลังพัก' : S.stopT > 0 ? '💥 หยุด! ตั้งหลักปั่นใหม่' : `${lv.icon} แรงปั่น ${S.pe.effort | 0}% · ${lv.name}`;
    textC(txt, W / 2, py + 15, lv.color, 16, 800);
    rr(px + 10, py + 29, pw - 20, 10, 5, 'rgba(255,255,255,0.15)');
    rr(px + 10, py + 29, Math.max(10, (pw - 20) * S.pe.effort / 100), 10, 5, lv.color);
    for (const t of [20, 40, 65, 85]) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 10 + (pw - 20) * t / 100 - 1, py + 29, 2, 10); }
  }
  if (!AC) textC('🔈 แตะจอเพื่อเปิดเสียง', W / 2, 890, 'rgba(255,255,255,0.75)', 13, 600, true);

  if (S.countdown > 0 && S.started) {
    const n = Math.ceil(S.countdown);
    textC(n > 3 ? 'เตรียมตัว' : String(n), W / 2, H * 0.4, '#fff', n > 3 ? 48 : 120, 800, true);
  }
}
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  textC('⏸ หยุดชั่วคราว', W / 2, H * 0.42, '#fff', 40, 800, true);
  textC('แตะเพื่อปั่นต่อ', W / 2, H * 0.5, '#ffe082', 22, 600);
  const km = ((S.position + PLAYER_Z) / SEG_L * M_PER_SEG / 1000).toFixed(2);
  textC(`ระยะทาง ${km} km • เวลา ${fmtMS(S.gt * 1000)}`, W / 2, H * 0.56, '#ccc', 16, 600);
}

// ----------------------------------------------------------- situation FX
function drawUnderHUD() {
  // ดวลกันสูสี: ขอบจอแดงเต้นเป็นจังหวะ
  if (S.battleT > 1) {
    const a = (0.12 + 0.08 * Math.sin(S.t * 8)) * clamp(S.battleT - 1, 0, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
    g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(1, `rgba(255,60,60,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // โดนปาเลอะจอ
  if (S.splatFx) {
    const f = S.splatFx, a = clamp(f.t / 0.8, 0, 1) * 0.85;
    ctx.globalAlpha = a;
    drawEmo(f.emoji, f.x, f.y + 120, 240);
    for (let i = 0; i < 6; i++) {
      const dx = (hash2(i, 31) - 0.5) * 240, len = 30 + hash2(i, 32) * 90 * (1 - f.t / 2.4 + 0.3);
      ell(f.x + dx, f.y + 60 + len / 2, 10 + hash2(i, 33) * 10, len / 2, 'rgba(200,40,30,0.55)');
    }
    ctx.globalAlpha = 1;
  }
}
function drawOverHUD() {
  // ของขวัญเด้งกลางจอ
  if (S.giftPop) {
    const g = S.giftPop, u = g.t;
    const a = clamp(Math.min(u * 5, (2.2 - u) * 3), 0, 1) * 0.92;
    const sc = u < 0.25 ? 0.5 + u * 2.4 : 1 + Math.sin(u * 10) * 0.03;
    const cx = W / 2, cy = 400;
    ctx.globalAlpha = a;
    const size = 96 * sc;
    if (g.img && g.img.complete && g.img.naturalWidth) ctx.drawImage(g.img, cx - size / 2, cy - size / 2, size, size);
    else drawEmo(g.emoji, cx, cy + size / 2, size);
    softText(`${g.user}`, cx, cy + size / 2 + 16, 'rgba(255,255,255,0.95)', 15, 800);
    if (g.count > 1) softText(`x${g.count}`, cx + size / 2 + 18, cy - size / 3, 'rgba(255,236,130,0.95)', 26, 800);
    ctx.globalAlpha = 1;
  }
  // ตัวหนังสือการ์ตูน (โกง!! / สูสี!! / ที่ 1!!)
  if (S.comicFx) {
    const c = S.comicFx, u = c.t;
    const sc = u < 0.15 ? u / 0.15 * 1.3 : 1.3 - Math.min(0.3, (u - 0.15) * 1.5);
    const a = clamp((1.3 - u) * 3, 0, 1) * 0.85;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, 520); ctx.rotate(-0.12); ctx.scale(sc, sc);
    font(54, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeText(c.text, 0, 0);
    ctx.fillStyle = c.color; ctx.fillText(c.text, 0, 0);
    ctx.restore();
  }
  // กระดาษโปรย
  for (const c of S.confetti) {
    ctx.save();
    ctx.globalAlpha = clamp(2.5 - c.t, 0, 1);
    ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = c.c; ctx.fillRect(-4, -2.5, 8, 5);
    ctx.restore();
  }
}

function render() {
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ENV = computeEnv();
  ctx.fillStyle = rgb(ENV.fog); ctx.fillRect(0, 0, W, H);
  HORIZON = CAM.hz + (SP.on ? 0 : CAM.pitch || 0);
  // มุมกล้องท่าพิเศษ (เฉพาะมุมมองผู้ปั่น): สไลด์ = เอียง, ล้ม = หมุนลงพื้น, ยกล้อ = เงยขึ้น
  const fx = S.fx, own = CAM.povOf === 'player';
  const roll = own ? fx.drift * 0.14 * fx.dir + fx.crash * 1.0 * fx.dir + Math.sin(S.t * 3) * 0.04 * fx.wheelie : 0;
  const launching = SP.on && spPhase().id === 'launch';
  // ลอยจากโนน: ตอนขึ้นเชิดหัว ตอนลงก้มหัว
  const air = own && S.jumpT > 0 && S.airBig ? Math.cos((1 - S.jumpT / S.jumpDur) * Math.PI) * (40 + 90 * S.airBig) : 0;
  const pitch = (own ? fx.wheelie * 110 - fx.tuck * 25 - fx.crash * 80 : 0) + air + (launching ? Math.pow(SP.t / 4.5, 2) * 1100 : 0);
  ctx.save();
  ctx.translate(W / 2, H * 0.8); ctx.rotate(roll); ctx.translate(-W / 2, -H * 0.8 + pitch);
  const inSpace = SP.on && !launching;
  if (inSpace) drawSpace(ENV);
  else {
    renderWorld(ENV);
    if (launching) { /* จรวดวาดใน drawLaunchFX */ }
    else if (own) drawPOV(null);
    else if (CAM.povOf) drawPOV(CAM.povOf);
    if (CAM.shot === 'roadside' && !launching) drawCrowd();
    if (CAM.shot === 'rearcam') drawRearCamBike();
  }
  ctx.restore();
  if (launching) drawLaunchFX();
  if (CAM.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${CAM.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  for (const p of S.skid) ell(p.x, p.y - p.t * 70, 20 + p.t * 60, 12 + p.t * 30, `rgba(190,170,140,${0.45 * (1 - p.t / 0.8)})`);
  if (!inSpace) { drawGrading(ENV); drawWeatherFX(ENV); }
  drawUnderHUD();
  if (!SP.on && ['pov', 'riderpov', 'rearcam'].includes(CAM.shot)) drawTelemetry(ENV);
  drawHUD(ENV);
  drawOverHUD();
  if (S.paused) drawPause();
}

// ----------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

resize();
initParticles();
initRivals();
initPack();
checkSlots(thaiTime());
S.lastScene = playerScene().sid;
startGame();
setupGiftPanel();
setupAdmin();
connectLive();
if (document.fonts && document.fonts.load) document.fonts.load('600 20px Kanit').catch(() => {});
requestAnimationFrame(frame);
window.__MTB = S; // สำหรับ debug
window.__MTB_live = onLiveMessage;
setSfxVol(SFX_VOL); setEnvVol(ENV_VOL);   // ให้สไลด์ทุกอันแสดงค่าที่จำไว้
window.__MTB_cam = CAM;
window.__MTB_audio = () => ({ ac: AC ? AC.state : null, sfx: SFX_GAIN ? SFX_GAIN.gain.value : null, vol: SFX_VOL, env: ENV_GAIN ? ENV_GAIN.gain.value : null, rain: rainGain ? rainGain.gain.value : null, wind: windGain ? windGain.gain.value : null });
window.__MTB_track = { SECTIONS, ELEV, sectionAt, elevAt, sectionLabel, getSeg };
window.__MTB_sp = SP;
})();

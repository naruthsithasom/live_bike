/* =====================================================================
   MTB Endless Ride — ปั่นจักรยานเสือภูเขาไม่มีที่สิ้นสุด (มุมมอง POV)
   Canvas 2D pseudo-3D, จอแนวตั้ง 9:16 สำหรับมือถือ
   ===================================================================== */
'use strict';
(() => {

// ---------------------------------------------------------------- setup
// เวอร์ชันของไฟล์เกม — แก้โค้ดเมื่อไหร่ให้เปลี่ยนค่านี้ หน้า /admin จะเตือนถ้าหน้าเกมยังใช้ไฟล์เก่า (ยังไม่ได้กด F5)
const GAME_BUILD = '2026-11-06.4';
const W = 540, H = 960;
const cv = document.getElementById('game');
let ctx = cv.getContext('2d');
let RES = 1;

const SHARP_LEVELS = { '1': 'ปกติ', '1.5': 'คม', '2': 'คมมาก', '2.5': 'คมสุด' };
let SHARP = 2;
try { const v = localStorage.getItem('mtb.sharp'); if (SHARP_LEVELS[v]) SHARP = parseFloat(v); } catch (e) { /* ignore */ }
const MAX_RES = 2;   // canvas สูงสุด 1080×1920
const SCREEN_PAD = 20; // ขอบดำรอบจอเกม (px) กันขอบ HUD โดนตัดตอนจับภาพไลฟ์
function resize() {
  const adminW = document.body && document.body.classList && document.body.classList.contains('admin-open') && window.innerWidth > 760 ? 380 : 0;
  const vw = Math.max(100, window.innerWidth - adminW - SCREEN_PAD * 2), vh = Math.max(100, window.innerHeight - SCREEN_PAD * 2);
  let w, h;
  if (vw / vh > 9 / 16) { h = vh; w = vh * 9 / 16; } else { w = vw; h = vw * 16 / 9; }
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  const wrap = document.getElementById('wrap');
  if (wrap && wrap !== cv && wrap.style) { wrap.style.width = w + 'px'; wrap.style.height = h + 'px'; }
  // SHARP = วาดละเอียดกว่าขนาดบนจอ แล้วย่อลง (supersample) → ขอบ/ตัวหนังสือคมขึ้นตอนจับภาพไลฟ์
  // เพดาน 1080×1920 (= ภาพไลฟ์ TikTok สูงสุด) — ใหญ่กว่านี้ไม่คมขึ้นบนไลฟ์ แต่กินเครื่องหนักมาก (2160×3840 = 20 FPS)
  RES = clamp((window.devicePixelRatio || 1) * w / W * SHARP, 0.6, MAX_RES);
  cv.width = Math.round(W * RES);
  cv.height = Math.round(H * RES);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- utils
// 📈 จับเวลาแต่ละส่วนของเฟรม (ส่งให้หน้า /monitor ดูว่าส่วนไหนกินเวลา)
const PROF = { acc: {} };
function pmark(name, t0) { const t = performance.now(); PROF.acc[name] = (PROF.acc[name] || 0) + (t - t0); return t; }
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
const DECO_MULT = 0.5;             // ความหนาแน่นบ้าน/ต้นไม้/สิ่งปลูกสร้างข้างทาง (ลดลง 50% ไม่ให้รก)
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

// --------------------------------------------------------------- countries
// ทุกฉากอยู่ในประเทศหนึ่ง: ชื่อ + ธง (วาดเอง เพราะ Windows ไม่แสดงอีโมจิธง) + ของประดับข้างทาง + เพลงประเทศละ 2 เพลง
// เพลง: คีย์ A / C / D major · สไตล์แดนซ์ยุค 80s / 90s / 2000s · prog = ลำดับคอร์ด (0 = I, 3 = IV, 4 = V, 5 = vi)
const COUNTRIES = {
  th: { name: 'ไทย', jersey: '#1e40af', scenes: ['ricefield', 'temple', 'village', 'sea'], extra: ['thaihouse', 'thaihouse', 'palm'],
    flag: { h: ['#a51931', '#f4f5f8', '#2d2a4a', '#2d2a4a', '#f4f5f8', '#a51931'] },
    songs: [{ name: 'ทุ่งนาดิสโก้', key: 'A', bpm: 124, style: '80s', prog: [0, 4, 5, 3] }, { name: 'สงกรานต์แดนซ์', key: 'D', bpm: 128, style: '90s', prog: [5, 3, 0, 4] }] },
  jp: { name: 'ญี่ปุ่น', jersey: '#bc002d', scenes: ['garden', 'footpath', 'mountain'], extra: ['sakura', 'sakura', 'torii'],
    flag: { bg: '#ffffff', disc: '#bc002d' },
    songs: [{ name: 'ซากุระซินธ์', key: 'C', bpm: 126, style: '80s', prog: [3, 4, 2, 5] }, { name: 'โตเกียวรัช', key: 'A', bpm: 132, style: '00s', prog: [0, 5, 3, 4] }] },
  ch: { name: 'สวิตเซอร์แลนด์', jersey: '#d52b1e', scenes: ['snowland', 'cliff'], extra: ['snowpine'],
    flag: { bg: '#d52b1e', cross: '#ffffff' },
    songs: [{ name: 'แอลป์บีต', key: 'D', bpm: 122, style: '90s', prog: [0, 3, 4, 3] }, { name: 'หิมะกลิตเตอร์', key: 'C', bpm: 128, style: '00s', prog: [5, 4, 3, 4] }] },
  eg: { name: 'อียิปต์', jersey: '#c8a84b', scenes: ['desert'], extra: ['pyramid', 'palm'],
    flag: { h: ['#ce1126', '#ffffff', '#000000'], mark: '#c09300' },
    songs: [{ name: 'ฟาโรห์ฟังก์', key: 'A', bpm: 118, style: '80s', prog: [5, 3, 0, 4] }, { name: 'ไนล์ไนต์', key: 'D', bpm: 126, style: '00s', prog: [0, 4, 5, 3] }] },
  us: { name: 'อเมริกา', jersey: '#3c3b6e', scenes: ['canyon', 'road', 'city'], extra: [],
    flag: { us: true },
    songs: [{ name: 'ไฮเวย์ 80', key: 'C', bpm: 130, style: '80s', prog: [0, 3, 0, 4] }, { name: 'ไทม์สแควร์', key: 'A', bpm: 128, style: '90s', prog: [0, 4, 5, 3] }] },
  fr: { name: 'ฝรั่งเศส', jersey: '#0055a4', scenes: ['velodrome', 'bridge'], extra: [],
    flag: { v: ['#0055a4', '#ffffff', '#ef4135'] },
    songs: [{ name: 'ปารีสดิสโก้', key: 'D', bpm: 124, style: '90s', prog: [0, 5, 1, 4] }, { name: 'ตูร์เดอฟรองซ์', key: 'C', bpm: 130, style: '00s', prog: [0, 4, 5, 3] }] },
  br: { name: 'บราซิล', jersey: '#009c3b', scenes: ['forest'], extra: ['palm', 'palm'],
    flag: { br: true },
    songs: [{ name: 'อเมซอนกรูฟ', key: 'A', bpm: 126, style: '90s', prog: [0, 3, 4, 4] }, { name: 'ริโอปาร์ตี้', key: 'D', bpm: 132, style: '00s', prog: [5, 3, 0, 4] }] },
  // ทีมชาติเพิ่มเติม (ใช้ในโหมดทีมชาติ ไม่มีฉากของตัวเอง)
  kr: { name: 'เกาหลี', jersey: '#0047a0', scenes: [], extra: [], flag: { bg: '#ffffff', disc: '#cd2e3a', disc2: '#0047a0' }, songs: [] },
  de: { name: 'เยอรมนี', jersey: '#222222', scenes: [], extra: [], flag: { h: ['#000000', '#dd0000', '#ffce00'] }, songs: [] },
  it: { name: 'อิตาลี', jersey: '#2e7d32', scenes: [], extra: [], flag: { v: ['#009246', '#ffffff', '#ce2b37'] }, songs: [] },
};
const SCENE_COUNTRY = {};
for (const [cc, c] of Object.entries(COUNTRIES)) for (const sid of c.scenes) { SCENE_COUNTRY[sid] = cc; if (SCENES[sid]) SCENES[sid].deco = SCENES[sid].deco.concat(c.extra); }
function countryOf(sid) { return SCENE_COUNTRY[sid] || 'th'; }
// ธงชาติ (มุมซ้ายบน x,y ขนาด w×h)
function drawFlag(cc, x, y, w, h, alpha = 1) {
  const c = COUNTRIES[cc];
  if (!c || w < 2) return;
  const f = c.flag, pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (f.h) { const n = f.h.length; f.h.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(x, y + h * i / n, w, h / n + 0.5); }); }
  else if (f.v) { const n = f.v.length; f.v.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(x + w * i / n, y, w / n + 0.5, h); }); }
  else if (f.us) {
    for (let i = 0; i < 13; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#b22234'; ctx.fillRect(x, y + h * i / 13, w, h / 13 + 0.5); }
    ctx.fillStyle = '#3c3b6e'; ctx.fillRect(x, y, w * 0.42, h * 7 / 13);
    if (w > 14) { ctx.fillStyle = '#fff'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) ctx.fillRect(x + w * (0.05 + k * 0.1), y + h * (0.08 + r * 0.15), Math.max(1, w * 0.03), Math.max(1, w * 0.03)); }
  } else if (f.br) {
    ctx.fillStyle = '#009c3b'; ctx.fillRect(x, y, w, h);
    poly([x + w * 0.5, y + h * 0.1, x + w * 0.92, y + h * 0.5, x + w * 0.5, y + h * 0.9, x + w * 0.08, y + h * 0.5], '#ffdf00');
    ell(x + w / 2, y + h / 2, h * 0.24, h * 0.24, '#002776');
  } else {
    ctx.fillStyle = f.bg; ctx.fillRect(x, y, w, h);
    if (f.cross) { ctx.fillStyle = f.cross; ctx.fillRect(x + w * 0.42, y + h * 0.18, w * 0.16, h * 0.64); ctx.fillRect(x + w * 0.28, y + h * 0.4, w * 0.44, h * 0.2); }
    if (f.disc) {
      ell(x + w / 2, y + h / 2, h * 0.3, h * 0.3, f.disc);
      if (f.disc2) { ctx.fillStyle = f.disc2; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI); ctx.fill(); }
    }
  }
  if (f.mark) ell(x + w / 2, y + h / 2, h * 0.1, h * 0.1, f.mark);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = pa;
}

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

// โหมดเกม: 'race' = แข่งผู้ติดตาม (ค่าเริ่มต้น), 'sim' = จำลองการเล่น (ระบบเดิม) · จำไว้ในเบราว์เซอร์
let MODE = (() => { try { const v = localStorage.getItem('mtb.mode'); return v === 'sim' ? 'sim' : 'race'; } catch (e) { return 'race'; } })();
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
// หน้า /admin = แผงผู้ดูแลแบบหน้าแยก: ไม่รันเกม แค่ส่งคำสั่งผ่านเซิร์ฟเวอร์ไปหน้าเกม (ใช้ได้กับลิงก์ใน LIVE Studio ด้วย)
const PANEL = /^\/admin\/?$/.test(location.pathname);

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
  hourOff: 0, hourGoal: null,   // เลื่อนเวลาแบบค่อยๆ เปลี่ยน (ฟ้าไม่กระพริบ)
  regroup: null,                // 🧲 รวมกลุ่ม
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
// เลือกได้หลายอย่าง (multi-select): ว่าง = 🎲 สุ่มทั้งหมด · 1 อย่าง = ล็อก · หลายอย่าง = สุ่มสลับเฉพาะที่เลือก · จำไว้ในเบราว์เซอร์
const PICK_KINDS = ['scene', 'weather', 'diff', 'terrain', 'surface', 'lanes', 'topkind', 'cam'];
const PICK = (() => {
  const p = {};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('mtb.pick') || '{}') || {}; } catch (e) { /* ignore */ }
  for (const k of PICK_KINDS) p[k] = new Set(Array.isArray(saved[k]) ? saved[k].map(String) : []);
  return p;
})();
function savePick() {
  const o = {};
  for (const k of PICK_KINDS) o[k] = [...PICK[k]];
  try { localStorage.setItem('mtb.pick', JSON.stringify(o)); } catch (e) { /* ignore */ }
}
function pickOne(kind, exclude) {   // สุ่ม 1 อย่างจากที่เลือกไว้ (ไม่ซ้ำของเดิมถ้าเลือกได้)
  const a = [...PICK[kind]];
  if (!a.length) return null;
  const b = a.filter(x => x !== String(exclude));
  return pick(b.length ? b : a);
}
// สุ่มแบบถ่วงน้ำหนัก แต่จำกัดเฉพาะที่แอดมินเลือกไว้
function wpickSel(defs, d, mod, kind) {
  const set = PICK[kind];
  if (!set.size) return wpick(defs, d, mod);
  const w = {};
  let sum = 0;
  for (const k of set) if (defs[k]) { w[k] = defs[k].w[d] * (mod && mod[k] != null ? mod[k] : 1); sum += w[k]; }
  if (sum <= 0) for (const k of set) if (defs[k]) w[k] = 1;
  return Object.keys(w).length ? pickWeighted(w, Math.random()) : wpick(defs, d, mod);
}
function syncLocks() {
  const one = k => PICK[k].size === 1 ? [...PICK[k]][0] : null;
  LOCK.scene = one('scene'); LOCK.weather = one('weather');
  const d = one('diff'); LOCK.diff = d === null ? null : parseInt(d, 10);
}
syncLocks();
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
// ตัดต่อทางใหม่ที่ "เลยขอบฟ้า" (นอกระยะมองเห็น) → ทางเปลี่ยนแบบเนียนๆ ไม่โผล่ทันทีตรงหน้า
function resetTrackAhead(near) {
  if (!SECTIONS.length) return;
  const cut = playerSegIdx() + (near ? 60 : DRAW + 10);
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
  const terrain = FORCE_SEC.terrain || wpickSel(TERRAINS, d, tm, 'terrain');
  const sm = Object.assign({}, SURF_AFFINITY[sid] || {});
  if (PAVED[sid]) { sm.mud = 0.3; sm.rock = 0.2; sm.sand = 0.3; sm.snow = 0.3; }
  if (sm.snow == null) sm.snow = S.wCur === 'snow' || S.wCur === 'cold' ? 3 : 0.5;
  if (S.wCur === 'rain') { sm.mud = (sm.mud || 1) * 2; sm.water = (sm.water || 1) * 2; }
  if (terrain === 'jumps') Object.assign(sm, { snow: 0, water: 0, sand: 0.3, rock: 3, mud: 1.5 });   // ทางวิบาก = ดินหิน
  if (MODE_SURF[TRACK_MODE]) Object.assign(sm, MODE_SURF[TRACK_MODE]);
  if (TRACK_MODE === 'smooth') sm.normal = 1;
  const surface = FORCE_SEC.surface || (PICK.surface.size ? wpickSel(SURFACES, d, sm, 'surface') : terrain === 'water' ? 'water' : wpick(SURFACES, d, sm));
  const wmod = { l1: sc.city ? 0 : 1 };
  if (prev) wmod[prev.width] = (wmod[prev.width] ?? 1) * 0.3;   // สลับจำนวนเลนไปเรื่อยๆ
  const width = FORCE_SEC.width || (PICK.lanes.size ? wpickSel(WIDTHS, d, wmod, 'lanes') : terrain === 'cliff' ? (d === 0 ? 'l2' : Math.random() < 0.6 ? 'l1' : 'l2')
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
    if (i % 12 === 0) {   // ตึก/บ้าน ลดลงครึ่งหนึ่ง (เดิมทุก 6 ช่วง)
      for (const side of [-1, 1]) {
        const v = hash2(i, side > 0 ? 2 : 4);
        const bw = 1800 + v * 1600;
        decos.push({ type: 'building', off: side * (1.4 + bw / 2 / ROAD_W + hash2(i, 5 + side) * 0.2), v, bw, bh: 4000 + hash2(i, 9 + side) * 9000 });
      }
    } else if (i % 12 === 6 && hash2(i, 6) < 0.7) {
      decos.push({ type: hash2(i, 7) < 0.6 ? 'lamp' : 'tree', off: (hash2(i, 8) < 0.5 ? -1 : 1) * 1.22, v: hash2(i, 10) });
    }
  } else {
    for (const side of [-1, 1]) {
      if (cliff && side === cliff) continue;
      if (sc.sea && side < 0) {
        if (hash2(i, 21) < 0.05 * DECO_MULT) decos.push({ type: hash2(i, 22) < 0.7 ? 'palm' : 'umbrella', off: -(1.25 + hash2(i, 23) * 0.9), v: hash2(i, 24) });
        continue;
      }
      if (hash2(i, side > 0 ? 11 : 12) < sc.density * DECO_MULT) {
        const t = sc.deco[Math.floor(hash2(i, side > 0 ? 13 : 14) * sc.deco.length)];
        decos.push({ type: t, off: side * (1.25 + hash2(i, side > 0 ? 15 : 16) * sc.spread), v: hash2(i, 17 + side) });
      }
    }
  }
  // เสาธงชาติข้างทาง (ทุก ~45 ช่วง) ให้รู้ว่ากำลังปั่นอยู่ประเทศไหน
  if (i % 45 === 20) decos.push({ type: 'flag', off: (hash2(i, 51) < 0.5 ? -1 : 1) * (sc.oval ? 2.4 : 1.32), v: hash2(i, 52), cc: countryOf(sid) });
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
// เพลงประกอบสร้างสดด้วย WebAudio (ไม่ต้องมีไฟล์เพลง) · ประเทศละ 2 เพลง (ดู COUNTRIES) สลับทุก 3 นาที
// คีย์ A / C / D major · สไตล์แดนซ์สนุกๆ ยุค 80s (synth-pop) / 90s (eurodance) / 2000s (club) · เร่งจังหวะตอนลุ้น
const MUSIC = { gain: null, next: 0, step: 0, cc: null, idx: 0, since: 0, song: null };
const SPACE_SONG = { name: 'ล่องอวกาศ', key: 'D', bpm: 116, style: '00s', prog: [0, 5, 3, 4] };
const KEY_ROOT = { A: 57, C: 60, D: 62 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
function scaleNote(root, deg) { return root + MAJOR[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7); }
function chordOf(root, d) { return [scaleNote(root, d), scaleNote(root, d + 2), scaleNote(root, d + 4)]; }
// ท่อนฮุก 2 ห้อง (32 ช่อง) สุ่มคงที่ต่อเพลง: จังหวะหนักใช้โน้ตในคอร์ด จะได้ไม่เพี้ยน
function songHook(song) {
  if (song.hook) return song.hook;
  const r = mulberry32(hashStr(song.name) + 7);
  const h = [];
  for (let i = 0; i < 32; i++) {
    const strong = i % 4 === 0, play = strong ? r() < 0.8 : r() < (i % 2 ? 0.35 : 0.55);
    h.push(play ? (strong ? Math.floor(r() * 3) : Math.floor(r() * 5)) : -1);
  }
  h[0] = 0; h[16] = 2;
  return (song.hook = h);
}
function hookNote(chord, root, deg, v) {
  return v < 3 ? chord[v] + 12 : v === 3 ? chord[0] + 24 : scaleNote(root, deg + 1) + 12;
}
function currentSong() {
  if (SP.on && SP.phase > 0) return SPACE_SONG;
  const cc = countryOf(playerScene().sid), list = COUNTRIES[cc].songs;
  if (MUSIC.cc !== cc) { MUSIC.cc = cc; MUSIC.idx = Math.floor(Math.random() * list.length); MUSIC.since = S.t; MUSIC.song = null; }
  else if (S.t - MUSIC.since > 180) { MUSIC.idx = (MUSIC.idx + 1) % list.length; MUSIC.since = S.t; MUSIC.song = null; }
  const song = list[MUSIC.idx] || COUNTRIES.th.songs[0];
  if (MUSIC.song !== song) {
    MUSIC.song = song;
    if (S.musicOn && S.started) toast(`🎵 ${song.name} · ${song.key} major · ${song.style === '00s' ? '2000s' : song.style}`, 'rgba(225,245,254,0.85)');
  }
  return song;
}
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
  else if (kind === 'gated') noiseHit(t, 0.24, 1200, 0.24, null, 'bandpass');   // สแนร์ใหญ่แบบยุค 80
  else if (kind === 'clap') { noiseHit(t, 0.09, 1500, 0.16, null, 'bandpass'); noiseHit(t + 0.012, 0.1, 1500, 0.12, null, 'bandpass'); }
  else if (kind === 'open') noiseHit(t, 0.12, 8000, 0.07);
  else noiseHit(t, 0.035, 7000, 0.06);
}
function playStep(song, st, t, spb) {
  const s16 = st % 16, bar = Math.floor(st / 16), hype = S.hype;
  const root = KEY_ROOT[song.key] || 60, deg = song.prog[bar % song.prog.length];
  const chord = chordOf(root, deg), bass = chord[0] - 24;
  const hv = songHook(song)[st % 32];
  if (s16 % 4 === 0) drum('kick', t);   // ทุกสไตล์: กระเดื่องทุกจังหวะ (four on the floor)
  if (song.style === '80s') {
    if (s16 === 4 || s16 === 12) drum('gated', t);
    if (s16 % 2 === 0) drum('hat', t);
    if (s16 % 2 === 0) note(mtof(bass + (s16 % 4 === 2 ? 12 : 0)), t, spb * 1.7, 'sawtooth', 0.09, 900);   // เบสอ็อกเทฟ
    note(mtof(chord[s16 % 3] + 12 + (s16 >= 8 ? 12 : 0)), t, spb * 0.7, 'square', 0.016, 2600);           // อาร์เปจิโอ
    if (hv >= 0) note(mtof(hookNote(chord, root, deg, hv)), t, spb * 1.8, 'square', 0.035, 3200);
  } else if (song.style === '90s') {
    if (s16 === 4 || s16 === 12) drum('clap', t);
    if (s16 % 4 === 2) { drum('open', t); note(mtof(bass + 12), t, spb * 1.6, 'sawtooth', 0.1, 1300); }   // เบสจังหวะยก
    if ([0, 3, 6, 10].includes(s16)) for (const n of chord) note(mtof(n + 12), t, spb * 1.3, 'triangle', 0.03);   // เปียโนสแตบ
    if (hv >= 0) note(mtof(hookNote(chord, root, deg, hv)), t, spb * 1.6, 'sawtooth', 0.03, 2600);
  } else {   // 2000s club
    if (s16 === 4 || s16 === 12) drum('clap', t);
    drum('hat', t);
    if (s16 % 4 !== 0) note(mtof(bass), t, spb * 0.8, 'sawtooth', 0.07, 700);                              // เบสกลิ้ง (เว้นตอนกระเดื่อง = sidechain)
    if (s16 === 0) for (const n of chord) note(mtof(n + 12), t, spb * 14, 'sawtooth', 0.01, 1800);           // แพด
    if (hv >= 0) {
      const f = mtof(hookNote(chord, root, deg, hv));
      note(f * 1.006, t, spb * 1.5, 'sawtooth', 0.02, 3400); note(f * 0.994, t, spb * 1.5, 'sawtooth', 0.02, 3400);   // ซูเปอร์ซอว์
    }
  }
  if (hype > 0.4 && s16 % 2 === 1) drum('hat', t);
  if (hype > 0.6 && s16 >= 14) drum('snare', t);
}
function musicTick() {
  if (!AC || !NOISE) return;
  if (!MUSIC.gain) { MUSIC.gain = AC.createGain(); MUSIC.gain.connect(AC.destination); MUSIC.next = AC.currentTime + 0.1; }
  const on = S.musicOn && !S.paused;
  MUSIC.gain.gain.value = on ? 0.5 : 0;
  if (!on || MUSIC.next < AC.currentTime - 0.5) { MUSIC.next = AC.currentTime + 0.05; if (!on) return; }
  const song = currentSong();
  const spb = 60 / (song.bpm + S.hype * 14) / 4;
  MUSIC.spb = spb;
  while (MUSIC.next < AC.currentTime + 0.2) {
    playStep(song, MUSIC.step, MUSIC.next, spb);
    MUSIC.next += spb;
    MUSIC.step++;
  }
}
// วินาทีต่อห้องเพลงตอนนี้ (กล้องแบบ "ตามจังหวะเพลง" ตัดภาพตรงห้อง)
function barSec() { const s = MUSIC.song || COUNTRIES.th.songs[0]; return 4 * 60 / (s.bpm + S.hype * 14); }

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
  if (PANEL) return;   // หน้าแผงผู้ดูแล: คีย์ลัดเกมใช้ในหน้าเกมเท่านั้น
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
    PICK.scene = new Set([id]); savePick(); syncLocks(); refreshAdminButtons();
    soon(`ฉากต่อไป: ${SCENES[id].name}`, () => sceneSoon(id));
  }
  if (e.code === 'Digit2') { const ids = Object.keys(WEATHERS), id = ids[(ids.indexOf(S.wCur) + 1) % ids.length]; PICK.weather = new Set([id]); savePick(); syncLocks(); soon(`อากาศ: ${WEATHERS[id].name}`, () => setWeather(id)); }
  if (e.code === 'Digit3') hourShift(1);
  if (e.code === 'Digit4') { const d = (S.diff + 1) % DIFFS.length; PICK.diff = new Set([String(d)]); savePick(); syncLocks(); soon(`ความยาก: ${DIFFS[d].name}`, () => { setDiff(d); resetTrackAhead(); }); }
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
// ตัวหนังสือการ์ตูนกลางจอ (โกง!! ลุย!! ชน!! ...) ปิดตามคำขอ: ทับหัวนักปั่นที่กล้องจับอยู่กลางจอ
function comic(text, color) { /* ไม่แสดงแล้ว */ }
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
  if (PANEL) return;   // หน้าแผงผู้ดูแลไม่ได้รันเกม: ไม่รับของขวัญ/แชท
  // คำสั่งจากหน้า /admin (ผ่านเซิร์ฟเวอร์) → ทำเหมือนกดปุ่มในหน้านี้
  if (m.type === 'admin') { if (m.kind) adminAct(m.kind, m.val, { target: m.target }); return; }
  if (m.type === 'config') { fetchLiveConfig(); loadGiftCatalog(); fetchGiftList(); if (MODE === 'race') refreshRaceCfg(); return; }
  if (m.type === 'gifts') { loadGiftCatalog(); fetchGiftList(); return; }
  if (m.type === 'likes') { S.live.likes = m.likes; return; }
  if (m.type === 'social') {
    if (m.ev === 'connected' || m.ev === 'end') banner(m.text, m.ev === 'end' ? 'ไลฟ์จบ' : 'พร้อมรับของขวัญ ไลก์ และผู้ติดตามแล้ว');
    else toast(m.text, m.ev === 'lost' ? '#ffccbc' : '#f8bbd0');
    return;
  }
  // ❤️ เคาะจอรายคน (โหมด survival / ทีมชาติ)
  if (m.type === 'like') { raceLike(m); return; }
  // 👋 คนเข้าห้อง: แสดงจางๆ ไม่เกิน 1 คน / 4 วิ (ผู้ติดตามเข้าร่วมแข่งผ่านข้อความ follow อยู่แล้ว)
  if (m.type === 'join') {
    if (S.t - (S.lastJoinToast || -99) > 4) { S.lastJoinToast = S.t; toast(`👋 ${m.nickname} เข้ามาในไลฟ์`, 'rgba(255,255,255,0.75)'); }
    return;
  }
  // 💬 แชท: แสดงเฉพาะคนที่ส่งของขวัญแล้ว (ตัดแชททั่วไป/บอทออก ไม่ให้รก)
  if (m.type === 'chat') {
    if (m.donor || S.gifters[m.nickname]) toast(`💬 ${m.nickname}: ${m.text}`, '#fff9c4');
    return;
  }
  // โหมดแข่งผู้ติดตาม
  if (m.type === 'follow') { noteFollow(m); if (MODE === 'race') addFollowerRider(m, true); return; }
  if (m.type === 'roster') { if (MODE === 'race') { S.rivals = S.rivals.filter(r => !r.follower); topUpBots(); toast('🧹 ล้างนักปั่นผู้ติดตามแล้ว', '#e0e0e0'); } return; }
  if (m.type === 'stage') {
    // อีกจอจบด่านไปก่อน → จอนี้แสดงผลด้วย (ไม่ส่งซ้ำ)
    if (MODE === 'race' && RACE.stage && m.stage && m.stage.no > RACE.stage.no && !RACE.finishing) finishStage(true);
    setStage(m.stage);
    return;
  }
  if (m.type === 'gift' && MODE === 'race' && m.kind !== 'like') { raceGift(m); return; }
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
function refreshRaceCfg() {
  if (typeof fetch !== 'function') return;
  fetch('/race').then(r => r.json()).then(d => { RACE.tiers = d.tiers || []; RACE.byName = d.byName || {}; RACE.maxRiders = d.maxRiders || 30; RACE.owner = d.owner || RACE.owner; }).catch(() => {});
}
function connectLive() {
  if (typeof EventSource !== 'function') return;
  fetchLiveConfig(); fetchGiftList(); loadRecentFollows();
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
// ข้อความอัตโนมัติของบอท/นักปั่น (เหนื่อย/โกง/ผลัก) — ไม่แสดงบนจอแล้ว ให้จอสะอาด เหลือแต่ข้อความจากของขวัญ
function autoNote() { /* ปิดไว้ตามที่ผู้ใช้ขอ */ }
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
// เลื่อนเวลา: ตั้งเป้าแล้วค่อยๆ ไหลไป (ประมาณ 2 ชม. ต่อวินาที)
function hourShift(dh) {
  // ล็อกกลางวัน/กลางคืนอยู่: ของขวัญสลับวัน-คืน (12 ชม.) = สลับล็อก · เลื่อนทีละชั่วโมง = ปลดล็อกแล้วเลื่อนต่อ
  if (TIME_LOCK) {
    if (Math.abs(dh) >= 6) { setTimeMode(TIME_LOCK === 'day' ? 'night' : 'day'); return; }
    TIME_LOCK = null;
    try { localStorage.setItem('mtb.time', 'real'); } catch (e) { /* ignore */ }
  }
  S.hourGoal = ((S.hourGoal === null ? S.hourOff : S.hourGoal) + dh + 48) % 24;
}
// ---- ☀️ กลางวัน / 🌙 กลางคืน / 🕐 ตามเวลาปัจจุบัน (ปุ่มในแผงผู้ดูแล) · ล็อกไว้ = ฟ้าค้างตามนั้นตลอด ค่อยๆ เปลี่ยน ~5 วิ
const TIME_MODES = { day: { icon: '☀️', name: 'กลางวัน', hour: 12 }, night: { icon: '🌙', name: 'กลางคืน', hour: 22 }, real: { icon: '🕐', name: 'ตามเวลาปัจจุบัน' } };
let TIME_LOCK = null;
try { const v = localStorage.getItem('mtb.time'); if (v === 'day' || v === 'night') TIME_LOCK = v; } catch (e) { /* ignore */ }
function realHourTH() { return ((Date.now() / 3600000) + 7) % 24; }
function setTimeMode(m) {
  TIME_LOCK = m === 'day' || m === 'night' ? m : null;
  try { localStorage.setItem('mtb.time', TIME_LOCK || 'real'); } catch (e) { /* ignore */ }
  if (!TIME_LOCK) S.hourGoal = 0;   // กลับเวลาจริง (ค่อยๆ เลื่อน)
}
function hourTick(dt) {
  // ล็อกกลางวัน/กลางคืน: ตั้งเป้าให้นาฬิกาเกมค้างที่ 12:00 / 22:00 แม้เวลาจริงเดินไป
  if (TIME_LOCK) S.hourGoal = ((TIME_MODES[TIME_LOCK].hour - realHourTH()) % 24 + 24) % 24;
  if (S.hourGoal === null) return;
  const diff = ((S.hourGoal - S.hourOff + 36) % 24) - 12;
  if (Math.abs(diff) < 0.02) { S.hourOff = S.hourGoal; if (!TIME_LOCK) S.hourGoal = null; return; }
  S.hourOff = (S.hourOff + clamp(diff, -2 * dt, 2 * dt) + 24) % 24;
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
    sceneChanges.push({ from: -1e12, id: SCENES[forced] ? forced : (pickOne('scene') || sceneForSlot(sceneSlot)) });
  } else if (sceneSlot !== S.sceneSlot) {
    S.sceneSlot = sceneSlot;
    if (PICK.scene.size === 1) return checkWD(th);   // แอดมินล็อกฉากเดียว → ไม่สุ่มเปลี่ยน
    const cur = sceneChanges[sceneChanges.length - 1].id;
    const id = PICK.scene.size ? pickOne('scene', cur) : sceneForSlot(sceneSlot);   // เลือกหลายฉาก = สลับเฉพาะที่เลือก
    if (!PICK.scene.size && !SP.on && SPACE_ON && mulberry32(sceneSlot * 131 + 5)() < 0.2) {
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
    S.wCur = S.wPrev = WEATHERS[forced] ? forced : (pickOne('weather') || weatherForSlot(wSlot, sceneChanges[0].id));
  } else if (wSlot !== S.weatherSlot) {
    S.weatherSlot = wSlot;
    if (PICK.weather.size !== 1) setWeather(PICK.weather.size ? pickOne('weather', S.wCur) : weatherForSlot(wSlot, playerScene().sid));
  }
  const dSlot = Math.floor(th.ms / DIFF_MS);
  const dPick = () => { const v = pickOne('diff', S.diff); return v === null ? null : parseInt(v, 10); };
  if (S.diffSlot === null) { S.diffSlot = dSlot; const v = dPick(); setDiff(v === null ? diffForSlot(dSlot) : v, true); }
  else if (dSlot !== S.diffSlot) { S.diffSlot = dSlot; const v = dPick(); const d = v === null ? diffForSlot(dSlot) : v; if (PICK.diff.size !== 1 && d !== S.diff) setDiff(d); }
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
  PLAYER_REF.name = playerName(); PLAYER_REF.avatar = MODE === 'race' ? (RACE.owner.avatar || '') : '';
  return [PLAYER_REF, ...S.rivals];
}
function makeRival(d, i, z, x, base, pitch) {
  return {
    ...d, idx: i, char: i + 1, z, x, tx: x, speed: 0, base,
    stam: 70 + Math.random() * 30, effort: 55, effTarget: 55, effT: Math.random() * 4, tired: false, stopT: 0, passT: 0, lvMsgT: -99,
    slowT: 0, boostT: 0, jumpT: 0, wheelieT: 0, driftT: 0, driftDir: 1, fallT: 0, motorT: 0, talkT: 0,
    phase: Math.random() * 6, retarget: 2 + Math.random() * 3, pitch, say: null, splat: null, gapSign: 0,
  };
}
function initRivals() {
  if (MODE === 'race') return initRace();
  const bases = [0.99, 0.985, 1.0, 0.98, 0.995].sort(() => Math.random() - 0.5);
  const lanes = [-0.5, 0.4, -0.1, 0.55, -0.6];
  const pitches = [0.8, 1.4, 1.0, 1.7, 0.65];
  S.rivals = RIVAL_DEFS.map((d, i) => makeRival(d, i, S.position + PLAYER_Z + 350 + i * 320, lanes[i], bases[i], pitches[i]));
}

// =====================================================================
//        โหมดแข่งผู้ติดตาม: คนสร้าง + บอท 4 คน · กดติดตาม = ได้นักปั่น
// =====================================================================
const RACE = { stage: null, offset: 0, owner: {}, maxRiders: 30, tiers: [], byName: {}, podium: null, finishing: false, z0: 0, nextIdx: 4, finishZ: null, finished: new Map() };
const PODIUM_SEC = 25;
const RACE_CAT = {
  self:  { icon: '🚀', name: 'ช่วยตัวเอง', tip: 'พุ่งนำ + แรงเต็ม', short: 'พุ่งนำ' },
  help:  { icon: '💝', name: 'ให้คนอื่น', tip: 'ส่งพลังให้คนท้ายสุด', short: 'ช่วยคนท้าย' },
  prank: { icon: '🍌', name: 'แกล้งคนอื่น', tip: 'คนข้างหน้าหยุด + ถอยหลัง', short: 'คนหน้าหยุด' },
  mood:  { icon: '🌦️', name: 'เปลี่ยนบรรยากาศ', tip: 'อากาศ/กลางวัน-คืน เปลี่ยนทั้งสนาม', short: 'เปลี่ยนอากาศ' },
  scene: { icon: '🗺️', name: 'เปลี่ยนฉาก', tip: 'ย้ายสนามแข่งทันที', short: 'ย้ายประเทศ' },
};
const DEFAULT_RACE_TIERS = [{ min: 1, cat: 'self' }, { min: 5, cat: 'help' }, { min: 20, cat: 'prank' }, { min: 99, cat: 'mood' }, { min: 299, cat: 'scene' }];
const FOLLOW_COLORS = ['#ef5350', '#ab47bc', '#5c6bc0', '#29b6f6', '#26a69a', '#9ccc65', '#ffca28', '#ff7043', '#8d6e63', '#ec407a', '#7e57c2', '#26c6da'];
function hashStr(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
// ---- แบบการแข่ง (เลือกจากปุ่มในแผงผู้ดูแล)
//   classic  = คนสร้าง + บอท 4 คน + ผู้ติดตาม (แบบเดิม)
//   survival = ผู้ติดตามแข่งกันเอง (บอทเป็นตัวสำรองตอนคนน้อย ออกไปทีละคนเมื่อมีผู้ติดตามเข้ามา)
//   nation   = ทีมชาติ สุ่มเข้ากลุ่มละ 6 คน (สีเสื้อ + ธงตามประเทศ)
// survival / nation: เคาะจอ (กดถูกใจ) สะสมครบ LIKE_LEAD ครั้ง → ลุ้นขึ้นนำ 80%
const RACE_TYPES = {
  classic:  { icon: '🏁', name: 'แข่งปกติ', tip: 'คนสร้าง + บอท 4 คน + ผู้ติดตาม' },
  survival: { icon: '🔥', name: 'Survival', tip: 'ผู้ติดตามแข่งกันเอง · เคาะจอมาก ลุ้นขึ้นนำ 80%' },
  nation:   { icon: '🌏', name: 'ทีมชาติ', tip: 'สุ่มเข้าทีมละ 6 คน · เคาะจอมาก ลุ้นขึ้นนำ 80%' },
};
let RTYPE = (() => { try { const v = localStorage.getItem('mtb.rtype'); return RACE_TYPES[v] ? v : 'survival'; } catch (e) { return 'survival'; } })();
const LIKE_LEAD = 15, LIKE_LEAD_CHANCE = 0.8, TEAM_SIZE = 6, SPARE_BOTS = 4;
const NATION_IDS = ['th', 'jp', 'kr', 'us', 'fr', 'br', 'de', 'it', 'ch', 'eg'];
function likeMode() { return MODE === 'race' && RTYPE !== 'classic'; }
function riderKey(o) { return o.me ? 'me' : (o.uid || 'bot' + o.idx); }
function teamCounts() { const c = {}; for (const o of racers()) if (o.team) c[o.team] = (c[o.team] || 0) + 1; return c; }
// สุ่มทีมที่ยังไม่เต็ม 6 คน (เปิดทีมใหม่เมื่อทีมเดิมเต็ม)
function assignTeam(key) {
  const c = teamCounts(), total = Object.values(c).reduce((a, b) => a + b, 0) + 1;
  const active = NATION_IDS.slice(0, clamp(Math.ceil(total / TEAM_SIZE), 2, NATION_IDS.length));
  let open = active.filter(t => (c[t] || 0) < TEAM_SIZE);
  if (!open.length) open = NATION_IDS.filter(t => (c[t] || 0) < TEAM_SIZE);
  return open.length ? open[hashStr(key + ':' + total) % open.length] : 'th';
}
// ใส่ทีม/สีเสื้อตามแบบการแข่งตอนนี้
function applyTeams() {
  PLAYER_REF.team = PLAYER_SPRITE.team = RTYPE === 'nation' ? 'th' : null;
  for (const r of S.rivals) {
    if (r.jersey0 === undefined) r.jersey0 = r.jersey;
    if (RTYPE === 'nation') { if (!r.team) r.team = assignTeam(riderKey(r)); r.jersey = COUNTRIES[r.team].jersey; }
    else { r.team = null; r.jersey = r.jersey0; }
  }
}
// บอทสำรอง: survival/ทีมชาติ มีบอทเฉพาะตอนผู้ติดตามน้อยกว่า 4 คน · แข่งปกติมีบอท 4 คนเสมอ
function topUpBots() {
  const pz = S.position + PLAYER_Z;
  const want = RTYPE === 'classic' ? SPARE_BOTS : Math.max(0, SPARE_BOTS - S.rivals.filter(r => r.follower).length);
  let bots = S.rivals.filter(r => r.bot);
  while (bots.length > want) { const out = bots.pop(); S.rivals = S.rivals.filter(r => r !== out); }
  for (let i = 0; i < RIVAL_DEFS.length && bots.length < want; i++) {
    if (S.rivals.some(r => r.bot && r.name === RIVAL_DEFS[i].name)) continue;
    const r = makeRival({ ...RIVAL_DEFS[i], bot: true }, i, pz + (3 + bots.length * 2) * U_PER_M, [-0.5, 0.4, -0.1, 0.55, -0.3][i % 5], 0.975 + Math.random() * 0.025, [0.8, 1.4, 1.0, 1.7, 0.65][i % 5]);
    r.speed = Math.max(S.speed * 0.9, MAX_SPEED * 0.5);
    S.rivals.push(r); bots.push(r);
  }
  applyTeams();
}
function setRaceType(t) {
  if (!RACE_TYPES[t]) return;
  RTYPE = t;
  try { localStorage.setItem('mtb.rtype', t); } catch (e) { /* ignore */ }
  for (const r of S.rivals) r.team = null;
  topUpBots();
  restartGame();
  banner(`${RACE_TYPES[t].icon} ${RACE_TYPES[t].name}`, RACE_TYPES[t].tip);
}
// ❤️ เคาะจอรายคน: แรงเพิ่มทุกครั้ง · ครบ LIKE_LEAD ครั้ง → 80% พุ่งขึ้นนำ (ค่อยๆ ไหลแซง ไม่วาร์ป)
function raceLike(m) {
  if (!likeMode() || RACE.podium || S.countdown > 0) return;
  const r = m.uniqueId ? S.rivals.find(o => o.uid === m.uniqueId) : null;
  if (!r) return;
  const n = clamp(m.count | 0 || 1, 1, 200);
  r.likes = (r.likes || 0) + n; r.likeHeat = (r.likeHeat || 0) + n;
  r.stam = Math.min(100, r.stam + 2 * n); r.effTarget = 100; r.effT = Math.max(r.effT, 2); r.tired = false;
  r.boostT = Math.max(r.boostT, 0.8);
  if (r.likeHeat < LIKE_LEAD) return;
  r.likeHeat = 0;
  if (Math.random() < LIKE_LEAD_CHANCE) {
    const lead = racers().reduce((a, o) => (o.z > a.z ? o : a));
    if (lead !== r) r.surge = Math.max(r.surge || 0, lead.z - r.z + 4 * U_PER_M);
    r.warpUntil = S.gt + WARP_GRACE; r.stopT = 0; r.fallT = 0; r.boostT = Math.max(r.boostT, 4);
    floater(`❤️ ${r.name} เคาะจอรัวๆ ขึ้นนำ!`, '#f8bbd0'); camFocus(r); sfx.boost();
  } else floater(`❤️ ${r.name} เคาะจอ เร่งแรงขึ้น!`, '#f8bbd0');
}
// ไหลแซงขึ้นนำแบบนุ่มๆ (ไม่กระโดดตำแหน่ง)
function surgeTick(dt) {
  for (const r of S.rivals) {
    if (!(r.surge > 0)) continue;
    const step = Math.min(r.surge, Math.max(12 * U_PER_M, r.surge * 1.6) * dt * RSPD.k);
    r.z += step; r.surge -= step;
  }
}
// ---- เส้นชัย: ก่อนหมดเวลา 40 วิ วางเส้นชัยข้างหน้าผู้นำ · ใครข้ามก่อนได้อันดับก่อน
const FINISH_LEAD_S = 40;
function finishTick() {
  const left = stageLeftMs();
  if (left === null || S.countdown > 0) return;
  const all = racers();
  if (!RACE.finishZ && left < FINISH_LEAD_S * 1000) {
    const lead = all.reduce((a, o) => (o.z > a.z ? o : a));
    RACE.finishZ = lead.z + Math.max(riderSpeed(lead), MAX_SPEED * 0.6) * 0.85 * left / 1000;
    banner('🏁 เส้นชัยอยู่ข้างหน้า!', 'ใครข้ามเส้นก่อน ได้อันดับก่อน');
  }
  if (!RACE.finishZ) return;
  for (const o of all) {
    const k = riderKey(o);
    if (RACE.finished.has(k) || o.z < RACE.finishZ) continue;
    RACE.finished.set(k, RACE.finished.size + 1);
    const n = RACE.finished.size;
    if (n === 1) { banner(`🥇 ${nameOf(o)} เข้าเส้นชัยคนแรก!`, 'ชนะรอบนี้!'); confetti(80); sfx.cheer(); camFocus(o.me ? PLAYER_REF : o); }
    else if (n <= 3) floater(`${n === 2 ? '🥈' : '🥉'} ${nameOf(o)} เข้าเส้นชัยอันดับ ${n}`, '#fff59d');
  }
  if (RACE.finished.size >= all.length && !RACE.finishing) finishStage();
}
// อันดับทีมชาติ: เฉลี่ยระยะของสมาชิกในทีม
function teamStandings() {
  const t = {};
  for (const o of racers()) {
    if (!o.team) continue;
    const e = t[o.team] || (t[o.team] = { id: o.team, n: 0, z: 0, fin: 0 });
    e.n++; e.z += o.z; if (RACE.finished && RACE.finished.has(riderKey(o))) e.fin++;
  }
  return Object.values(t).map(e => ({ ...e, z: e.z / e.n })).sort((a, b) => (b.fin - a.fin) || (b.z - a.z));
}
function ownerName() {
  const o = RACE.owner || {};
  return o.nickname || (o.username ? '@' + o.username : (S.live.username ? '@' + S.live.username : 'คนสร้าง'));
}
function playerName() { return MODE === 'race' ? ownerName() : 'คุณ'; }
function nameOf(o) { return o.me ? playerName() : o.name; }
function localCategory(name, diamonds) {
  const hit = Object.entries(RACE.byName || {}).find(([k]) => k.toLowerCase() === String(name || '').toLowerCase());
  if (hit && RACE_CAT[hit[1]]) return hit[1];
  const t = (RACE.tiers && RACE.tiers.length ? RACE.tiers : DEFAULT_RACE_TIERS).slice().sort((a, b) => b.min - a.min).find(x => (diamonds || 0) >= x.min);
  return t && RACE_CAT[t.cat] ? t.cat : 'self';
}
function initRace() {
  const pz = S.position + PLAYER_Z;
  S.rivals = RIVAL_DEFS.slice(0, 4).map((d, i) => makeRival({ ...d, bot: true }, i, pz + 350 + i * 320, [-0.5, 0.4, -0.1, 0.55][i], 0.975 + Math.random() * 0.025, [0.8, 1.4, 1.0, 1.7][i]));
  RACE.nextIdx = 4;
  RACE.z0 = pz;
  applyTeams();
  loadRace();
}
function setStage(st) {
  if (!st) return;
  RACE.stage = st;
  if (st.serverNow) RACE.offset = st.serverNow - Date.now();
}
function loadRace() {
  const local = () => { if (!RACE.stage) setStage({ no: 1, startedAt: Date.now(), durationMs: 30 * 60000, serverNow: Date.now() }); };
  if (typeof fetch !== 'function') return local();
  fetch('/race').then(r => r.json()).then(d => {
    setStage(d.stage);
    RACE.owner = d.owner || {}; RACE.maxRiders = d.maxRiders || 30; RACE.tiers = d.tiers || []; RACE.byName = d.byName || {};
    if (MODE === 'race') for (const f of d.roster || []) addFollowerRider(f, false);
  }).catch(local);
}
function followerDef(f) {
  const h = hashStr(f.uniqueId);
  return {
    name: f.nickname || f.uniqueId, uid: f.uniqueId, avatar: f.avatar || '', follower: true, diamonds: f.diamonds || 0,
    jersey: FOLLOW_COLORS[h % FOLLOW_COLORS.length], helmet: ['#ffffff', '#212121', '#ffd54f', '#e53935'][(h >> 4) & 3], shorts: '#1a1a1a',
  };
}
function addFollowerRider(f, announce) {
  if (!f || !f.uniqueId || S.rivals.some(r => r.uid === f.uniqueId)) return null;
  if (S.rivals.length + 1 >= RACE.maxRiders) {
    // เต็มสนาม → คนท้ายสุดที่ส่งของขวัญน้อยสุดออกก่อน
    const out = S.rivals.filter(r => r.follower).sort((a, b) => (a.diamonds - b.diamonds) || (a.z - b.z))[0];
    if (!out) return null;
    S.rivals = S.rivals.filter(r => r !== out);
    if (announce) toast(`👋 ${out.name} ออกจากสนาม (เต็ม ${RACE.maxRiders} คน)`, '#e0e0e0');
  }
  const pz = S.position + PLAYER_Z, n = S.rivals.filter(r => r.follower).length;
  // เข้ามาใกล้ๆ กลุ่ม (ไม่ทิ้งไว้ท้ายไกล)
  const r = makeRival(followerDef(f), RACE.nextIdx++, pz - (2 + (n % 4) * 1.5) * U_PER_M, [-0.6, 0, 0.6, -0.3, 0.3][n % 5], 0.975 + Math.random() * 0.03, 0.7 + Math.random() * 1.1);
  r.speed = Math.max(S.speed * 0.9, MAX_SPEED * 0.5);
  S.rivals.push(r);
  if (MODE === 'race') topUpBots();   // survival/ทีมชาติ: บอทสำรองออก 1 คน · ใส่ทีมให้คนใหม่
  if (announce) {
    const tm = r.team && COUNTRIES[r.team] ? ` · ทีม${COUNTRIES[r.team].name}` : '';
    banner(`🚴 ${r.name} เข้าร่วมแข่ง!${tm}`, f.already ? 'ติดตามอยู่แล้ว เข้าร่วมเลย 💖 เคาะจอ/ส่งของขวัญเพื่อขึ้นนำ' : 'ขอบคุณที่กดติดตาม 💖 เคาะจอ/ส่งของขวัญเพื่อขึ้นนำ');
    confetti(30); sfx.cheer(); camFocus(r);
    later(1, () => say(r, pick(['มาแล้ว! สู้ๆ!', 'ขอแซงนะ!', 'ที่ 1 ต้องเป็นของฉัน!', 'ลุยเลย!']), true));
  }
  return r;
}

// ---- ของขวัญในโหมดแข่ง: ผู้ส่งได้พลังตามราคา + ผลตามประเภท
function giftPower(D) { return clamp(Math.log10(D + 1) / Math.log10(1001), 0.08, 1); }
function powerUp(o, P, D, k, quiet) {
  const m = U_PER_M;
  const warp = Math.min(1500, D * 1.5) * k * m;   // พุ่งไปข้างหน้าตามราคา (สูงสุด 1.5 กม.)
  const dur = (3 + 9 * P) * Math.max(0.5, k);
  if (warp > 2 * m) { if (o.me) S.warpUntil = S.gt + WARP_GRACE; else o.warpUntil = S.gt + WARP_GRACE; }   // ได้นำสักพักก่อนกลุ่มไล่ทัน
  if (o.me) {
    S.position += warp; S.prevPZ = S.position + PLAYER_Z;
    S.energy = Math.min(100, S.energy + 20 + 60 * k);
    addEffect({ key: 'gpower', icon: '🚀', label: 'พลังพิเศษ', dur, maxMult: 1.1 + 0.35 * P, accel: 1.5 });
    S.pe.effTarget = 100; S.pe.effT = dur; S.pe.tired = false; S.stopT = 0; S.boostFlash = 1;
    if (warp > 30 * m) CAM.flash = 1;
  } else {
    o.z += warp; o.boostT = Math.max(o.boostT, dur);
    o.stam = Math.min(100, o.stam + 20 + 60 * k); o.effTarget = 100; o.effT = dur; o.tired = false; o.stopT = 0; o.fallT = 0;
  }
  if (!quiet && warp > 2 * m) floater(`🚀 ${nameOf(o)} พุ่ง +${(warp / m).toFixed(0)} ม.`, '#b9f6ca');
}
function knock(t, P, D, by) {
  const m = U_PER_M, back = Math.min(300, D * 0.5) * m, stop = 1.5 + 3.5 * P;
  if (t.me) { S.stopT = Math.max(S.stopT, stop); S.speed = 0; S.position = Math.max(0, S.position - back); S.prevPZ = S.position + PLAYER_Z; S.shake = 1; S.hitFlash = 1; }
  else { t.stopT = Math.max(t.stopT, stop); t.speed = 0; t.z -= back; t.splat = { emoji: '🍌', t: 2.5 }; later(0.5, () => say(t, pick(TALK.victim), true)); }
  floater(`🍌 ${nameOf(t)} โดนแกล้ง${back > m ? ` ถอย ${(back / m).toFixed(0)} ม.` : ''}!`, '#ffab91');
}
function raceGift(m) {
  const D = Math.max(1, (m.diamonds || 0) * (m.count || 1));
  const P = giftPower(D);
  const cat = RACE_CAT[m.category] ? m.category : localCategory(m.giftName, m.diamonds);
  const C = RACE_CAT[cat];
  const mine = m.uniqueId ? S.rivals.find(r => r.uid === m.uniqueId) : null;
  const who = mine || racers()[0];   // ยังไม่กดติดตาม → พลังไปช่วยคนสร้าง
  if (mine) mine.diamonds = (mine.diamonds || 0) + D;
  S.gifters[m.user] = (S.gifters[m.user] || 0) + D;
  const em = (DEFAULT_GIFTS_UI.find(g => g.name === m.giftName) || {}).emoji || '🎁';
  S.giftPop = { img: giftImage(m.image), emoji: em, name: m.giftName, user: m.user, count: m.count || 1, t: 0 };
  sfx.pick();
  toast(`🎁 ${m.user} ส่ง ${m.giftName}${m.count > 1 ? ' x' + m.count : ''} (${D}💎) → ${C.icon} ${C.name}`, '#fff9c4');
  if (!mine && m.uniqueId) toast(`💖 ${m.user} กดติดตาม = ได้นักปั่นของตัวเอง!`, '#f8bbd0');
  // ทุกของขวัญ: นักปั่นของผู้ส่งได้พลังพิเศษตามราคา (ช่วยตัวเองได้เต็ม)
  powerUp(who, P, D, cat === 'self' ? 1 : 0.35);
  const sorted = racers().slice().sort((a, b) => b.z - a.z);
  switch (cat) {
    case 'self':
      banner(`🚀 ${nameOf(who)} พลังพิเศษ!`, `${m.giftName} จาก ${m.user}`); camFocus(who.me ? PLAYER_REF : who); sfx.boost(); break;
    case 'help': {
      // ทีมชาติ: ส่งพลังให้เพื่อนร่วมทีมที่อยู่ท้ายสุดก่อน
      const mates = RTYPE === 'nation' && who.team ? sorted.filter(o => o !== who && o.team === who.team) : [];
      const humans = sorted.filter(o => o !== who && !o.bot);
      const t = (mates.length ? mates : humans.length ? humans : sorted.filter(o => o !== who)).slice(-1)[0];
      if (t) { powerUp(t, P, D, 0.8); banner(`💝 ${m.user} ส่งพลังให้ ${nameOf(t)}`, 'คนท้ายสุดได้พุ่งขึ้นมา!'); camFocus(t.me ? PLAYER_REF : t); }
      sfx.good(); break;
    }
    case 'prank': {
      const i = sorted.indexOf(who);
      let ts = P > 0.7 ? sorted.filter(o => o !== who).slice(0, 3) : [sorted[i - 1] || sorted[i + 1]];
      ts = ts.filter(Boolean);
      ts.forEach(t => knock(t, P, D, m.user));
      if (ts.length) { banner(`🍌 ${m.user} แกล้ง ${ts.map(nameOf).join(', ')}!`, 'หยุดกึก ถอยหลัง!'); comic('โดนแกล้ง!!', '#ff8a80'); camFocus(ts[0].me ? PLAYER_REF : ts[0]); }
      sfx.splat(); break;
    }
    case 'scene': {
      const id = pickOne('scene', playerScene().sid) || pick(SCENE_IDS.filter(x => x !== playerScene().sid));
      later(1.2, () => sceneSoon(id));   // หน่วงนิดนึง แล้วฉากใหม่โผล่จากขอบฟ้า
      banner(`🗺️ ${m.user} เปลี่ยนฉาก!`, `${SCENES[id].icon} ${SCENES[id].name} — กำลังมาถึงข้างหน้า`); confetti(40); break;
    }
    case 'mood': {
      const id = pickOne('weather', S.wCur) || pick(Object.keys(WEATHERS).filter(x => x !== S.wCur));
      later(1.2, () => setWeather(id, true));   // อากาศค่อยๆ เปลี่ยน (ผสาน 8 วิ)
      if (P >= 0.6) hourShift(12);
      banner(`🌦️ ${m.user} เปลี่ยนบรรยากาศ!`, `${WEATHERS[id].icon} ${WEATHERS[id].name}${P >= 0.6 ? ' · สลับกลางวัน/กลางคืน' : ''}`); break;
    }
  }
}

// ---- ด่าน 1 ชม. → สรุปผู้เข้าเส้นชัย 1-2-3
function stageLeftMs() { return RACE.stage ? RACE.stage.startedAt + RACE.stage.durationMs - (Date.now() + RACE.offset) : null; }
function raceStandings() {
  // คนเข้าเส้นชัยก่อน = อันดับก่อน (ตามลำดับที่ข้ามเส้น) · ที่เหลือเรียงตามระยะทาง
  const fin = o => RACE.finished.get(riderKey(o)) || 0;
  return racers().slice().sort((a, b) => (fin(a) && fin(b) ? fin(a) - fin(b) : fin(a) ? -1 : fin(b) ? 1 : b.z - a.z)).map((o, i) => ({
    rank: i + 1, name: nameOf(o), uid: o.me ? (RACE.owner.username || S.live.username || '') : (o.uid || ''),
    avatar: o.me ? (RACE.owner.avatar || '') : (o.avatar || ''), kind: o.me ? 'owner' : o.bot ? 'bot' : 'follower',
    distanceM: Math.max(0, (o.z - RACE.z0) / U_PER_M), diamonds: o.diamonds || 0, jersey: o.me ? '#ff7043' : o.jersey,
    team: o.team ? COUNTRIES[o.team].name : '', teamId: o.team || '', finished: !!fin(o), likes: o.likes || 0,
  }));
}
function finishStage(noPost) {
  RACE.finishing = true;
  const list = raceStandings();
  const no = RACE.stage ? RACE.stage.no : 1;
  RACE.podium = { list, t: 0, no, rtype: RTYPE, teams: RTYPE === 'nation' ? teamStandings() : null };
  banner(`🏁 จบรอบ ${no}!`, 'ประกาศผลผู้เข้าเส้นชัย');
  confetti(120); sfx.cheer();
  if (noPost) return;
  if (S.live.server && typeof fetch === 'function') {
    fetch('/race/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stageNo: no, results: list, rtype: RTYPE }) })
      .then(r => r.json()).then(j => { setStage(j.stage); setTimeout(loadHistory, 800); }).catch(() => {});
  } else setStage({ no: no + 1, startedAt: Date.now(), durationMs: RACE.stage ? RACE.stage.durationMs : 1800000, serverNow: Date.now() });
}
function resetRaceGrid() {
  const all = racers().slice().sort(() => Math.random() - 0.5);
  const pz = S.position + PLAYER_Z, m = U_PER_M;
  all.forEach((o, k) => {
    const z = pz - Math.floor(k / 3) * 2.5 * m, x = [-0.5, 0, 0.5][k % 3];
    if (o.me) { S.position = z - PLAYER_Z; S.prevPZ = z; S.playerX = x; S.speed = 0; S.energy = 100; S.stopT = 0; S.effects = []; }
    else Object.assign(o, { z, x, tx: x, speed: 0, stam: 100, stopT: 0, fallT: 0, slowT: 0, boostT: 0, motorT: 0, diamonds: 0, likes: 0, likeHeat: 0, surge: 0 });
  });
  RACE.z0 = pz;
  RACE.finishZ = null; RACE.finished = new Map();   // รอบใหม่: ล้างอันดับ/เส้นชัยเสมอ
  S.objects = []; S.nextSpawn = 0; S.projectiles = [];
}
// 🔄 เริ่มเกมใหม่: ทุกคนกลับเส้นสตาร์ต พลังเต็ม นับเวลาด่านใหม่ ไม่บันทึกผล (ผู้ติดตามยังอยู่ครบ)
function restartGame() {
  RACE.podium = null; RACE.finishing = false; S.regroup = null;
  resetRaceGrid();
  S.energy = S.water = S.health = 100; S.sleepT = 0; S.jumpT = 0; S.trick = null; S.trickQ = []; S.warpUntil = 0;
  for (const r of S.rivals) { r.warpUntil = 0; r.effort = 55; r.effT = 0; r.tired = false; r.jumpT = 0; r.wheelieT = 0; r.driftT = 0; }
  initPack();
  S.support = S.support.map(() => 0);
  if (S.live.server && typeof fetch === 'function') fetch('/race/restart', { method: 'POST' }).then(r => r.json()).then(j => setStage(j.stage)).catch(() => {});
  else setStage({ no: RACE.stage ? RACE.stage.no : 1, startedAt: Date.now(), durationMs: RACE.stage ? RACE.stage.durationMs : 1800000, serverNow: Date.now() });
  S.countdown = 3.4;
  banner('🔄 เริ่มเกมใหม่!', 'ทุกคนกลับเส้นสตาร์ต · นับเวลาด่านใหม่');
}
function endPodium() {
  RACE.podium = null; RACE.finishing = false;
  resetRaceGrid();
  const id = pick(SCENE_IDS.filter(x => x !== playerScene().sid));
  addSceneChange(id, playerSegIdx() - 30); S.lastScene = null; resetTrackAhead(); CAM.flash = 1;
  S.countdown = 3.4;
  const mins = Math.round((RACE.stage ? RACE.stage.durationMs : 1800000) / 60000);
  banner(`🏁 รอบ ${RACE.stage ? RACE.stage.no : ''} เริ่มแล้ว!`, `แข่ง ${mins >= 60 ? (mins / 60) + ' ชม.' : mins + ' นาที'} · ใครเข้าเส้นชัยก่อนชนะ`);
}
// คืน true = หยุดอัปเดตเกมเฟรมนี้ (กำลังแสดงหน้าสรุปผล)
function raceTick(dt) {
  if (RACE.podium) { if ((RACE.podium.t += dt) > PODIUM_SEC) endPodium(); return true; }
  if (S.countdown <= 0 && !RACE.finishing && RACE.stage && stageLeftMs() <= 0) { finishStage(); return true; }
  if (S.countdown <= 0 && !RACE.finishing) { surgeTick(dt); finishTick(); }
  return false;
}
// ---- 🧲 รวมกลุ่ม: ผู้นำชะลอ ผู้ตามท้ายเร่งมาจับกลุ่ม แล้วแข่งกันต่อ
function regroupStart() {
  S.regroup = { t: 0, anchor: S.position + PLAYER_Z };
  banner('🧲 รวมกลุ่ม!', 'ผู้นำชะลอ · ผู้ตามท้ายเร่งมาจับกลุ่ม');
  sfx.whoosh();
}
// ตัวคูณความเร็ว: ยิ่งนำกลุ่มยิ่งช้าลง (ต่ำสุด 45%) ยิ่งตามหลังยิ่งเร่ง (สูงสุด 160%)
// ระหว่างไม่ได้กด 🧲 ใช้ "จับกลุ่มอัตโนมัติ" (packMult) แทน
function regroupMult(o) {
  if (!S.regroup) return packMult(o) * RSPD.k;
  return clamp(1 - (o.z - S.regroup.anchor) / U_PER_M / 40, 0.45, 1.6) * RSPD.k;
}
// ---- 🏎️ ความเร็วการแข่ง 0-100% (สไลด์ในแผงผู้ดูแล) · 75% = ความเร็วปกติ (ค่าเริ่มต้น) · 100% = เร็วกว่าปกติ 1.33 เท่า · 0% = ทุกคนหยุด
// ค่อยๆ เปลี่ยน (ราว 2 วิ) ไม่กระตุก · ใช้กับทุกคนในสนาม (ผู้เล่น คู่แข่ง กลุ่มใหญ่)
const RSPD_NORMAL = 75;
const RSPD = { goal: RSPD_NORMAL, k: 1 };
try { const v = parseInt(localStorage.getItem('mtb.rspd2'), 10); if (v >= 0 && v <= 100) { RSPD.goal = v; RSPD.k = v / RSPD_NORMAL; } } catch (e) { /* ignore */ }
function setRaceSpeed(v) {
  RSPD.goal = clamp(Math.round(v), 0, 100);
  try { localStorage.setItem('mtb.rspd2', String(RSPD.goal)); } catch (e) { /* ignore */ }
  rspdUI(RSPD.goal);
}
function rspdLabel(v) { return v === RSPD_NORMAL ? `${v}% (ปกติ)` : v <= 0 ? '0% (หยุด)' : v > RSPD_NORMAL ? `${v}% (เร็วขึ้น)` : `${v}% (ช้าลง)`; }
function rspdUI(v) {
  document.querySelectorAll('.rSpd').forEach(el => { if (document.activeElement !== el) el.value = v; });
  document.querySelectorAll('.rSpdTxt').forEach(el => { el.textContent = rspdLabel(v); });
}
function rspdTick(dt) {
  const g = RSPD.goal / RSPD_NORMAL;
  RSPD.k += clamp(g - RSPD.k, -0.6 * dt, 0.6 * dt);
}
// ---- 🫂 จับกลุ่มอัตโนมัติ: ไม่ให้ทิ้งห่างกันมาก แข่งกันเป็นก้อนตลอด
// free = ระยะ (ม.) จากกลางกลุ่มที่ปั่นได้อิสระ · k = แรงดึงต่อเมตรที่เกิน · lead/trail = ตัวคูณต่ำสุด/สูงสุด
// glide = ห่างจากกลางกลุ่มเกินกี่เมตรถึงค่อยๆ ไหลกลับเข้ากลุ่ม · rate = สัดส่วนที่ไหลต่อวินาที
const COHESION = {
  off:    { name: 'ปิด (ทิ้งห่างได้)', free: 1e9, k: 0, lead: 1, trail: 1, glide: 0, rate: 0 },
  loose:  { name: 'หลวม', free: 30, k: 0.005, lead: 0.85, trail: 1.25, glide: 80, rate: 0.08 },
  medium: { name: 'กลาง', free: 10, k: 0.014, lead: 0.72, trail: 1.5, glide: 30, rate: 0.18 },
  tight:  { name: 'แน่น (ก้อนเดียว)', free: 4, k: 0.025, lead: 0.62, trail: 1.8, glide: 14, rate: 0.3 },
};
const WARP_GRACE = 20;   // วินาทีที่คนส่งของขวัญได้นำก่อน ระบบถึงจะดึงกลับเข้ากลุ่ม
let COH = 'tight';   // ค่าเริ่มต้น: จับกลุ่มแน่น ตามติดกันไม่ห่าง
try { const v = localStorage.getItem('mtb.cohesion'); if (COHESION[v]) COH = v; } catch (e) { /* ignore */ }
function packTick(dt) {
  // กลางกลุ่ม = คนที่อยู่ตรงกลาง (median) ของนักปั่นที่แข่งกัน
  const all = racers();
  const zs = all.map(o => o.z).sort((a, b) => a - b);
  S.packMid = zs.length ? zs[Math.floor(zs.length / 2)] : 0;
  // ห่างเกินมาก (ชนหยุด/ของขวัญพุ่ง) → ค่อยๆ ไหลกลับเข้ากลุ่ม
  // ดึงถอยหลังได้ไม่เกิน 8 ม./วิ (ยังเห็นว่าปั่นไปข้างหน้า) · ไล่ขึ้นได้ถึง 20 ม./วิ
  const c = COHESION[COH], m = U_PER_M;
  if (!c.glide || S.regroup || SP.on || (RACE && (RACE.podium || RACE.finishZ)) || S.countdown > 0) return;
  for (const o of all) {
    if ((o.me ? S.warpUntil : o.warpUntil) > S.gt) continue;
    const gap = (o.z - S.packMid) / m, ex = Math.abs(gap) - c.glide;
    if (ex <= 0) continue;
    const dz = -Math.sign(gap) * Math.min(ex * c.rate, gap > 0 ? 8 : 20) * dt * m * RSPD.k;
    if (o.me) { S.position += dz; S.prevPZ = S.position + PLAYER_Z; } else o.z += dz;
  }
}
function packMult(o) {
  const c = COHESION[COH];
  if (!c.k || S.packMid === undefined || SP.on || RACE.finishZ) return 1;   // ช่วงลุ้นเส้นชัย: ไม่ดึงกลุ่ม
  if ((o.me ? S.warpUntil : o.warpUntil) > S.gt) return 1;   // เพิ่งได้ของขวัญพุ่ง: ไม่ถูกชะลอ
  const gap = (o.z - S.packMid) / U_PER_M, ex = Math.abs(gap) - c.free;
  if (ex <= 0) return 1;
  // นำห่างเกิน → ผ่อนแรงลงทีละนิด · ตามหลังเกิน → เร่งไล่ (แรงกว่า 1.5 เท่า จะได้กลับมาเข้ากลุ่มเร็ว)
  return gap > 0 ? Math.max(c.lead, 1 - ex * c.k) : Math.min(c.trail, 1 + ex * c.k * 1.5);
}
function regroupTick(dt) {
  const G = S.regroup;
  if (!G) return;
  G.t += dt;
  const all = racers(), m = U_PER_M;
  const zs = all.map(o => o.z).sort((a, b) => a - b);
  G.anchor = zs[Math.floor(zs.length / 2)];   // จุดรวม = คนกลางกลุ่ม
  // ห่างเกิน 40 ม. → ไหลเข้าหากลุ่มแบบนุ่มๆ (60% ต่อวินาที) แล้วใช้ความเร็วเก็บช่วงสุดท้าย
  const ease = Math.min(1, 0.6 * dt);
  let maxGap = 0;
  for (const o of all) {
    const gap = (o.z - G.anchor) / m, ex = Math.abs(gap) - 40;
    maxGap = Math.max(maxGap, Math.abs(gap));
    if (ex <= 0) continue;
    const dz = -Math.sign(gap) * ex * m * ease;
    if (o.me) { S.position += dz; S.prevPZ = S.position + PLAYER_Z; } else o.z += dz;
  }
  // คนเยอะ กลุ่มก็ยาวขึ้น (ขี่เรียงแถว) → ระยะ "จับกลุ่มแล้ว" ปรับตามจำนวนคน
  if (maxGap < Math.max(25, 10 + all.length * 1.2) || G.t > 25) {
    S.regroup = null;
    banner('🏁 รวมกลุ่มแล้ว! แข่งกันต่อ', 'ทุกคนเริ่มสู้ใหม่จากกลุ่มเดียวกัน');
    comic('ลุย!!', '#b9f6ca');
    for (const r of S.rivals) r.effT = 0;
    S.pe.effT = 0;
  }
}
function setMode(m) {
  if (m === MODE || (m !== 'race' && m !== 'sim')) return;
  MODE = m;
  try { localStorage.setItem('mtb.mode', m); } catch (e) { /* ignore */ }
  RACE.podium = null; RACE.finishing = false;
  initRivals(); initPack();
  banner(m === 'race' ? '🏁 โหมดแข่งผู้ติดตาม' : '🎮 โหมดจำลองการเล่น', m === 'race' ? 'กดติดตาม = ได้นักปั่น · รอบละ 30 นาที เข้าเส้นชัยก่อนชนะ' : 'นักปั่น 6 คน · แรงปั่นจำลองจริง');
}
function rivalVisible(r) { const g = r.z - S.position; return g > 260 && g < DRAW * SEG_L * 0.7; }
function say(r, text, prio) {
  if (!r || r.me || !text) return;
  if (r.talkT > 0 && !prio) return;
  r.talkT = 2.2;
  r.say = { text, t: 2.8 };
  // ไม่แสดงข้อความแชทของบอทบนจอแล้ว (เหลือเฉพาะข้อความจากของขวัญ/ผู้ชมที่ donate)
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
      if (lv.name === 'สู้มาก') { autoNote(`🔥 ${r.name} สู้มาก! เร่งสุดแรง`, r.jersey); r.lvMsgT = S.gt; }
      else if (lv.name === 'เหนื่อย') { autoNote(`🥵 ${r.name} หมดแรง ปั่นช้าลง`, '#e0e0e0'); r.lvMsgT = S.gt; }
    }
    const slopeMult = slope > 0 ? 1 - clamp(slope * 2.2, 0, 0.6) : 1 + clamp(-slope * 1.8, 0, 0.7);
    let target = MAX_SPEED * r.base * effortSpeed(r.effort) * (near.draft ? 1.05 : 1) * wp('maxMult') * surfAt(getSeg(ri)).speed * slopeMult;
    target *= regroupMult(r);
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
      if (r.stopT <= 0 && Math.abs(gap) < 40 * m) autoNote(`🚴 ${r.name} ออกตัวปั่นใหม่`, r.jersey);
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
    target = Math.min(target, SP.on ? S.speed * 1.5 : TOP_SPEED * 0.95 * Math.max(1, RSPD.k));
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
      if (o.dodge[r.idx] === undefined) o.dodge[r.idx] = def.bad && Math.random() < 0.9;   // นักปั่นที่เพิ่งเข้ามา
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
            if (Math.abs(gap) < 40 * m) autoNote(`💥 ${r.name} ${def.label} หยุดกึก!`, '#ffccbc');
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
  if (RSPD.k < 0.05) return;   // ความเร็วการแข่ง ~0% = หยุดทั้งสนาม: บอทห้ามโกง/ตัดทางลัด
  const pz = S.position + PLAYER_Z;
  S.cheatT -= dt;
  if (S.cheatT <= 0) {
    S.cheatT = (3 + Math.random() * 5) * [1.3, 1, 0.8, 0.6][S.diff];
    const near = S.rivals.filter(r => Math.abs(r.z - pz) < 60 * U_PER_M && r.fallT <= 0 && (MODE !== 'race' || r.bot));   // โหมดแข่ง: บอทเท่านั้นที่โกง
    if (near.length) doCheat(pick(near));
  }
  // ดวลกันสูสี
  const close = S.rivals.filter(r => Math.abs(r.z - pz) < 5 * U_PER_M);
  S.battleT = close.length ? S.battleT + dt : Math.max(0, S.battleT - dt * 2);
  if (S.battleT > 1.5 && S.gt - S.lastBattleMsg > 15) {
    S.lastBattleMsg = S.gt;
    banner('⚔️ ดวลกันสูสี!', 'คุณ vs ' + close.slice(0, 3).map(r => r.name).join(' vs ') + (close.length > 3 ? ` และอีก ${close.length - 3} คน` : ''));
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
  autoNote(`${OB[type].icon} ${r.name} ทิ้ง${OB[type].name}ไว้ข้างหลัง!`, '#ffe0b2');
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
    case 'grab': affect(ahead, 'grab', r); r.boostT = Math.max(r.boostT, 1.5); victim = ahead; autoNote(`🫳 ${r.name} ดึงเสื้อ ${ahead.name}!`, '#ffccbc'); break;
    case 'shove': affect(nearby, 'shove', r); victim = nearby; autoNote(`🤜 ${r.name} ผลัก ${nearby.name}!`, '#ffccbc'); break;
    case 'drop': dropTrap(r); break;
    case 'motor': r.motorT = 4; autoNote(`⚡ ${r.name} แอบใช้มอเตอร์ไฟฟ้า!`, '#fff59d'); break;
    case 'shortcut': r.z += 15 * U_PER_M; r.x = r.tx = (Math.random() < 0.5 ? -0.8 : 0.8); autoNote(`🌀 ${r.name} ตัดทางลัด! ขี้โกง!`, '#e1bee7'); break;
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
  let maxS = MAX_SPEED * wp('maxMult') * eff.maxMult * sf.speed * effortSpeed(S.pe.effort) * (S.near.draft ? 1.05 : 1) * regroupMult(racers()[0]);
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
  S.speed = clamp(S.speed, 0, TOP_SPEED * Math.max(RSPD.k, 0.001));   // ลงเขาก็ไม่เกินความเร็วการแข่งที่ตั้งไว้
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
  let p0 = performance.now();
  hourTick(dt);
  musicTick();
  p0 = pmark('u:music', p0);
  updateFX(dt);
  updateAdminStatus(false);
  p0 = pmark('u:admin', p0);
  updateCamera(dt);
  pmark('u:camera', p0);
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
    const cc = countryOf(ps.sid);
    if (S.lastScene) {
      if (countryOf(S.lastScene) !== cc) banner(`ยินดีต้อนรับสู่ประเทศ${COUNTRIES[cc].name}`, `${ps.scene.icon} ${ps.scene.name}`);
      else banner(`${ps.scene.icon} ${ps.scene.name}`, `ประเทศ${COUNTRIES[cc].name}`);
    }
    S.lastScene = ps.sid;
  }

  if (AC && rainGain) {
    rainGain.gain.value = (wI('rain') * 0.05) * (S.paused ? 0 : 1);
    windGain.gain.value = Math.min(0.12, (S.speed / MAX_SPEED) * 0.07 + wI('snow') * 0.03) * (S.paused || !S.started ? 0 : 1);
  }
  PLAYER_SPRITE.name = playerName(); PLAYER_SPRITE.avatar = MODE === 'race' ? (RACE.owner.avatar || '') : '';
  if (!S.started || S.paused) return;
  if (MODE === 'race' && raceTick(dt)) return;
  if (S.countdown > 0) {
    const before = Math.ceil(S.countdown);
    S.countdown -= dt;
    const after = Math.ceil(S.countdown);
    if (after !== before) beep(after > 0 ? 520 : 1040, after > 0 ? 0.18 : 0.4, 'square', 0.12);
    if (S.countdown > 0) return;
    toast('🚵 GO! ปั่นเลย!', '#b9f6ca');
  }
  S.gt += dt;
  let pt = performance.now();
  rspdTick(dt);
  packTick(dt);
  if (SP.on) updateSpace(dt); else updatePlayer(dt);
  updateTricks(dt);
  pt = pmark('u:player', pt);
  updateRivals(dt);
  pt = pmark('u:rivals', pt);
  updatePack(dt);
  regroupTick(dt);
  resolvePlayer();
  pt = pmark('u:pack', pt);
  updateTelemetry(dt);
  if (!SP.on) { spawnObjects(); collide(); }
  updateRank();
  updateDirector(dt);
  pmark('u:objects', pt);
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
    // ---- ของประดับประจำประเทศ
    case 'thaihouse': {   // บ้านเรือนไทย: ใต้ถุนสูง หลังคาจั่วชัน ปั้นลมโค้ง
      const w = (1500 + v * 500) * k, h = w;
      const wood = v < 0.5 ? '#8d5a35' : '#6d4429', roof = snow ? '#f2f6fb' : (v < 0.5 ? '#9c3d22' : '#7b4b2a');
      ctx.fillStyle = '#4e342e';
      for (const dx of [-0.38, -0.12, 0.12, 0.38]) ctx.fillRect(x + dx * w - w * 0.025, y - h * 0.36, w * 0.05, h * 0.36);
      ctx.fillStyle = wood; ctx.fillRect(x - w * 0.42, y - h * 0.66, w * 0.84, h * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = -3; i <= 3; i++) ctx.fillRect(x + i * w * 0.11 - w * 0.006, y - h * 0.66, w * 0.012, h * 0.3);
      ctx.fillStyle = ENV.dark > 0.25 ? '#ffcc66' : '#3e2723'; ctx.fillRect(x - w * 0.1, y - h * 0.6, w * 0.2, h * 0.18);
      poly([x - w * 0.5, y - h * 0.64, x + w * 0.5, y - h * 0.64, x + w * 0.16, y - h * 1.12, x - w * 0.16, y - h * 1.12], roof);
      ctx.strokeStyle = '#d4a017'; ctx.lineWidth = Math.max(1, w * 0.02); ctx.lineCap = 'round';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + sd * w * 0.5, y - h * 0.64); ctx.quadraticCurveTo(x + sd * w * 0.3, y - h * 0.9, x + sd * w * 0.1, y - h * 1.18); ctx.stroke(); }
      ctx.lineCap = 'butt';
      if (ENV.dark > 0.25) LIGHTS.push({ x, y: y - h * 0.5, r: w * 0.45, c: '255,190,90' });
      break;
    }
    case 'sakura': {   // ต้นซากุระ ดอกชมพู
      const h = (1700 + v * 1000) * k, r = h * 0.32;
      ctx.fillStyle = '#4e342e'; ctx.fillRect(x - h * 0.035, y - h * 0.55, h * 0.07, h * 0.55);
      const g = snow ? ['#f1e4ea', '#f8eef2', '#ffffff'] : ['#f48fb1', '#f8bbd0', '#fce4ec'];
      ell(x - r * 0.6, y - h * 0.6, r * 0.7, r * 0.55, g[0]);
      ell(x + r * 0.6, y - h * 0.62, r * 0.7, r * 0.55, g[0]);
      ell(x, y - h * 0.75, r, r * 0.75, g[1]);
      ell(x - r * 0.2, y - h * 0.85, r * 0.5, r * 0.35, g[2]);
      break;
    }
    case 'torii': {   // ประตูโทริอิสีแดง
      const h = 2200 * k, w = h * 0.9, col = '#d32f2f';
      ctx.fillStyle = col;
      ctx.fillRect(x - w * 0.36, y - h * 0.86, w * 0.08, h * 0.86);
      ctx.fillRect(x + w * 0.28, y - h * 0.86, w * 0.08, h * 0.86);
      ctx.fillRect(x - w * 0.42, y - h * 0.72, w * 0.84, h * 0.05);
      poly([x - w * 0.56, y - h * 0.86, x + w * 0.56, y - h * 0.86, x + w * 0.5, y - h * 0.96, x - w * 0.5, y - h * 0.96], '#212121');
      ctx.fillStyle = col; ctx.fillRect(x - w * 0.5, y - h * 0.9, w, h * 0.05);
      break;
    }
    case 'pyramid': {   // พีระมิดไกลๆ
      const w = (5000 + v * 3000) * k, h = w * 0.62;
      tri(x - w / 2, y, x + w / 2, y, x, y - h, '#d9b26f');
      tri(x, y - h, x + w / 2, y, x + w * 0.08, y, '#b8904f');
      break;
    }
    case 'flag': {   // เสาธงชาติของประเทศที่กำลังปั่นผ่าน
      const h = 2400 * k, fw = h * 0.42, fh = fw * 0.62;
      ctx.fillStyle = '#cfd8dc'; ctx.fillRect(x - h * 0.012, y - h, h * 0.024, h);
      ell(x, y - h, h * 0.02, h * 0.02, '#ffd54f');
      const wave = Math.sin(S.t * 3 + v * 6) * fh * 0.05;
      drawFlag(d.cc, x + h * 0.012, y - h + h * 0.02 + wave, fw, fh);
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
  if (!r.extra && r.effort !== undefined && k * 700 > 12) {
    const lv = effortLv(r.effort), bw = 60, by = y - 880 * k - 16;
    rr(x - bw / 2, by, bw, 8, 4, 'rgba(0,0,0,0.5)');
    rr(x - bw / 2, by, Math.max(8, bw * r.effort / 100), 8, 4, lv.color);
    drawEmo(r.stopT > 0 ? '💥' : lv.icon, x, by - 12 + 9, 18);   // อีโมจิจากภาพที่จำไว้ (เร็วกว่าวาดเป็นตัวหนังสือ)
  }
  // ไม่แสดงลูกโป่งคำพูดเหนือหัวแล้ว (ยังมีเสียงพูดตามเดิม)
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
  if (!drawAvatarHead(x, y - 712 * s, 84 * s, r)) {
    ell(x, y - 690 * s, 50 * s, 46 * s, '#c68c5a');
    ell(x, y - 705 * s, 62 * s, 50 * s, r.helmet);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 22 * s - 4 * s, y - 745 * s, 8 * s, 40 * s);
  }
  if (ENV.dark > 0.25) {
    ell(x, y - 300 * s, 14 * s, 10 * s, '#ff1744');
    LIGHTS.push({ x, y: y - 300 * s, r: 90 * s + 4, c: '255,40,60' });
  }
  drawNameTag(r, x, y, s);
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
    // มุมสูง (top view) ดาวเคราะห์/ดาวหางผ่านใต้กลุ่ม เป็นฉากหลัง ไม่ชนแล้ว
    if (!o.passed && o.z < 60) o.passed = true;
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
// ---- อวกาศมุมสูง (Top view): เห็นนักปั่นทุกคนจับกลุ่มเป็นก้อน บินไปด้วยกัน ไม่ตามใครคนเดียว
function drawSpaceTop(id, u) {
  ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, W, H);
  const neb = ctx.createRadialGradient(W * 0.25, H * 0.3, 10, W * 0.25, H * 0.3, H * 0.7);
  neb.addColorStop(0, 'rgba(120,60,200,0.28)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
  const neb2 = ctx.createRadialGradient(W * 0.8, H * 0.75, 10, W * 0.8, H * 0.75, H * 0.5);
  neb2.addColorStop(0, 'rgba(40,140,220,0.2)'); neb2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
  // ดาวเลื่อนลง = กลุ่มบินขึ้นไปข้างหน้า
  const sp = id === 'blackhole' ? 1100 : id === 'comets' ? 800 : 600;
  for (let i = 0; i < 170; i++) {
    const depth = 0.25 + hash2(i, 93) * 0.9, x = hash2(i, 91) * W;
    const y = (hash2(i, 92) * (H + 40) + S.t * sp * depth) % (H + 40) - 20;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + depth * 0.5})`;
    ctx.fillRect(x, y, Math.max(1, depth * 2), Math.max(1, depth * 2 + depth * sp / 260));
  }
  // ดาวเคราะห์ / อุกกาบาต / ดาวหาง ผ่านใต้กลุ่ม (เป็นฉากหลัง)
  for (const o of SP.objs) {
    const p = clamp(1 - o.z / 3200, 0, 1.05), r = o.type === 'planet' ? o.r * 0.2 : o.r * 0.35;
    const x = W / 2 + o.x * 0.22, y = lerp(-r * 2, H + r * 2, p);
    if (o.type === 'planet') {
      const P = PLANETS[o.kind], g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, rgb(P.c1)); g.addColorStop(1, rgb(P.c2));
      if (P.ring) { ctx.strokeStyle = rgb(P.c1, 0.6); ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * 0.5, -0.4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 'comet') {
      const tx = x - (o.vx || 0) * 0.12, ty = y - 90;
      const g = ctx.createLinearGradient(x, y, tx, ty);
      g.addColorStop(0, 'rgba(200,245,255,0.95)'); g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = r * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.lineCap = 'butt';
      ell(x, y, r * 0.5, r * 0.5, '#ffffff');
    } else drawEmo('🪨', x, y + r, r * 2);
  }
  // หลุมดำ: วนเป็นเกลียวด้านบน แล้วดูดกลุ่มเข้าหา
  const vx = W / 2, vy = H * 0.26;
  if (id === 'blackhole') {
    const R = 40 + u * 110;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(255,${150 + i * 30},${70 + i * 40},${0.55 - i * 0.1})`; ctx.lineWidth = R * (0.22 - i * 0.04);
      ctx.beginPath(); ctx.ellipse(vx, vy, R * (1.9 + i * 0.35), R * (0.7 + i * 0.12), S.t * (1 + i * 0.3), 0, Math.PI * 2); ctx.stroke();
    }
    ell(vx, vy, R, R, '#000');
  }
  // กลุ่มนักปั่น: จัดแถวเป็นก้อน ผู้นำอยู่บน
  const all = racers().map(o => (o.me ? Object.assign(PLAYER_SPRITE, { team: PLAYER_REF.team }) : o)).sort((a, b) => b.z - a.z);
  const n = all.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5, rows = Math.ceil(n / cols);
  const gap = clamp(Math.min(360 / cols, 460 / rows), 52, 96), s = gap / 70;
  const cx = W / 2 - GIFT_SIDE_W * 0.35, cy = H * 0.56;
  all.forEach((o, k) => {
    const row = Math.floor(k / cols), col = k % cols, inRow = Math.min(cols, n - row * cols);
    let x = cx + (col - (inRow - 1) / 2) * gap + Math.sin(S.t * 1.3 + k) * 6;
    let y = cy + (row - (rows - 1) / 2) * gap * 1.05 + Math.cos(S.t * 1.1 + k * 0.7) * 5;
    if (id === 'blackhole') { const pull = u * u * 0.45; x = lerp(x, vx, pull); y = lerp(y, vy, pull); }
    drawTopRocket(x, y, s, o, k);
  });
}
function drawTopRocket(x, y, s, o, rank) {
  const f = 0.8 + Math.random() * 0.4;
  ell(x, y + 34 * s, 9 * s, 24 * s * f, 'rgba(255,150,40,0.9)');
  ell(x, y + 30 * s, 5 * s, 13 * s * f, '#fff8c0');
  poly([x - 11 * s, y + 6 * s, x - 22 * s, y + 24 * s, x - 10 * s, y + 20 * s], '#e53935');
  poly([x + 11 * s, y + 6 * s, x + 22 * s, y + 24 * s, x + 10 * s, y + 20 * s], '#e53935');
  rr(x - 12 * s, y - 26 * s, 24 * s, 50 * s, 11 * s, o.me ? '#ff7043' : (o.jersey || '#90a4ae'), 'rgba(255,255,255,0.5)', 1);
  if (!drawAvatarHead(x, y - 4 * s, 13 * s, o)) { ell(x, y - 4 * s, 13 * s, 13 * s, o.helmet || '#ffeb3b'); ell(x, y - 7 * s, 7 * s, 5 * s, 'rgba(255,255,255,0.4)'); }
  if (o.team) drawFlag(o.team, x - 8 * s, y + 12 * s, 16 * s, 10 * s);
  if (rank === 0) drawEmo('👑', x, y - 28 * s, 22 * s);
  if (rank < 3 || o.me) {
    const nm = nameOf(o), t = nm.length > 10 ? nm.slice(0, 9) + '…' : nm;
    font(11, 700); const tw = ctx.measureText(t).width + 10;
    rr(x - tw / 2, y + 44 * s, tw, 17, 6, o.follower ? 'rgba(233,30,99,0.55)' : 'rgba(0,0,0,0.5)');
    textC(t, x, y + 44 * s + 9, '#fff', 11, 700);
  }
}
function drawSpace(env) {
  const id = spPhase().id, u = SP.t / spPhase().dur;
  if (id === 'space' || id === 'comets' || id === 'blackhole') {
    drawSpaceTop(id, u);
    if (SP.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${SP.flash * 0.8})`; ctx.fillRect(0, 0, W, H); }
    if (id === 'blackhole' && u > 0.75) { ctx.fillStyle = `rgba(0,0,0,${(u - 0.75) * 4})`; ctx.fillRect(0, 0, W, H); }
    return;
  }
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
    const p = spProj(r.x * 650 + Math.sin(S.t * 0.7 + r.idx) * 160, ((r.idx % 5) - 2) * 130 + Math.cos(S.t * 0.9 + r.idx) * 80, z);
    const k = p.s * 0.55;
    drawRocketRider(p.x, p.y + 300 * k, k, r, id === 'descent');
    if (k * 700 > 40) { font(13, 600); const tw = ctx.measureText(r.name).width + 12; rr(p.x - tw / 2, p.y - 520 * k - 22, tw, 20, 6, 'rgba(0,0,0,0.5)'); textC(r.name, p.x, p.y - 520 * k - 12, '#fff', 13, 600); }
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
  // แอดมินเลือกหลายมุม → สลับเฉพาะมุมที่เลือก
  if (PICK.cam.size > 1) {
    const shot = pickOne('cam', CAM.shot);
    if (shot === 'riderpov') return cutShot('riderpov', pick(top3().filter(o => !o.me)) || pick(S.rivals));
    return cutShot(shot);
  }
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
  CAM.mode = CAM_MODES.includes(m) ? m : PICK.cam.size === 1 ? [...PICK.cam][0] : 'broadcast';
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
  if (shot === 'top') CAM.topKind = TOP_LOCK || pickOne('topkind', prevKind) || pickWeighted(TOP_KIND_W, Math.random());
  // มุมหน้ากลุ่มผู้นำหันกล้องกลับด้าน → ต้องตัดภาพ ห้ามเลื่อนต่อ
  const glide = shot === CAM.shot && (shot === 'side' || (shot === 'top' && (CAM.topKind === 'front') === (prevKind === 'front')));
  CAM.shot = shot; CAM.shotT = 0;
  if (glide) CAM.glideUntil = S.t + 1.6;
  else { CAM.flash = 1; CAM.snap = true; CAM.panSnap = true; }
  CAM.dur = camDur();   // ระยะเวลาต่อมุม ตามสไตล์กล้องที่เลือก
  CAM.target = shot === 'riderpov' ? (target || pick(S.rivals)) : shot === 'follow' ? target : null;
  CAM.move = Math.floor(Math.random() * 4);   // รูปแบบการเคลื่อนกล้อง
  if (shot === 'roadside') placeSpot();
  if (shot === 'headon' || shot === 'side' || shot === 'top') CAM.spotSide = Math.random() < 0.5 ? -1 : 1;
}
// ---- สไตล์กล้อง (ปุ่มในแผงผู้ดูแล)
//   fun = ตัดสลับบ่อย 2.5-4.5 วิ · smooth = ค้างนาน 12-20 วิ · chill = ตัดตรงห้องเพลง (4 หรือ 8 ห้อง)
const CAM_STYLES = {
  fun:    { icon: '🎉', name: 'สนุก (ตัดสลับบ่อย)', focusGap: 5, focusSkip: 0.2 },
  smooth: { icon: '🌊', name: 'Smooth (ค้างนาน ไม่ถี่)', focusGap: 25, focusSkip: 0.6 },
  chill:  { icon: '🎵', name: 'สบายๆ ตามจังหวะเพลง', focusGap: 12, focusSkip: 0.5 },
};
let CAMSTYLE = (() => { try { const v = localStorage.getItem('mtb.camstyle'); return CAM_STYLES[v] ? v : 'chill'; } catch (e) { return 'chill'; } })();
function camDur() {
  if (CAMSTYLE === 'fun') return 2.5 + Math.random() * 2;
  if (CAMSTYLE === 'smooth') return 12 + Math.random() * 8;
  // ตามจังหวะเพลง: 4 หรือ 8 ห้อง แล้วชดเชยให้ตัดตรงต้นห้องพอดี
  const bs = barSec();
  let d = bs * (Math.random() < 0.6 ? 4 : 8);
  if (AC && MUSIC.spb) { const into = (MUSIC.step % 16) * MUSIC.spb; d = Math.max(bs * 2, d - into); }
  return d;
}
function camFocus(who) {
  if (CAM.mode !== 'broadcast' || !who) return;
  // ตัดไปหาเหตุการณ์ไม่บ่อยเกินไป (ตามสไตล์กล้อง) ให้มุมสุ่มยังหลากหลาย
  const cs = CAM_STYLES[CAMSTYLE];
  if (CAM.focus || S.t - (CAM.lastFocus || -99) < cs.focusGap || Math.random() < cs.focusSkip) return;
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
    if ((!CAM.focus && CAM.shotT > CAM.dur) || CAM.shotT > Math.max(10, CAM.dur + 2)) {
      CAM.focus = null;
      directorCut();
    }
  } else if (CAM.mode === 'riderpov' && CAM.shotT > 7) {
    cutShot('riderpov', S.rivals[(S.rivals.indexOf(CAM.target) + 1) % S.rivals.length]);
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
  // หน้า + แว่น + หมวก (ผู้ติดตาม/คนสร้าง: รูปโปรไฟล์แทนหัว)
  if (!drawAvatarHead(x, y - 692 * s, 84 * s, r)) {
    ell(x, y - 660 * s, 44 * s, 48 * s, '#c68c5a');
    rr(x - 44 * s, y - 680 * s, 88 * s, 22 * s, 10 * s, 'rgba(20,20,30,0.9)');
    if (r.say) ell(x, y - 630 * s, 12 * s, 9 * s, '#5d1f1f');
    ell(x, y - 700 * s, 60 * s, 40 * s, r.helmet);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * 22 * s - 4 * s, y - 730 * s, 8 * s, 26 * s);
  }
  if (ENV.dark > 0.25) {
    ell(x, y - 380 * s, 12 * s, 10 * s, '#fffde7');
    LIGHTS.push({ x, y: y - 380 * s, r: 140 * s + 6, c: '255,250,220' });
  }
  drawNameTag(r, x, y, s);
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
  const n = MODE === 'race' ? 0 : PACK_N;   // โหมดแข่ง: มีแค่คนสร้าง + บอท 4 + ผู้ติดตาม ไม่มีตัวประกอบ
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
  const ref = Math.max(S.speed, MAX_SPEED * 0.6 * RSPD.k);
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
  renderAdmin();   // หน้าเกมวาดแผงไว้แบบซ่อน เพื่อคำนวณปุ่มที่เลือกอยู่ส่งให้หน้า /admin
}
// ℹ️ = เปิดแผงผู้ดูแลเป็นหน้าใหม่ (ไม่บังเกม ไม่ติดไปกับภาพไลฟ์)
function toggleAdmin() {
  const w = window.open('/admin', 'mtbAdmin', 'width=460,height=920');
  if (!w) toast('⚠️ เบราว์เซอร์บล็อกหน้าต่างใหม่ — เปิด http://localhost:3000/admin เองได้', '#ffccbc');
}
// ---- หน้า /admin: ส่งคำสั่ง / รับสถานะจากหน้าเกมผ่านเซิร์ฟเวอร์
const REMOTE = { on: new Set(), age: -1, mode: null, pend: new Map() };
// กดปุ่มในหน้า /admin แล้วติดไฟทันที (เดาผลไว้ก่อน) ไม่ต้องรอหน้าเกมตอบกลับ — หน้าเกมยืนยันแล้วค่อยใช้ค่าจริง
const PRED_SINGLE = new Set(['mode', 'track', 'cohesion', 'sharp', 'rtype', 'camstyle', 'pack', 'action', 'tmode']);
const PRED_TOGGLE = new Set(['space', 'pause', 'music', 'voice', 'flist', 'gifts', 'regroup']);
const PRED_SKIP = new Set(['sfxvol', 'envvol', 'bgtone', 'rspd', 'close']);
function predictPanel(kind, val) {
  if (!ADMIN.el || PRED_SKIP.has(kind)) return;
  const P = REMOTE.pend, now = performance.now(), until = now + 6000, v = String(val == null ? '' : val);
  const key = (k, x) => k + '|' + x;
  const btns = [...ADMIN.el.querySelectorAll(`button[data-k="${kind}"]`)].map(b => b.dataset.v);
  let flash = false;
  if (PRED_SINGLE.has(kind)) {
    for (const x of btns) P.set(key(kind, x), { on: x === v, until });
    if (kind === 'action') P.set('cheat|', { on: false, until });
  } else if (kind === 'cheat') {
    for (const b of ADMIN.el.querySelectorAll('button[data-k="action"]')) P.set(key('action', b.dataset.v), { on: false, until });
    P.set('cheat|', { on: true, until });
  } else if (PICK_KINDS.includes(kind)) {
    const rnd = kind === 'cam' ? 'broadcast' : 'random';
    if (v === rnd) for (const x of btns) P.set(key(kind, x), { on: x === rnd, until });
    else {
      const turnOn = !adminActive(kind, v);
      const any = btns.some(x => x !== rnd && (x === v ? turnOn : adminActive(kind, x)));
      P.set(key(kind, v), { on: turnOn, until });
      P.set(key(kind, rnd), { on: !any, until });
    }
  } else if (PRED_TOGGLE.has(kind)) P.set(key(kind, v), { on: !adminActive(kind, v), until });
  else { P.set(key(kind, v), { on: true, until: now + 700, flash: true }); flash = true; }   // ปุ่มกดครั้งเดียว: กะพริบให้รู้ว่ากดแล้ว
  refreshAdminButtons();
  if (flash) setTimeout(refreshAdminButtons, 750);
}
function panelSend(kind, val) {
  const target = parseInt((document.getElementById('admTarget') || {}).value || '0', 10) || 0;
  predictPanel(kind, val);
  fetch('/admin/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, val, target }) })
    .then(() => { for (const ms of [150, 600, CMD_DELAY * 1000 + 300, CMD_DELAY * 1000 + 1000]) setTimeout(panelPoll, ms); })
    .catch(() => panelNote('⚠️ ติดต่อเซิร์ฟเวอร์ไม่ได้ — เปิด node server.js ก่อน'));
}
// ข้อความสถานะที่รับมาจากเซิร์ฟเวอร์: อนุญาตแค่ตัวหนา/ขึ้นบรรทัด/ตัวเล็ก ที่เหลือแปลงเป็นข้อความธรรมดา (กันแทรกสคริปต์)
function safeHtml(s) { return adminEsc(String(s)).replace(/&lt;(\/?)(b|br|small)&gt;/g, '<$1$2>'); }
function panelNote(html) { const n = $id('admNote'); if (n) n.innerHTML = html; }
function panelPoll() {
  fetch('/admin/state').then(r => r.json()).then(st => {
    REMOTE.age = st.age;
    if (st.age < 0 || st.age > 5000) panelNote('⚠️ ยังไม่พบหน้าเกม — เปิดเกมที่ <b>http://localhost:3000</b> (Chrome หรือลิงก์ใน LIVE Studio)');
    else if (st.build !== GAME_BUILD) panelNote(`⚠️ หน้าเกมยังใช้ไฟล์เก่า — ปุ่มใหม่จะยังไม่ทำงาน<br>กด <b>🔄 รีโหลดหน้าเกมทุกจอ</b> ด้านล่าง หรือกด F5 ที่หน้าเกม${st.build ? '' : ' (หน้าเกมเก่ามาก ต้องกด F5 เองครั้งนี้)'}`);
    else panelNote('');
    if (st.mode && st.mode !== MODE) { MODE = st.mode; renderAdmin(); }
    REMOTE.on = new Set(st.on || []);
    // ค่าที่เดาไว้: หน้าเกมยืนยันตรงกันแล้ว หรือเกิน 6 วิ → ใช้ค่าจริงจากหน้าเกม
    const tnow = performance.now();
    for (const [k, p] of REMOTE.pend) if (tnow > p.until || (!p.flash && REMOTE.on.has(k) === p.on)) REMOTE.pend.delete(k);
    if (ADMIN.statusEl && st.status) ADMIN.statusEl.innerHTML = safeHtml(st.status);
    const ts = $id('admTkStat'); if (ts && st.tk) ts.innerHTML = safeHtml(st.tk);
    const busy = document.activeElement && document.activeElement.type === 'range';
    if (!busy && typeof st.sfx === 'number') volUI('sfx', st.sfx);
    if (!busy && typeof st.env === 'number') volUI('env', st.env);
    if (!busy && typeof st.tone === 'number') { BGTONE = st.tone; toneUI(st.tone); }
    if (!busy && typeof st.rspd === 'number') { RSPD.goal = st.rspd; rspdUI(st.rspd); }
    refreshAdminButtons();
  }).catch(() => panelNote('⚠️ ติดต่อเซิร์ฟเวอร์ไม่ได้ — เปิด node server.js ก่อน'));
}
function startPanel() {
  document.title = 'แผงผู้ดูแล · MTB Endless Ride';
  document.body.classList.add('panel-page');
  ADMIN.el = $id('admin'); ADMIN.open = true;
  fetchLiveConfig();
  if (typeof EventSource === 'function') {
    const es = new EventSource('/events');
    es.onopen = () => { S.live.server = true; };
    es.onerror = () => { S.live.server = false; };
    es.onmessage = ev => { try { onLiveMessage(JSON.parse(ev.data)); } catch (e) { /* ignore */ } };
  }
  renderAdmin();
  panelPoll();
  setInterval(panelPoll, 500);
}
// หน้าเกม: ส่งสถานะ (ปุ่มที่เลือกอยู่ + ข้อความสถานะ) ให้หน้า /admin ทุก 1 วิ
function postAdminState(force) {
  if (PANEL || !S.live.server || !ADMIN.el) return;
  const now = performance.now();
  if (now - (ADMIN.lastPost || -9999) < (force ? 120 : 900)) return;   // หลังกดคำสั่ง: ส่งทันที
  ADMIN.lastPost = now;
  const on = [];
  ADMIN.el.querySelectorAll('button[data-k]').forEach(b => { if (adminActive(b.dataset.k, b.dataset.v)) on.push(b.dataset.k + '|' + b.dataset.v); });
  const ts = ADMIN.el.querySelector('#admTkStat');
  fetch('/admin/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    on, mode: MODE, status: ADMIN.statusEl ? ADMIN.statusEl.innerHTML : '', tk: ts ? ts.innerHTML : '', sfx: SFX_VOL, env: ENV_VOL, tone: BGTONE, rspd: RSPD.goal, perf: perfReport(), build: GAME_BUILD,
  }) }).catch(() => {});
}
let volSendT = 0;
document.addEventListener('input', e => {
  const c = e.target.classList;
  if (c && c.contains('rSpd')) {   // 🏎️ ความเร็วการแข่ง
    const v = parseInt(e.target.value, 10) || 0;
    document.querySelectorAll('.rSpdTxt').forEach(el => { el.textContent = rspdLabel(v); });
    if (PANEL) { const now = performance.now(); if (now - volSendT > 160) { volSendT = now; panelSend('rspd', v); } }
    else setRaceSpeed(v);
    return;
  }
  if (c && c.contains('bgTone')) {   // 🎨 สีฉากพื้นหลัง
    const v = parseInt(e.target.value, 10) || 0;
    document.querySelectorAll('.bgToneTxt').forEach(el => { el.textContent = toneLabel(v); });
    if (PANEL) { const now = performance.now(); if (now - volSendT > 160) { volSendT = now; panelSend('bgtone', v); } }
    else setBgTone(v);
    return;
  }
  if (!c || !(c.contains('sfxVol') || c.contains('envVol'))) return;
  if (PANEL) {   // ส่งไปหน้าเกม (ไม่เกิน 6 ครั้ง/วิ)
    const kind = c.contains('sfxVol') ? 'sfxvol' : 'envvol';
    volUI(kind === 'sfxvol' ? 'sfx' : 'env', e.target.value / 100);
    const now = performance.now();
    if (now - volSendT > 160) { volSendT = now; panelSend(kind, e.target.value); }
    return;
  }
  initAudio();
  if (c.contains('sfxVol')) setSfxVol(e.target.value / 100); else setEnvVol(e.target.value / 100);
});
// ปล่อยสไลด์แล้วเล่นเสียงตัวอย่าง ให้รู้ว่าดังแค่ไหน (หน้าแผง: ส่งค่าสุดท้ายให้แน่ใจ)
document.addEventListener('change', e => {
  const c = e.target.classList;
  if (c && c.contains('bgTone')) { if (PANEL) panelSend('bgtone', e.target.value); return; }
  if (c && c.contains('rSpd')) { if (PANEL) panelSend('rspd', e.target.value); return; }
  if (!c || !(c.contains('sfxVol') || c.contains('envVol'))) return;
  if (PANEL) panelSend(c.contains('sfxVol') ? 'sfxvol' : 'envvol', e.target.value);
  else if (c.contains('sfxVol')) sfx.pick();
});
// ทุกคำสั่งหน่วงเวลาก่อนมีผล → เกมเปลี่ยนแบบนุ่มๆ ไม่กระตุก
const CMD_DELAY = 1.5;
function soon(label, fn) {
  toast(`⏳ ${label}`, '#e1f5fe');
  later(CMD_DELAY, () => { fn(); updateAdminStatus(true); refreshAdminButtons(); });
}
// ฉากใหม่: ตั้งไว้เลยขอบฟ้า แล้วค่อยๆ ปั่นเข้าไป (ไม่ตัดภาพ ไม่แฟลช)
function sceneSoon(id) {
  if (!SCENES[id]) return;
  resetTrackAhead();
  addSceneChange(id, playerSegIdx() + DRAW + 20);
  toast(`🗺️ ข้างหน้าคือ ${SCENES[id].icon} ${SCENES[id].name}`, '#e1f5fe');
}
// กดซ้ำ = เอาออก · 🎲 = ล้างทั้งหมด · คืน true ถ้าเพิ่งเพิ่มเข้าไป
function togglePick(kind, val) {
  let added = false;
  if (val === 'random') PICK[kind].clear();
  else if (PICK[kind].has(String(val))) PICK[kind].delete(String(val));
  else { PICK[kind].add(String(val)); added = true; }
  savePick(); syncLocks();
  return added;
}
function adminAct(kind, val, opt) {
  // หน้า /admin: ส่งต่อให้หน้าเกม (ยกเว้นเชื่อม/ตัด TikTok ที่สั่งเซิร์ฟเวอร์ตรง)
  if (kind === 'reset' && !opt && !window.confirm('🔄 เริ่มเกมใหม่?\nทุกคนกลับเส้นสตาร์ต และนับเวลาด่านใหม่ (ไม่บันทึกผลรอบนี้)')) return;
  if (kind === 'monitor' || kind === 'followers' || kind === 'eventlog') {   // 📈 / 👥 / 📜 เปิดเป็นหน้าใหม่ (ไม่ส่งต่อให้หน้าเกม)
    const w = window.open('/' + kind, { monitor: 'mtbMonitor', followers: 'mtbFollowers', eventlog: 'mtbEventLog' }[kind], kind === 'eventlog' ? 'width=760,height=940' : 'width=480,height=940');
    if (!w) toast(`⚠️ เบราว์เซอร์บล็อกหน้าต่างใหม่ — เปิด http://localhost:3000/${kind} เองได้`, '#ffccbc');
    return;
  }
  if (PANEL && kind !== 'tkconnect' && kind !== 'tkstop') { panelSend(kind, val); return; }
  if (!opt) initAudio();
  const target = opt && Number.isInteger(opt.target) ? opt.target : parseInt((document.getElementById('admTarget') || {}).value || '0', 10) || 0;
  const other = (list, cur) => pick(list.filter(x => x !== cur));
  switch (kind) {
    case 'action': ADMIN.last = val; onLiveMessage({ type: 'gift', user: 'แอดมิน', giftName: 'ทดสอบ', count: 1, diamonds: 0, action: val, repeat: 1, target }); break;
    case 'cheat': ADMIN.last = 'cheat'; doCheat(pick(S.rivals)); break;
    // ---- โหมดแข่งผู้ติดตาม
    case 'mode': if (val !== MODE) soon(val === 'race' ? 'สลับเป็นโหมดแข่งผู้ติดตาม' : 'สลับเป็นโหมดจำลองการเล่น', () => { setMode(val); renderAdmin(); }); break;
    case 'rfollow': {
      const nick = pick(['น้องฟ้า', 'พี่บอล', 'มะปราง', 'ต้นกล้า', 'ใบเตย', 'Kitty', 'แบงค์', 'ป๊อปปี้', 'Max_TH', 'นุ่นนิ่ม']) + Math.floor(Math.random() * 100);
      if (S.live.server) fetch('/race/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nick }) }).catch(() => {});
      else onLiveMessage({ type: 'follow', uniqueId: 'local_' + Date.now(), nickname: nick, avatar: '' });
      break;
    }
    case 'rgift': {
      const dm = { self: 1, help: 5, prank: 30, mood: 99, scene: 299 }[val] || 1;
      const sender = pick(S.rivals.filter(r => r.follower)) || null;
      const user = sender ? sender.name : 'ผู้ชม (ยังไม่ติดตาม)';
      const msg = { type: 'gift', user, uniqueId: sender ? sender.uid : 'guest', giftName: `ทดสอบ ${RACE_CAT[val].name}`, count: 1, diamonds: dm, category: val, repeat: 1, target: 0 };
      if (S.live.server) fetch('/test?' + new URLSearchParams({ user, uid: msg.uniqueId, gift: msg.giftName, diamonds: dm, category: val }).toString()).catch(() => {});
      else onLiveMessage(msg);
      break;
    }
    case 'rbig': {
      const sender = pick(S.rivals.filter(r => r.follower));
      if (!sender) { toast('⚠️ ยังไม่มีผู้ติดตาม — กด ➕ จำลองคนกดติดตามก่อน', '#ffccbc'); break; }
      if (S.live.server) fetch('/test?' + new URLSearchParams({ user: sender.name, uid: sender.uid, gift: 'Galaxy', diamonds: 1000, category: 'self' }).toString()).catch(() => {});
      else onLiveMessage({ type: 'gift', user: sender.name, uniqueId: sender.uid, giftName: 'Galaxy', count: 1, diamonds: 1000, category: 'self' });
      break;
    }
    case 'rend': if (MODE === 'race' && !RACE.finishing) finishStage(); break;
    case 'rtype':
      if (val !== RTYPE && RACE_TYPES[val]) soon(`แบบการแข่ง: ${RACE_TYPES[val].icon} ${RACE_TYPES[val].name} (เริ่มรอบใหม่)`, () => { setRaceType(val); renderAdmin(); });
      break;
    case 'rlike': {   // ทดสอบ: ผู้ติดตามสุ่ม 1 คน เคาะจอรัว 20 ครั้ง
      const f = pick(S.rivals.filter(r => r.follower));
      if (!f) { toast('⚠️ ยังไม่มีผู้ติดตาม — กด ➕ จำลองคนกดติดตาม ก่อน', '#ffccbc'); break; }
      if (S.live.server) fetch('/test/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'like', uniqueId: f.uid, count: 20 }) }).catch(() => {});
      else onLiveMessage({ type: 'like', uniqueId: f.uid, nickname: f.name, count: 20 });
      break;
    }
    case 'rjoin': {   // ทดสอบ: คนที่ติดตามอยู่แล้วเข้าห้อง → เข้าร่วมแข่งทันที
      const nick = pick(['แฟนเก่า', 'ขาประจำ', 'พี่หมี', 'น้องแพร', 'Ton_99', 'ลุงปั่น']) + Math.floor(Math.random() * 100);
      if (S.live.server) fetch('/race/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nick, already: true }) }).catch(() => {});
      else onLiveMessage({ type: 'follow', uniqueId: 'local_' + Date.now(), nickname: nick, avatar: '', already: true });
      break;
    }
    case 'camstyle':
      if (CAM_STYLES[val]) soon(`สไตล์กล้อง: ${CAM_STYLES[val].icon} ${CAM_STYLES[val].name}`, () => {
        CAMSTYLE = val;
        try { localStorage.setItem('mtb.camstyle', val); } catch (e) { /* ignore */ }
        CAM.dur = Math.min(CAM.dur, CAM.shotT + camDur());
      });
      break;
    case 'bgtone': setBgTone(parseFloat(val)); break;
    case 'rspd': setRaceSpeed(parseFloat(val)); break;
    case 'reloadgame':   // 🔄 รีโหลดหน้าเกม (ใช้ไฟล์ใหม่ล่าสุด) — รอ 1.5 วิ ให้ข้อความขึ้นก่อน
      toast('⏳ รีโหลดหน้าเกม (ใช้ไฟล์ใหม่ล่าสุด)', '#e1f5fe');
      setTimeout(() => location.reload(), 1500);   // ใช้ตัวจับเวลาธรรมดา: ทำงานแม้หน้าต่างถูกย่อ (เกมหยุดวาด)
      break;
    case 'flist':
      FOLLOWS.on = !FOLLOWS.on;
      try { localStorage.setItem('mtb.flist', FOLLOWS.on ? '1' : '0'); } catch (e) { /* ignore */ }
      if (FOLLOWS.on) loadRecentFollows();
      toast(`📋 ผู้ติดตามล่าสุด 10 ชื่อบนจอ: ${FOLLOWS.on ? 'แสดง' : 'ซ่อน'}`, '#e1f5fe');
      break;
    case 'rclear': if (S.live.server) fetch('/race/clear', { method: 'POST' }).catch(() => {}); else onLiveMessage({ type: 'roster' }); break;
    // ---- เลือกได้หลายอย่าง + หน่วงเวลาก่อนมีผล (เนียน ไม่กระตุก)
    case 'scene': {
      // 🎲 = ล้างที่เลือก สุ่มทุกฉาก · กดฉาก = เพิ่ม/เอาออก · เลือกหลายฉาก = สลับเฉพาะที่เลือกทุก 5 นาที
      const cur = sceneChanges[sceneChanges.length - 1].id;
      const added = togglePick(kind, val);
      const id = val === 'random' ? other(SCENE_IDS, cur) : added ? val : (PICK.scene.size && !PICK.scene.has(cur) ? pickOne('scene', cur) : null);
      if (id && id !== cur) soon(`ฉากถัดไป ${SCENES[id].icon} ${SCENES[id].name} (โผล่จากขอบฟ้า)`, () => sceneSoon(id));
      break;
    }
    case 'weather': {
      const added = togglePick(kind, val);
      const id = val === 'random' ? other(Object.keys(WEATHERS), S.wCur) : added ? val : (PICK.weather.size && !PICK.weather.has(S.wCur) ? pickOne('weather', S.wCur) : null);
      if (id && id !== S.wCur) soon(`อากาศเปลี่ยนเป็น ${WEATHERS[id].icon} ${WEATHERS[id].name} (ค่อยๆ เปลี่ยน)`, () => setWeather(id));
      break;
    }
    case 'diff': {
      const added = togglePick(kind, val);
      const v = val === 'random' ? other([0, 1, 2, 3], S.diff) : added ? parseInt(val, 10) : (PICK.diff.size && !PICK.diff.has(String(S.diff)) ? parseInt(pickOne('diff', S.diff), 10) : null);
      if (v !== null && v !== S.diff) soon(`ความยาก → ${DIFFS[v].name} (ทางข้างหน้าเปลี่ยนตาม)`, () => { setDiff(v); resetTrackAhead(); });
      break;
    }
    case 'track':
      soon(`เส้นทาง → ${TRACK_MODES[val]} (เริ่มจากขอบฟ้า)`, () => { TRACK_MODE = val; resetTrackAhead(); }); break;
    case 'terrain': case 'surface': case 'lanes':
      togglePick(kind, val);
      soon('ปรับเส้นทางข้างหน้า (เริ่มจากขอบฟ้า)', () => resetTrackAhead()); break;
    case 'topkind':
      togglePick(kind, val);
      TOP_LOCK = PICK.topkind.size === 1 ? [...PICK.topkind][0] : null;
      if (CAM.shot === 'top' || CAM.mode === 'top') soon('เปลี่ยนแบบมุมสูง', () => cutShot('top')); break;
    case 'pack': soon(`นักปั่นกลุ่มใหญ่ ${val} คน`, () => { PACK_N = parseInt(val, 10) || 0; initPack(); }); break;
    case 'hour0': setTimeMode('real'); toast('⏳ เวลาค่อยๆ กลับเป็นเวลาจริง', '#e1f5fe'); break;
    case 'tmode':
      if (TIME_MODES[val]) soon(`${TIME_MODES[val].icon} ${TIME_MODES[val].name}${val === 'real' ? '' : ` (${TIME_MODES[val].hour}:00 ค้างไว้)`} — ฟ้าค่อยๆ เปลี่ยน`, () => setTimeMode(val));
      break;
    case 'reset': soon('เริ่มเกมใหม่ — ทุกคนกลับเส้นสตาร์ต', restartGame); break;
    case 'cohesion':
      soon(`จับกลุ่ม: ${COHESION[val].name}`, () => {
        COH = val;
        try { localStorage.setItem('mtb.cohesion', val); } catch (e) { /* ignore */ }
      });
      break;
    case 'sharp':
      SHARP = parseFloat(val) || 1;
      try { localStorage.setItem('mtb.sharp', String(val)); } catch (e) { /* ignore */ }
      resize();
      toast(`🔍 ความคมภาพ: ${SHARP_LEVELS[val] || val} (${val}x)`, '#e1f5fe');
      break;
    case 'regroup':
      if (S.regroup) { toast('🧲 กำลังรวมกลุ่มอยู่แล้ว', '#e1f5fe'); break; }
      soon('รวมกลุ่ม: ผู้นำชะลอ ผู้ตามท้ายเร่ง', regroupStart); break;
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
    case 'cam': {
      // 🎲 ถ่ายทอดสด = ล้างที่เลือก · กดมุม = เพิ่ม/เอาออก · หลายมุม = ผู้กำกับสลับเฉพาะมุมที่เลือก
      togglePick('cam', val === 'broadcast' ? 'random' : val);
      const a = [...PICK.cam];
      soon(a.length === 0 ? 'กล้อง: ถ่ายทอดสด สลับทุกมุม' : a.length === 1 ? `กล้อง: ${CAM_NAMES[a[0]]}` : `กล้อง: สลับ ${a.length} มุมที่เลือก`, () => {
        if (a.length === 1) setCamMode(a[0]);
        else { setCamMode('broadcast'); if (a.length > 1) directorCut(); }
      });
      break;
    }
    case 'sfxvol': setSfxVol((parseFloat(val) || 0) / 100); break;
    case 'envvol': setEnvVol((parseFloat(val) || 0) / 100); break;
    case 'hour': hourShift(parseFloat(val)); toast(`⏳ เวลา ${parseFloat(val) > 0 ? '+' : ''}${val} ชม. (ฟ้าค่อยๆ เปลี่ยน)`, '#e1f5fe'); break;
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
  if (PANEL) {   // หน้า /admin: ค่าที่เพิ่งกด (เดาไว้) ก่อน แล้วค่อยใช้สถานะที่หน้าเกมส่งมา
    const k = kind + '|' + val, p = REMOTE.pend.get(k);
    if (p && performance.now() < p.until) return p.on;
    return REMOTE.on.has(k);
  }
  switch (kind) {
    case 'action': return ADMIN.last === val;
    case 'cheat': return ADMIN.last === 'cheat';
    case 'mode': return MODE === val;
    case 'scene': case 'weather': case 'diff': case 'terrain': case 'surface': case 'lanes': case 'topkind':
      return val === 'random' ? PICK[kind].size === 0 : PICK[kind].has(String(val));
    case 'track': return TRACK_MODE === val;
    case 'tkconnect': return !!S.live.username && S.live.status !== 'off';
    case 'regroup': return !!S.regroup;
    case 'cohesion': return COH === val;
    case 'sharp': return SHARP === parseFloat(val);
    case 'rtype': return RTYPE === val;
    case 'flist': return FOLLOWS.on;
    case 'camstyle': return CAMSTYLE === val;
    case 'pack': return PACK_N === parseInt(val, 10);
    case 'hour0': return !TIME_LOCK && !S.hourOff && S.hourGoal === null;
    case 'tmode': return val === 'real' ? !TIME_LOCK : TIME_LOCK === val;
    case 'space': return SPACE_ON;
    case 'cam': return val === 'broadcast' ? PICK.cam.size === 0 : PICK.cam.has(val);
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
  <div id="admNote" class="note"></div>
  <div class="grid one">${btn('reloadgame', '', '🔄 รีโหลดหน้าเกมทุกจอ (หลังอัปเดตไฟล์เกม)')}</div>
  <div id="admStatus" class="stat"></div>

  <h4>🏁 โหมดเกม</h4>
  <div class="grid">${btn('mode', 'race', '🏁 แข่งผู้ติดตาม')}${btn('mode', 'sim', '🎮 จำลองการเล่น')}</div>
  <div class="grid one">${btn('reset', '', '🔄 เริ่มเกมใหม่ (ทุกคนกลับเส้นสตาร์ต · นับเวลาด่านใหม่)')}</div>
  <div class="grid one">${btn('monitor', '', '📈 ดูประสิทธิภาพเครื่อง (CPU · RAM · GPU · เน็ต · อุณหภูมิ · FPS เกม) — เปิดหน้าใหม่')}</div>
  <div class="grid one">${btn('eventlog', '', '📜 Log เหตุการณ์ TikTok ทุกชนิด (แชท ของขวัญ ไลก์ เข้าห้อง ติดตาม PK ฯลฯ) — เปิดหน้าใหม่')}</div>
  <div class="grid">${btn('followers', '', '👥 ดูรายชื่อผู้ติดตามล่าสุด (หน้าใหม่)')}${btn('flist', '', '📋 แสดงผู้ติดตามล่าสุด 10 ชื่อบนจอ')}</div>
  <div class="vol">🏎️ ความเร็วการแข่ง <input type="range" class="rSpd" min="0" max="100" step="5" value="${RSPD.goal}"> <b class="rSpdTxt">${rspdLabel(RSPD.goal)}</b></div>
  <div class="row" style="opacity:.75">ใช้กับทุกคนในสนาม · ค่อยๆ เร่ง/ชะลอ ราว 2 วิ · 75% = ปกติ (ค่าเริ่มต้น) · 100% = เร็วขึ้น · 0% = หยุดทั้งสนาม</div>
  <div class="row">🔍 ความคมภาพ (ภาพไลฟ์เบลอ → เพิ่ม · เครื่องกระตุก → ลด):</div>
  <div class="grid">${['1', '1.5', '2', '2.5'].map(k => btn('sharp', k, `${SHARP_LEVELS[k]} ${k}x`)).join('')}</div>
  ${MODE === 'race' ? `
  <div class="row">แบบการแข่ง (เปลี่ยนแล้วเริ่มรอบใหม่):</div>
  <div class="grid">${Object.entries(RACE_TYPES).map(([k, t]) => btn('rtype', k, `${t.icon} ${t.name}`)).join('')}</div>
  <div class="row" style="opacity:.75">${Object.values(RACE_TYPES).map(t => `${t.icon} <b>${t.name}</b>: ${t.tip}`).join('<br>')}</div>
  <div class="row">ทดสอบโหมดแข่ง (ไม่ต้องไลฟ์):</div>
  <div class="grid">${btn('rfollow', '', '➕ จำลองคนกดติดตาม')}${btn('rjoin', '', '👋 คนติดตามอยู่แล้วเข้าห้อง')}${btn('rlike', '', '❤️ ผู้ติดตามเคาะจอรัว 20 ครั้ง')}${Object.entries(RACE_CAT).map(([k, c]) => btn('rgift', k, `${c.icon} ของขวัญ${c.name}`)).join('')}${btn('rbig', '', '🌌 ผู้ติดตามส่ง 1000💎')}${btn('rend', '', '⏭️ จบด่านทันที')}${btn('rclear', '', '🧹 ล้างผู้ติดตาม')}</div>
  <table>
    <tr><td>กดติดตาม</td><td>ได้นักปั่นของตัวเอง ชื่อ + รูปโปรไฟล์บนหัว (สูงสุด ${RACE.maxRiders} คน รวมคนสร้างและบอท 4)</td></tr>
    <tr><td>ของขวัญ</td><td>ผู้ส่งพุ่งนำตามราคา (1.5 ม./💎 สำหรับช่วยตัวเอง) + ผลตามประเภท · แก้ได้ที่ "raceGifts" ใน config.json</td></tr>
    ${(RACE.tiers && RACE.tiers.length ? RACE.tiers : DEFAULT_RACE_TIERS).slice().sort((a, b) => a.min - b.min).map(t => `<tr><td>💎 ${t.min}+</td><td>${RACE_CAT[t.cat] ? RACE_CAT[t.cat].icon + ' ' + RACE_CAT[t.cat].name + ' — ' + RACE_CAT[t.cat].tip : adminEsc(t.cat)}</td></tr>`).join('')}
    <tr><td>รอบ</td><td>${Math.round((RACE.stage ? RACE.stage.durationMs : 1800000) / 60000)} นาที · 40 วิสุดท้ายมีเส้นชัย ใครข้ามก่อนได้อันดับก่อน · สรุป 1-2-3 แล้วล้างอันดับเริ่มรอบใหม่ (บันทึกทุกรอบ) · แก้ "stageMinutes" ใน config.json</td></tr>
    <tr><td>เคาะจอ</td><td>Survival / ทีมชาติ: ทุกไลก์ได้แรงเพิ่ม · ครบ ${LIKE_LEAD} ครั้ง = ลุ้นขึ้นนำ ${Math.round(LIKE_LEAD_CHANCE * 100)}%</td></tr>
  </table>
  <div class="row">📊 สถิติรอบที่ผ่านมา:</div>
  <div id="admHist" class="stat">กำลังโหลด...</div>` : ''}

  <h4>📱 ปุ่มบนจอเกม</h4>
  <table>
    <tr><td>🎁</td><td>เปิดแผงของขวัญ: เลือกนักปั่น 1-6 แล้วกดของขวัญเพื่อส่งเอง (ทดสอบเหมือนผู้ชมส่ง)</td></tr>
    <tr><td>📷</td><td>เปลี่ยนโหมดกล้อง (วนตามลำดับ) — โหมด "ถ่ายทอดสด" จะสุ่มสลับมุมเอง</td></tr>
    <tr><td>🎵 / 🗣️</td><td>(ในแผงของขวัญ) เปิด-ปิดเพลงประกอบ / เสียงพูดของบอท</td></tr>
    <tr><td>แตะจอ</td><td>เปิดเสียง (เบราว์เซอร์ต้องให้แตะก่อน 1 ครั้ง) / เล่นต่อเมื่อหยุดไว้</td></tr>
    <tr><td>ℹ️</td><td>เปิดแผงนี้เป็นหน้าใหม่ (http://localhost:3000/admin) สั่งเกมได้ทุกหน้า รวมถึงลิงก์ใน LIVE Studio</td></tr>
  </table>

  <h4>🎮 สั่งทดสอบ</h4>
  <div class="row">ให้ท่ากับ: <select id="admTarget">${CHAR_NAMES.map((n, i) => `<option value="${i}">${i + 1}. ${adminEsc(n)}</option>`).join('')}</select></div>
  <div class="grid">${Object.entries(ACTIONS).map(([k, a]) => btn('action', k, `${a.icon} ${a.name}`)).join('')}${btn('cheat', '', '😈 บอทโกงทันที')}</div>
  <div class="grid">${btn('regroup', '', '🧲 รวมกลุ่ม (ผู้นำชะลอ · ผู้ตามท้ายเร่งมาจับกลุ่ม)')}</div>
  <div class="row">🫂 จับกลุ่มอัตโนมัติ (ไม่ให้ทิ้งห่างกันมาก):</div>
  <div class="grid">${Object.entries(COHESION).map(([k, c]) => btn('cohesion', k, c.name)).join('')}</div>
  <div class="row" style="opacity:.75">☑️ หมวดที่มี 🎲 เลือกได้หลายอย่าง: กดเพื่อเพิ่ม/เอาออก · เลือก 1 = ล็อก · หลายอย่าง = สุ่มสลับเฉพาะที่เลือก · 🎲 = ล้าง สุ่มทั้งหมด · ทุกคำสั่งหน่วง ${CMD_DELAY} วิ แล้วค่อยๆ เปลี่ยน</div>
  <div class="row">เส้นทาง:</div>
  <div class="grid">${Object.entries(TRACK_MODES).map(([k, n]) => btn('track', k, n)).join('')}</div>
  <div class="row">ระดับทาง ☑️ (เลือกได้หลายแบบ):</div>
  <div class="grid">${rnd('terrain')}${Object.entries(TERRAINS).map(([k, t]) => btn('terrain', k, `${t.icon} ${t.name}`)).join('')}</div>
  <div class="row">พื้นผิว ☑️:</div>
  <div class="grid">${rnd('surface')}${Object.entries(SURFACES).map(([k, t]) => btn('surface', k, k === 'normal' ? '🛣️ ปกติ' : `${t.icon} ${t.name}`)).join('')}</div>
  <div class="row">จำนวนเลน ☑️:</div>
  <div class="grid">${rnd('lanes')}${Object.entries(WIDTHS).map(([k, t]) => btn('lanes', k, t.name)).join('')}</div>
  <div class="row">ฉาก ☑️ (หลายฉาก = สลับเฉพาะที่เลือกทุก 5 นาที):</div>
  <div class="grid">${rnd('scene')}${SCENE_IDS.map(id => btn('scene', id, `${SCENES[id].icon} ${SCENES[id].name}`)).join('')}</div>
  <div class="row">อากาศ ☑️:</div>
  <div class="grid">${rnd('weather')}${Object.entries(WEATHERS).map(([id, w]) => btn('weather', id, `${w.icon} ${w.name}`)).join('')}</div>
  <div class="row">ความยาก ☑️:</div>
  <div class="grid">${rnd('diff')}${DIFFS.map((d, i) => btn('diff', i, d.name)).join('')}</div>
  <div class="row">มุมกล้อง ☑️ (หลายมุม = สลับเฉพาะมุมที่เลือก):</div>
  <div class="grid">${CAM_MODES.map(m => m === 'broadcast' ? `<button data-k="cam" data-v="broadcast" class="rnd">🎲 สุ่มอัตโนมัติ (ถ่ายทอดสด)</button>` : btn('cam', m, CAM_NAMES[m])).join('')}</div>
  <div class="row">🎬 สไตล์กล้อง (ความถี่การตัดสลับมุม):</div>
  <div class="grid">${Object.entries(CAM_STYLES).map(([k, c]) => btn('camstyle', k, `${c.icon} ${c.name}`)).join('')}</div>
  <div class="row">แบบมุมสูง (Top view) ☑️:</div>
  <div class="grid">${rnd('topkind')}${Object.entries(TOP_KINDS).map(([k, n]) => btn('topkind', k, '🚁 ' + n)).join('')}</div>
  <div class="row">นักปั่นกลุ่มใหญ่ (เพิ่มจาก 6 คนหลัก):</div>
  <div class="grid">${[0, 6, 12, 20, 30].map(n => btn('pack', n, n ? `👥 ${n} คน` : '👤 ไม่มี')).join('')}</div>
  <div class="row">🌗 ช่วงเวลา (ฟ้าค่อยๆ เปลี่ยน · กลางวัน/กลางคืน = ค้างไว้ตลอด):</div>
  <div class="grid">${Object.entries(TIME_MODES).map(([k, t]) => btn('tmode', k, `${t.icon} ${t.name}${t.hour !== undefined ? ` (${t.hour}:00)` : ''}`)).join('')}</div>
  <div class="grid">${btn('hour', -1, '🕐 เวลา -1 ชม.')}${btn('hour', 1, '🕐 เวลา +1 ชม.')}${btn('space', '', '🚀 สุ่มด่านอวกาศ')}${btn('pause', '', '⏸ หยุด/เล่น')}${btn('music', '', '🎵 เพลง')}${btn('voice', '', '🗣️ เสียงพูด')}${btn('gifts', '', '🎁 แผงของขวัญ')}</div>
  <div class="vol">🔊 เสียงเอฟเฟกต์ <input type="range" class="sfxVol" min="0" max="100" step="5" value="${Math.round(SFX_VOL * 100)}"> <b class="sfxVolTxt">${SFX_VOL > 0 ? Math.round(SFX_VOL * 100) + '%' : 'ปิด'}</b></div>
  <div class="vol">🌧️ เสียงฝน/ลม <input type="range" class="envVol" min="0" max="100" step="5" value="${Math.round(ENV_VOL * 100)}"> <b class="envVolTxt">${ENV_VOL > 0 ? Math.round(ENV_VOL * 100) + '%' : 'ปิด'}</b></div>
  <div class="vol">🎨 สีฉากพื้นหลัง (จาง ↔ เข้ม) <input type="range" class="bgTone" min="0" max="100" step="5" value="${BGTONE}"> <b class="bgToneTxt">${toneLabel(BGTONE)}</b></div>
  <div class="row" style="opacity:.75">ปรับเฉพาะฉาก/ถนน/ของข้างทาง · สีนักปั่นไม่เปลี่ยน — ฉากจางลง = นักปั่นเด่นขึ้น ไม่กลืนกับพื้นหลัง</div>

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
    if (b.dataset.k === 'close') { if (PANEL) window.close(); } else adminAct(b.dataset.k, b.dataset.v);
  }));
  ADMIN.statusEl = el.querySelector('#admStatus');
  updateAdminStatus(true);
  refreshAdminButtons();
  loadHistory();
}
// 📊 สถิติทุกรอบจากฐานข้อมูล (อันดับ 1-3 ของ 8 รอบล่าสุด)
function loadHistory() {
  const box = ADMIN.el && ADMIN.el.querySelector('#admHist');
  if (!box || typeof fetch !== 'function') return;
  fetch('/race/history?limit=8').then(r => r.json()).then(d => {
    if (!d.ok) { box.textContent = 'ยังไม่ได้เชื่อมฐานข้อมูล (เปิด MySQL ใน XAMPP)'; return; }
    if (!d.stages.length) { box.textContent = 'ยังไม่มีรอบที่แข่งจบ'; return; }
    const TN = { classic: '🏁', survival: '🔥', nation: '🌏' };
    box.innerHTML = d.stages.map(s => `<div><b>รอบ ${s.no}</b> ${TN[s.type] || ''} · ${s.riders} คน · ${adminEsc(String(s.at || '').slice(5, 16))}<br><small>${s.top3.map(adminEsc).join(' · ')}</small></div>`).join('<hr style="border:0;border-top:1px solid rgba(255,255,255,.1)">');
  }).catch(() => { box.textContent = 'โหลดสถิติไม่ได้'; });
}
function updateAdminStatus(force) {
  // หน้าแผงแยก: สถานะมาจากหน้าเกม · หน้าเกม: คำนวณลงแผงที่ซ่อนไว้แล้วส่งให้หน้า /admin
  if (PANEL || !ADMIN.statusEl) return;
  postAdminState(force);
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
    `${MODE === 'race' ? `🏁 โหมดแข่ง · ด่าน ${RACE.stage ? RACE.stage.no : '-'} เหลือ ${fmtMS(Math.max(0, stageLeftMs() || 0))} · ` : '🎮 โหมดจำลอง · '}อันดับ ${S.rank}/${S.rivals.length + 1} · ${(S.speed * KMH).toFixed(0)} km/h · ${((S.position + PLAYER_Z) / SEG_L * M_PER_SEG / 1000).toFixed(2)} km`,
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
  let wt = performance.now();
  drawSky(env);
  const ps = playerScene();
  ctx.fillStyle = rgb(mix(ps.scene.grass[0], env.fog, 0.6));
  ctx.fillRect(-500, HORIZON, W + 1000, H - HORIZON + 600);
  drawBackground(env);
  wt = pmark('w:sky+bg', wt);

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
  wt = pmark('w:project', wt);
  // ถนนไกลๆ ที่บางไม่ถึง 1 พิกเซล: รวมหลายช่วงเป็นแถบเดียว (ภาพเหมือนเดิม แต่วาดน้อยลงหลายเท่า)
  for (let n = 0; n < SEGS.length; n++) {
    const s = SEGS[n];
    if (!s.vis) continue;
    if (s.p1.y - s.p2.y >= 0.9) { drawSegment(s, env); continue; }
    let last = s, m = n + 1;
    while (m < SEGS.length && SEGS[m].vis && s.p1.y - SEGS[m].p2.y < 1.4) { last = SEGS[m]; m++; }
    if (last === s) { drawSegment(s, env); continue; }
    const keep = s.p2; s.p2 = last.p2; drawSegment(s, env); s.p2 = keep;
    n = m - 1;
  }
  wt = pmark('w:road', wt);

  // จัดกลุ่มสิ่งของ / นักปั่น ตาม segment
  const bySeg = new Map();
  const add = (z, e) => { const i = Math.floor(z / SEG_L); e.pct = (z % SEG_L) / SEG_L; let a = bySeg.get(i); if (!a) bySeg.set(i, a = []); a.push(e); };
  const ahead = (z, m) => rev ? camZ - z > m : z - camZ > m;
  for (const o of S.objects) if (!o.taken && ahead(o.z, 0)) add(o.z, { o });
  for (const r of S.rivals) if (r !== CAM.povOf && ahead(r.z, 260)) add(r.z, { r });
  if (!SP.on) for (const r of S.pack) if (ahead(r.z, 260)) add(r.z, { r });
  if (CAM.povOf !== 'player' && CAM.shot !== 'rearcam' && ahead(PLAYER_SPRITE.z, 260)) add(PLAYER_SPRITE.z, { r: PLAYER_SPRITE });
  for (const p of S.projectiles) if (ahead(p.z, 200)) add(p.z, { p });
  if (MODE === 'race' && RACE.finishZ && ahead(RACE.finishZ, 100)) add(RACE.finishZ, { fin: true });

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
    if (k * 2400 > 1.2) for (const d of s.decos) {   // เล็กกว่า ~1 พิกเซล: ไม่ต้องวาด
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
        } else if (e.fin) RIDER_Q.push({ fin: true, s, t, k: pk, clip: needClip ? clipY : null, a: ctx.globalAlpha });
        else RIDER_Q.push({ x: px + pw * e.r.x * MIR, y: py, k: pk, r: e.r, clip: needClip ? clipY : null, a: ctx.globalAlpha });   // วาดทีหลัง (ไม่โดนปรับสีฉาก)
      }
    }
    ctx.globalAlpha = 1;
    if (needClip) ctx.restore();
  }
  wt = pmark('w:deco', wt);
  // ปรับสีฉากพื้นหลัง (จาง ↔ เข้ม) — ทับเฉพาะฉาก/ถนน/ของข้างทาง แล้วค่อยวาดนักปั่นทับ สีนักปั่นไม่เปลี่ยน
  drawBgTone(env);
  for (const q of RIDER_Q) {
    if (q.clip !== null) { ctx.save(); ctx.beginPath(); ctx.rect(-500, -600, W + 1000, q.clip + 600); ctx.clip(); }
    ctx.globalAlpha = q.a;
    if (q.fin) drawFinishLine(q.s, q.t, q.k); else drawRider(q.x, q.y, q.k, q.r);
    ctx.globalAlpha = 1;
    if (q.clip !== null) ctx.restore();
  }
  RIDER_Q.length = 0;
  pmark('w:riders', wt);
  ctx.restore();
  MIR = 1;
}
const RIDER_Q = [];
// ---- 🎨 สีฉากพื้นหลัง 0-100 (50 = ปกติ) · ต่ำ = จางลง (ฉากซีด นักปั่นเด่น) · สูง = เข้มลึกขึ้น
let BGTONE = 50;
try { const v = parseInt(localStorage.getItem('mtb.bgtone'), 10); if (v >= 0 && v <= 100) BGTONE = v; } catch (e) { /* ignore */ }
function setBgTone(v) {
  BGTONE = clamp(Math.round(v), 0, 100);
  try { localStorage.setItem('mtb.bgtone', String(BGTONE)); } catch (e) { /* ignore */ }
  toneUI(BGTONE);
}
function toneLabel(v) { return v === 50 ? 'ปกติ' : v < 50 ? `จาง ${Math.round((50 - v) * 2)}%` : `เข้ม ${Math.round((v - 50) * 2)}%`; }
function toneUI(v) {
  document.querySelectorAll('.bgTone').forEach(el => { if (document.activeElement !== el) el.value = v; });
  document.querySelectorAll('.bgToneTxt').forEach(el => { el.textContent = toneLabel(v); });
}
function drawBgTone(env) {
  if (BGTONE === 50) return;
  ctx.save();
  if (BGTONE < 50) {
    const f = (50 - BGTONE) / 50, c = mix(env.fog || [200, 210, 220], [240, 242, 246], 0.6);
    ctx.fillStyle = rgb(c, f * 0.62);
  } else {
    const f = (BGTONE - 50) / 50, g = Math.round(255 - 120 * f);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${g},${g},${Math.min(255, g + 10)})`;
  }
  ctx.fillRect(-500, -600, W + 1000, H + 1200);
  ctx.restore();
}
// ---- 🏁 เส้นชัย: ซุ้มคร่อมถนน + พื้นตารางหมากรุก
function drawFinishLine(s, t, k) {
  const x = lerp(s.p1.x, s.p2.x, t), y = lerp(s.p1.y, s.p2.y, t), w = lerp(s.p1.w, s.p2.w, t);
  if (w < 3) return;
  const n = 12, cw = w * 2 / n, ch = Math.max(2, 90 * k);
  for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
    ctx.fillRect(x - w + i * cw, y - ch * (j + 1) / 2 + ch / 2, cw + 0.5, ch / 2 + 0.5);
  }
  const ph = 1700 * k, bh = 300 * k;
  for (const sd of [-1, 1]) { ctx.fillStyle = '#e53935'; ctx.fillRect(x + sd * w * 1.12 - 30 * k, y - ph, 60 * k, ph); }
  rr(x - w * 1.15, y - ph - bh * 0.2, w * 2.3, bh, Math.max(1, 30 * k), '#e53935', '#fff', Math.max(1, 8 * k));
  if (bh > 8) textC('🏁 FINISH เส้นชัย 🏁', x, y - ph + bh * 0.3, '#fff', Math.max(6, bh * 0.5), 800);
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
    ctx.beginPath();   // หิมะทุกเม็ดรวมเป็นภาพเดียว วาดครั้งเดียว
    for (let i = 0; i < n; i++) { const f = S.flakes[i]; ctx.moveTo(f.x + f.r, f.y); ctx.arc(f.x, f.y, f.r, 0, 6.283); }
    ctx.fill();
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
const GLOW = {};
function glowSprite(c) {
  if (GLOW[c]) return GLOW[c];
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const g2 = s.getContext('2d'), g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(1, `rgba(${c},0)`);
  g2.fillStyle = g; g2.fillRect(0, 0, 64, 64);
  return (GLOW[c] = s);
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
    // แสงไฟกลางคืน: ใช้ภาพแสงที่วาดไว้แล้ว (ไม่สร้าง gradient ใหม่ทุกดวงทุกเฟรม) · เอาเฉพาะ 28 ดวงที่ใหญ่สุด
    const list = LIGHTS.length > 28 ? LIGHTS.slice().sort((a, b) => b.r - a.r).slice(0, 28) : LIGHTS;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(0.5 * env.dark, 0, 1);
    for (const L of list) {
      if (L.r < 2) continue;
      const lx = L.x + (CAM.pan || 0);   // ไฟถูกเก็บก่อนแพนกล้อง
      if (lx + L.r < 0 || lx - L.r > W || L.y + L.r < 0 || L.y - L.r > H) continue;
      ctx.drawImage(glowSprite(L.c), lx - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.globalAlpha = 1;
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
// หาขนาดตัวอักษรที่พอดีความกว้าง — จำผลไว้ (เดิมวัดตัวอักษรซ้ำหลายรอบทุกเฟรม กินเวลา)
const FIT_CACHE = new Map();
function fitFont(str, maxW, size, min, weight) {
  TOP_TEXT_W = Math.max(200, W - 2 * TOP_TEXT_W_PAD);
  const key = `${str}|${maxW | 0}|${size}|${min}|${weight}`;
  let fs = FIT_CACHE.get(key);
  if (fs === undefined) {
    fs = size;
    font(fs, weight);
    while (fs > min && ctx.measureText(str).width > maxW) { fs--; font(fs, weight); }
    if (FIT_CACHE.size > 600) FIT_CACHE.clear();
    FIT_CACHE.set(key, fs);
  }
  font(fs, weight);
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
      textC(ahead ? '▲' : '▼', x0 + 10 + (r.idx % 9) * 11, ahead ? y0 + 9 : y0 + size - 9, r.jersey, 9, 800);
    }
  }
  // ผู้เล่น
  poly([cx, cy - 7, cx - 5, cy + 5, cx + 5, cy + 5], '#fff');
  poly([cx, cy - 4.5, cx - 3, cy + 3, cx + 3, cy + 3], '#ff7043');
  ctx.restore();
  textC('MAP', x0 + size - 16, y0 + size - 9, 'rgba(255,255,255,0.6)', 9, 700);
}
// โหมดทีมชาติ: อันดับทีม (ธง + ชื่อ + จำนวนคน + ระยะห่างจากทีมนำ)
function drawTeamRank(x0, y0) {
  const ts = teamStandings().slice(0, 8), w = RANK_W, rowH = 20, head = 20;
  rr(x0, y0, w, head + ts.length * rowH + 4, 10, 'rgba(0,0,0,0.16)', 'rgba(255,255,255,0.12)', 1);
  font(11, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd54f';
  ctx.fillText('🌏 อันดับทีมชาติ', x0 + 7, y0 + 11);
  ts.forEach((t, i) => {
    const y = y0 + head + i * rowH + rowH / 2;
    if (t.id === PLAYER_REF.team) rr(x0 + 3, y - rowH / 2 + 1, w - 6, rowH - 2, 6, 'rgba(255,112,67,0.25)');
    textC(String(i + 1), x0 + 10, y + 1, '#fff', 10, 800);
    drawFlag(t.id, x0 + 18, y - 6, 18, 12);
    font(11, 600); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    const nm = COUNTRIES[t.id].name;
    ctx.fillText(nm.length > 7 ? nm.slice(0, 6) + '…' : nm, x0 + 40, y + 1);
    ctx.textAlign = 'right'; font(9, 600); ctx.fillStyle = i ? '#ff8a80' : '#b9f6ca';
    ctx.fillText(i ? `-${((ts[0].z - t.z) / U_PER_M).toFixed(0)}ม.` : `${t.n} คน`, x0 + w - 6, y + 1);
  });
  return y0 + head + ts.length * rowH + 4;
}
function drawRankList(x0, y0) {
  if (MODE === 'race' && RTYPE === 'nation') return drawTeamRank(x0, y0);
  const pz = S.position + PLAYER_Z;
  const full = S.order || [{ me: true, z: pz }, ...S.rivals].sort((a, b) => b.z - a.z);
  // คนเยอะ: แสดง 7 อันดับแรก + แถวของคนสร้าง (ถ้าหลุด)
  const MAXR = 8;
  let rows = full.map((o, i) => ({ o, i }));
  if (rows.length > MAXR) { const me = rows.find(e => e.o.me); rows = rows.slice(0, MAXR - 1); if (me.i >= MAXR - 1) rows.push(me); else rows.push(full.map((o, i) => ({ o, i }))[MAXR - 1]); }
  const w = RANK_W, rowH = 20, head = 20;
  rr(x0, y0, w, head + rows.length * rowH + 4, 10, 'rgba(0,0,0,0.16)', 'rgba(255,255,255,0.12)', 1);
  font(11, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd54f';
  ctx.fillText(`🏆 อันดับ ${S.rank}/${full.length}`, x0 + 7, y0 + 11);
  rows.forEach(({ o, i }, ri) => {
    const y = y0 + head + ri * rowH + rowH / 2;
    if (o.me) rr(x0 + 3, y - rowH / 2 + 1, w - 6, rowH - 2, 6, 'rgba(255,112,67,0.3)');
    ell(x0 + 12, y, 6.5, 6.5, o.me ? '#ff7043' : o.jersey);
    textC(String(i + 1), x0 + 12, y + 1, i === 0 ? '#000' : '#fff', 9, 800);
    font(11, 600); ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    let nm = (i === 0 ? '👑' : '') + (o.me ? playerName() : o.name);
    if (nm.length > 9) nm = nm.slice(0, 8) + '…';
    ctx.fillText(nm, x0 + 22, y + 1);
    const sup = MODE === 'race' ? (o.me ? 0 : o.diamonds || 0) : S.support[o.me ? 0 : o.char];
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
  return y0 + head + rows.length * rowH + 4;
}
// ภาพเล็กที่วาดไว้ล่วงหน้า (ป้ายชื่อ / หัวรูปโปรไฟล์) — วาดครั้งเดียวแล้วแปะซ้ำ เร็วกว่าวาดตัวหนังสือ/ตัดวงกลมทุกเฟรมมาก
const SPRITE_CACHE = new Map();
function cachedSprite(key, w, h, paint) {
  let c = SPRITE_CACHE.get(key);
  if (!c) {
    if (SPRITE_CACHE.size > 500) SPRITE_CACHE.clear();
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * RES)); c.height = Math.max(1, Math.ceil(h * RES));
    const main = ctx;
    ctx = c.getContext('2d');
    try { ctx.setTransform(RES, 0, 0, RES, 0, 0); paint(); } finally { ctx = main; }
    SPRITE_CACHE.set(key, c);
  }
  return c;
}
// หัวนักปั่น = รูปโปรไฟล์ TikTok (ผู้ติดตาม/คนสร้าง) วงกลมขอบสีเสื้อ · คืน false = วาดหัว/หมวกปกติ
function drawAvatarHead(x, cy, rad, r) {
  if (MODE !== 'race' || !(r.follower || r.me) || rad < 2) return false;
  const img = r.avatar ? giftImage(r.avatar) : null;
  if (!img && !r.follower) return false;
  const ready = img && img.complete && img.naturalWidth;
  const b = Math.max(6, Math.ceil(rad / 6) * 6);   // ขนาดเป็นขั้นๆ จะได้ใช้ภาพเดิมซ้ำ
  const ring = Math.max(1, b * 0.14), R = b + ring;
  const key = `av|${ready ? r.avatar : 'L' + r.name}|${r.jersey}|${b}|${RES}`;
  const c = cachedSprite(key, R * 2 + 2, R * 2 + 2, () => {
    ell(R + 1, R + 1, R, R, r.jersey || '#fff');
    drawAvatar(ready ? img : null, R + 1, R + 1, b, r.name, r.jersey || '#888');
  });
  const sc = rad / b, sz = (R * 2 + 2) * sc;
  ctx.drawImage(c, x - sz / 2, cy - sz / 2, sz, sz);
  return true;
}
// ป้ายชื่อบนหัว (+ ธงทีมชาติ) · รูปโปรไฟล์อยู่ที่หัวแล้ว ไม่ต้องซ้ำในป้าย
function drawNameTag(r, x, y, s) {
  if (!r.name || s * 700 <= 45) return;
  const fs = Math.round(clamp(s * 120, 11, 22));
  const name = r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name;
  const fl = r.team && COUNTRIES[r.team] ? Math.round(fs * 1.3) : 0;
  const key = `tag|${name}|${fs}|${r.follower ? 1 : 0}|${r.team || ''}|${RES}`;
  let c = SPRITE_CACHE.get(key);
  if (!c) {
    font(fs, 600);
    const tw = Math.ceil(ctx.measureText(name).width + 12 + (fl ? fl + 4 : 0));
    c = cachedSprite(key, tw, fs + 8, () => {
      rr(0, 0, tw, fs + 8, 6, r.follower ? 'rgba(233,30,99,0.6)' : 'rgba(0,0,0,0.55)');
      if (fl) drawFlag(r.team, 5, 4, fl, fs);
      textC(name, tw / 2 + (fl ? (fl + 4) / 2 : 0), (fs + 8) / 2, '#fff', fs, 600);
    });
  }
  const w = c.width / RES, h = c.height / RES;
  ctx.drawImage(c, x - w / 2, y - 828 * s - fs - 4, w, h);
}
function drawAvatar(img, cx, cy, rad, name, col) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.closePath();
  if (img && img.complete && img.naturalWidth) { ctx.clip(); ctx.drawImage(img, cx - rad, cy - rad, rad * 2, rad * 2); }
  else {
    // ยังไม่มีรูป: ตัวอักษรแรกของชื่อ (สีตัวอักษรตัดกับพื้น ไม่หายบนเสื้อสีขาว)
    ctx.fillStyle = col; ctx.fill();
    const m = /^#([0-9a-f]{6})$/i.exec(col || ''), lum = m ? (parseInt(m[1].slice(0, 2), 16) * 0.3 + parseInt(m[1].slice(2, 4), 16) * 0.59 + parseInt(m[1].slice(4, 6), 16) * 0.11) : 0;
    textC((Array.from(String(name || '').replace(/^[@👑]+/, ''))[0] || '').toUpperCase(), cx, cy + 1, lum > 170 ? '#222' : '#fff', rad * 1.1, 800);
  }
  ctx.restore();
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
  if (MODE === 'race') {
    const out = ['💖 กดติดตาม = ได้นักปั่นของตัวเองบนสนาม!', `👥 นักปั่นตอนนี้ ${S.rivals.length + 1} คน · ด่านละ ${Math.round((RACE.stage ? RACE.stage.durationMs : 1800000) / 60000)} นาที`];
    const tiers = (RACE.tiers && RACE.tiers.length ? RACE.tiers : DEFAULT_RACE_TIERS).slice().sort((a, b) => a.min - b.min);
    for (const t of tiers) if (RACE_CAT[t.cat]) out.push(`🎁 ${t.min}💎+ = ${RACE_CAT[t.cat].icon} ${RACE_CAT[t.cat].name} (${RACE_CAT[t.cat].tip})`);
    out.push('💎 ส่งของขวัญยิ่งแพง ยิ่งพุ่งนำไกล!');
    return out;
  }
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
// ----------------------------------------------- ป้ายของขวัญ (overlay เล็ก สีจาง มุมล่าง)
const GIFT_OV_Y = 852;
function giftList() {
  const l = S.giftList && S.giftList.length ? S.giftList : DEFAULT_GIFTS_UI;
  return l.map(g => ({ ...g, emoji: g.emoji || (DEFAULT_GIFTS_UI.find(x => x.name === g.name) || {}).emoji || '🎁' }));
}
function fetchGiftList() {
  if (typeof fetch !== 'function') return;
  fetch('/gifts').then(r => r.json()).then(d => { if (d.gifts && d.gifts.length) S.giftList = d.gifts; }).catch(() => {});
}
// เลือกของขวัญตัวอย่าง: โหมดแข่ง = ประเภทละ 2 ชิ้น (ถูกสุดก่อน), โหมดจำลอง = 10 ชิ้นแรก
function giftOverlayCols() {
  const list = giftList().slice().sort((a, b) => a.diamonds - b.diamonds);
  if (MODE !== 'race') {
    const cols = [];
    for (let i = 0; i < 5; i++) {
      const gs = list.filter((g, k) => k % 5 === i).slice(0, 2);
      const a = ACTIONS[gs[0] ? (S.liveCfg && S.liveCfg.giftActions && S.liveCfg.giftActions[gs[0].name]) || localGiftAction(gs[0]) : 'jump'] || ACTIONS.jump;
      cols.push({ head: `${a.icon} ${a.name}`, gifts: gs });
    }
    return cols;
  }
  const tiers = (RACE.tiers && RACE.tiers.length ? RACE.tiers : DEFAULT_RACE_TIERS).slice().sort((a, b) => a.min - b.min);
  return tiers.filter(t => RACE_CAT[t.cat]).map((t, i) => {
    const next = tiers[i + 1] ? tiers[i + 1].min : Infinity;
    const named = Object.entries(RACE.byName || {}).filter(([, c]) => c === t.cat).map(([n]) => n);
    let gs = list.filter(g => named.includes(g.name) || (g.diamonds >= t.min && g.diamonds < next && localCategory(g.name, g.diamonds) === t.cat));
    if (!gs.length) gs = [{ name: '', diamonds: t.min, emoji: '🎁' }];
    return { head: `${RACE_CAT[t.cat].icon} ${RACE_CAT[t.cat].name}`, gifts: gs.slice(0, 2) };
  });
}
// คอลัมน์ขวา: รูปของขวัญ + ข้อความสั้นๆ บอกผล (แสดงอย่างเดียว กดอะไรไม่ได้) สีจาง
const GIFT_SIDE_W = 118, GIFT_SIDE_Y = 304;
function drawGiftSide() {
  const cols = giftOverlayCols();
  if (!cols.length) return;
  const tips = MODE === 'race' ? (RACE.tiers && RACE.tiers.length ? RACE.tiers : DEFAULT_RACE_TIERS).slice().sort((a, b) => a.min - b.min).filter(t => RACE_CAT[t.cat]).map(t => RACE_CAT[t.cat].short) : [];
  const extra = [];
  if (MODE === 'race') extra.push('💖 ติดตาม = เข้าแข่ง');
  if (likeMode()) extra.push(`❤️ เคาะจอ = ลุ้นนำ ${Math.round(LIKE_LEAD_CHANCE * 100)}%`);
  const rowH = 40, x0 = W - GIFT_SIDE_W - 6, y0 = GIFT_SIDE_Y;
  const h = 22 + cols.length * rowH + extra.length * 18 + 6;
  ctx.save();
  rr(x0, y0, GIFT_SIDE_W, h, 10, 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.1)', 1);
  textC('🎁 ส่งของขวัญ', x0 + GIFT_SIDE_W / 2, y0 + 11, 'rgba(255,240,200,0.85)', 11, 800);
  cols.forEach((c, i) => {
    const y = y0 + 22 + i * rowH, g = c.gifts[0] || { emoji: '🎁', diamonds: 0 };
    const im = g.image ? giftImage(g.image) : null, sz = 26, gx = x0 + 6 + sz / 2, gy = y + rowH / 2;
    ctx.globalAlpha = 0.88;
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, gx - sz / 2, gy - sz / 2, sz, sz);
    else drawEmo(g.emoji || '🎁', gx, gy + sz / 2, sz);
    ctx.globalAlpha = 1;
    const tx = x0 + sz + 12, tw = GIFT_SIDE_W - sz - 16;
    font(fitFont(c.head, tw, 11, 8, 800), 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(c.head, tx, y + 12);
    const sub = `💎${g.diamonds}+ ${tips[i] || ''}`;
    font(fitFont(sub, tw, 9, 7, 600), 600); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(179,229,252,0.8)'; ctx.fillText(sub, tx, y + 27);
  });
  extra.forEach((t, i) => {
    const y = y0 + 22 + cols.length * rowH + i * 18 + 9;
    font(fitFont(t, GIFT_SIDE_W - 10, 10, 7, 700), 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(248,187,208,0.9)'; ctx.fillText(t, x0 + 6, y);
  });
  ctx.restore();
  return y0 + h;
}
// ---- 📋 ผู้ติดตามล่าสุด 10 ชื่อ (ปุ่มเปิด/ปิดในแผงผู้ดูแล) คอลัมน์ขวา ใต้ป้ายของขวัญ สีจาง
const FOLLOWS = { on: false, list: [] };
try { FOLLOWS.on = localStorage.getItem('mtb.flist') === '1'; } catch (e) { /* ignore */ }
function loadRecentFollows() {
  if (typeof fetch !== 'function') return;
  fetch('/followers/recent?limit=10').then(r => r.json()).then(d => { if (d && Array.isArray(d.list)) FOLLOWS.list = d.list.slice(0, 10); }).catch(() => {});
}
function noteFollow(m) {
  if (!m || !m.uniqueId) return;
  FOLLOWS.list = [{ uniqueId: m.uniqueId, nickname: m.nickname || m.uniqueId, avatar: m.avatar || '', at: Date.now(), already: !!m.already, fresh: S.t }]
    .concat(FOLLOWS.list.filter(f => f.uniqueId !== m.uniqueId)).slice(0, 10);
}
function drawFollowList(y0) {
  if (!FOLLOWS.on) return;
  const x0 = W - GIFT_SIDE_W - 6, rowH = 17, n = Math.max(1, FOLLOWS.list.length);
  y0 = Math.min(y0, H - 40 - (24 + n * rowH));
  ctx.save();
  rr(x0, y0, GIFT_SIDE_W, 24 + n * rowH, 10, 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.1)', 1);
  textC('💖 ผู้ติดตามล่าสุด', x0 + GIFT_SIDE_W / 2, y0 + 11, 'rgba(248,187,208,0.9)', 11, 800);
  if (!FOLLOWS.list.length) textC('ยังไม่มี — กดติดตามเลย!', x0 + GIFT_SIDE_W / 2, y0 + 30, 'rgba(255,255,255,0.6)', 9, 600);
  FOLLOWS.list.forEach((f, i) => {
    const y = y0 + 24 + i * rowH + rowH / 2 - 2;
    const hot = f.fresh !== undefined && S.t - f.fresh < 6;   // คนใหม่ล่าสุด: ไฮไลต์ 6 วิ
    if (hot) rr(x0 + 3, y - rowH / 2 + 1, GIFT_SIDE_W - 6, rowH - 2, 6, `rgba(240,98,146,${0.35 * (1 - (S.t - f.fresh) / 6)})`);
    drawAvatar(f.avatar ? giftImage(f.avatar) : null, x0 + 13, y, 6.5, f.nickname, FOLLOW_COLORS[hashStr(f.uniqueId) % FOLLOW_COLORS.length]);
    const nm = String(f.nickname || f.uniqueId);
    font(fitFont(nm, GIFT_SIDE_W - 30, 10, 7, 600), 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)';
    ctx.fillText(nm.length > 14 ? nm.slice(0, 13) + '…' : nm, x0 + 24, y + 1);
  });
  ctx.restore();
}
function drawGiftOverlay() {
  const cols = giftOverlayCols();
  if (!cols.length) return;
  const y0 = GIFT_OV_Y, pad = 8, cw = (W - pad * 2) / cols.length, h = 100;
  ctx.save();
  rr(pad - 2, y0 - 4, W - pad * 2 + 4, h, 12, 'rgba(0,0,0,0.22)', 'rgba(255,255,255,0.12)', 1);
  textC(MODE === 'race' ? '💖 กดติดตาม = ได้นักปั่น · 🎁 ส่งของขวัญ ยิ่งแพงยิ่งพุ่งนำ' : '🎁 ส่งของขวัญ = สั่งท่านักปั่น', W / 2, y0 + 8, 'rgba(255,240,200,0.85)', 11, 700);
  cols.forEach((c, i) => {
    const cx = pad + cw * i + cw / 2;
    if (i) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(pad + cw * i, y0 + 18, 1, h - 26); }
    textC(c.head, cx, y0 + 26, 'rgba(255,255,255,0.88)', fitFont(c.head, cw - 6, 11, 8, 700), 700);
    c.gifts.forEach((g, k) => {
      const gx = c.gifts.length > 1 ? cx + (k ? 1 : -1) * cw * 0.24 : cx, gy = y0 + 54, sz = 28;
      const im = g.image ? giftImage(g.image) : null;
      ctx.globalAlpha = 0.9;
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, gx - sz / 2, gy - sz / 2, sz, sz);
      else drawEmo(g.emoji || '🎁', gx, gy + sz / 2, sz);
      ctx.globalAlpha = 1;
      textC(`💎${g.diamonds}`, gx, gy + 23, 'rgba(128,216,255,0.9)', 10, 700);
      if (g.name) textC(g.name, gx, gy + 35, 'rgba(255,255,255,0.6)', fitFont(g.name, cw * 0.48, 9, 7, 600), 600);
    });
  });
  ctx.restore();
}
// HUD แบ่ง 2 ส่วน: แผงข้อมูล (แถบบน แผนที่ อันดับ ป้ายของขวัญ ฯลฯ) วาดลงภาพพักไว้ 10 ครั้ง/วิ
// + ข้อความเคลื่อนไหว (แบนเนอร์ ข้อความเด้ง นับถอยหลัง) วาดทุกเฟรมให้ลื่น → ลดงานวาดตัวหนังสือ/อีโมจิลงมาก
const HUDC = { cv: null, ctx: null, t: -1 };
function drawHUD(env) {
  const now = performance.now();
  if (!HUDC.cv || HUDC.cv.width !== cv.width || HUDC.cv.height !== cv.height) {
    HUDC.cv = document.createElement('canvas'); HUDC.cv.width = cv.width; HUDC.cv.height = cv.height;
    HUDC.ctx = HUDC.cv.getContext('2d'); HUDC.t = -1;
  }
  if (now - HUDC.t > 100 || now < HUDC.t) {
    HUDC.t = now;
    const main = ctx;
    ctx = HUDC.ctx;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, HUDC.cv.width, HUDC.cv.height);
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      drawHUDPanels(env);
    } finally { ctx = main; }
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(HUDC.cv, 0, 0); ctx.restore();
  drawHUDLive(env);
}
function drawHUDPanels(env) {
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
  if (SP.on) textC(`${spPhase().icon} ${spPhase().name}`, W / 2 + 50, 20, '#fff', 19, 800);
  else {
    // ธงชาติ + ชื่อประเทศ + ฉาก
    const cc = countryOf(playerScene().sid), lbl = `${COUNTRIES[cc].name} · ${ps.icon} ${ps.name}`;
    const fs = fitFont(lbl, 220, 17, 11, 800), tw = ctx.measureText(lbl).width, fw = 26, fh = 17;
    const x0 = W / 2 + 50 - (tw + fw + 6) / 2;
    drawFlag(cc, x0, 20 - fh / 2, fw, fh);
    textC(lbl, x0 + fw + 6 + tw / 2, 20, '#fff', fs, 800);
  }
  if (MODE === 'race' && RACE.stage) {
    const left = Math.max(0, stageLeftMs()), hh = Math.floor(left / 3600000);
    const t = hh ? `${hh}:${String(Math.floor(left / 60000) % 60).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}` : fmtMS(left);
    textC(`🏁 รอบ ${RACE.stage.no} · เหลือ ${t}`, W / 2 + 50, 44, left < 60000 ? '#ff8a80' : '#ffe082', 14, 800);
  } else textC(`ฉากใหม่ใน ${fmtMS(nextMs)}`, W / 2 + 50, 44, '#b3e5fc', 13, 600);
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

  // ---- ป้ายวิธีส่งของขวัญ (แสดงตลอด สีจาง) ให้คนเข้ามาใหม่รู้วิธีเล่น
  const gEnd = drawGiftSide();   // ย้ายจากด้านล่างไปคอลัมน์ขวา (ข้อความ + รูป อย่างเดียว)
  drawFollowList((gEnd || GIFT_SIDE_Y) + 6);
  if (!AC) textC('🔈 แตะจอเพื่อเปิดเสียง', W / 2, GIFT_OV_Y - 16, 'rgba(255,255,255,0.75)', 13, 600, true);
}
// ส่วนที่เคลื่อนไหวทุกเฟรม
function drawHUDLive(env) {
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

  // ช่วงทาง / ความชัน / ออกนอกทาง / ข้อความลอย (คอลัมน์กลาง ด้านบน)
  if (!SP.on && S.curSec && sectionLabel(S.curSec)) { const sl = sectionLabel(S.curSec); softText(sl, W / 2, 240, 'rgba(255,255,255,0.9)', fitFont(sl, W - 40, 13, 9, 700), 700); }
  if (Math.abs(S.slope) > 0.04) {
    const up = S.slope > 0;
    softText(`${up ? '⛰️ ขึ้นเขา' : '🎢 ลงเขา'} ${Math.abs(S.slope * 100).toFixed(0)}%`, W / 2, 268, up ? 'rgba(255,204,188,0.9)' : 'rgba(200,230,201,0.9)', 15, 800);
  }
  if (Math.abs(S.playerX) > 1) softText('⚠️ ออกนอกเส้นทาง!', W / 2, 292, 'rgba(255,245,157,0.9)', 16, 800);
  if (S.regroup) softText(`🧲 กำลังรวมกลุ่ม... ${Math.ceil(Math.max(0, 25 - S.regroup.t))} วิ`, W / 2, 316, 'rgba(179,229,252,0.95)', 16, 800);
  for (const f of S.floaters) {
    ctx.globalAlpha = (1 - f.t / 1.6) * 0.9;
    softText(f.text, W / 2, 330 - f.t * 50, f.color, 20, 800);
    ctx.globalAlpha = 1;
  }

  if (S.countdown > 0 && S.started) {
    const n = Math.ceil(S.countdown);
    textC(n > 3 ? 'เตรียมตัว' : String(n), W / 2, H * 0.4, '#fff', n > 3 ? 48 : 120, 800, true);
  }
}
// หน้าสรุปผลด่าน: แท่นรางวัล 1-2-3 พร้อมชื่อ + รูปโปรไฟล์
function drawPodium(pd) {
  const a = clamp(pd.t * 2, 0, 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,10,30,0.82)'; ctx.fillRect(0, 0, W, H);
  textC(`🏁 สรุปผลรอบ ${pd.no}`, W / 2, 120, '#ffd54f', 34, 800, true);
  if (pd.teams && pd.teams.length) {
    // ทีมชาติ: ทีมชนะ (ธงใหญ่) + ทีมอันดับ 2-3
    const t = pd.teams[0], lbl = `ทีมชนะ: ${COUNTRIES[t.id].name}`;
    font(22, 800); const tw = ctx.measureText(lbl).width;
    drawFlag(t.id, W / 2 - (tw + 48) / 2, 150, 40, 26);
    textC(lbl, W / 2 - (tw + 48) / 2 + 48 + tw / 2, 163, '#fff', 22, 800);
    textC(pd.teams.slice(1, 3).map((e, i) => `${i + 2}. ${COUNTRIES[e.id].name}`).join('   '), W / 2, 196, '#cfd8dc', 14, 600);
  } else textC(`ผู้เข้าเส้นชัย${pd.rtype === 'survival' ? ' · Survival' : ''}`, W / 2, 162, '#fff', 20, 700);
  const top = pd.list.slice(0, 3);
  const slots = [{ i: 1, x: W / 2 - 165, h: 150, medal: '🥈', col: '#cfd8dc' }, { i: 0, x: W / 2, h: 210, medal: '🥇', col: '#ffd54f' }, { i: 2, x: W / 2 + 165, h: 110, medal: '🥉', col: '#ffab91' }];
  const base = 620;
  for (const s of slots) {
    const e = top[s.i];
    if (!e) continue;
    const rise = clamp((pd.t - 0.4 - (2 - s.i) * 0.35) * 2.5, 0, 1);
    const h = s.h * rise, bw = 140;
    rr(s.x - bw / 2, base - h, bw, h, 10, s.col);
    textC(String(s.i + 1), s.x, base - h / 2 + 4, 'rgba(0,0,0,0.55)', 54, 800);
    if (rise < 1) continue;
    const rad = s.i === 0 ? 54 : 44, cy = base - h - rad - 54;
    ell(s.x, cy, rad + 5, rad + 5, s.col);
    drawAvatar(e.avatar ? giftImage(e.avatar) : null, s.x, cy, rad, e.kind === 'bot' ? '' : e.name, e.jersey || '#888');
    if (e.kind === 'bot') textC('🤖', s.x, cy + 2, '#fff', rad, 600);
    textC(s.medal, s.x + rad * 0.75, cy + rad * 0.7, '#fff', 30, 600);
    const nm = e.name.length > 12 ? e.name.slice(0, 11) + '…' : e.name;
    textC(nm, s.x, base - h - 34, '#fff', fitFont(nm, 150, 20, 12, 800), 800, true);
    textC(`${(e.distanceM / 1000).toFixed(2)} กม.${e.diamonds ? ` · ${e.diamonds}💎` : ''}`, s.x, base - h - 12, '#e0f7fa', 13, 600);
  }
  // อันดับ 4-8
  pd.list.slice(3, 8).forEach((e, k) => {
    const y = 670 + k * 34;
    rr(60, y - 14, W - 120, 28, 10, 'rgba(255,255,255,0.08)');
    textC(String(e.rank), 84, y, '#ffd54f', 15, 800);
    drawAvatar(e.avatar ? giftImage(e.avatar) : null, 116, y, 11, e.name, e.jersey || '#888');
    font(15, 600); ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(e.name.length > 18 ? e.name.slice(0, 17) + '…' : e.name, 134, y + 1);
    ctx.textAlign = 'right'; ctx.fillStyle = '#b3e5fc'; ctx.fillText(`${(e.distanceM / 1000).toFixed(2)} กม.`, W - 72, y + 1);
  });
  textC(`รอบต่อไปเริ่มใน ${Math.max(0, Math.ceil(PODIUM_SEC - pd.t))} วิ · กดติดตามเพื่อร่วมแข่ง!`, W / 2, 870, '#f8bbd0', 15, 700);
  ctx.globalAlpha = 1;
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
  let pt = performance.now();
  if (inSpace) { drawSpace(ENV); pt = pmark('r:space', pt); }
  else {
    renderWorld(ENV);
    pt = performance.now();
    if (launching) { /* จรวดวาดใน drawLaunchFX */ }
    else if (own) drawPOV(null);
    else if (CAM.povOf) drawPOV(CAM.povOf);
    if (CAM.shot === 'roadside' && !launching) drawCrowd();
    if (CAM.shot === 'rearcam') drawRearCamBike();
    pt = pmark('r:pov', pt);
  }
  ctx.restore();
  if (launching) drawLaunchFX();
  if (CAM.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${CAM.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  for (const p of S.skid) ell(p.x, p.y - p.t * 70, 20 + p.t * 60, 12 + p.t * 30, `rgba(190,170,140,${0.45 * (1 - p.t / 0.8)})`);
  if (!inSpace) { drawGrading(ENV); drawWeatherFX(ENV); }
  pt = pmark('r:fx', pt);
  drawUnderHUD();
  if (!SP.on && ['pov', 'riderpov', 'rearcam'].includes(CAM.shot)) drawTelemetry(ENV);
  drawHUD(ENV);
  drawOverHUD();
  if (RACE.podium) drawPodium(RACE.podium);
  if (S.paused) drawPause();
  pmark('r:hud', pt);
}

// ----------------------------------------------------------- loop
let last = performance.now();
// 📈 วัดประสิทธิภาพเกม (ส่งให้หน้า /monitor ทุก ~1 วิ)
const PERF = { id: Math.random().toString(36).slice(2, 8), frames: 0, gap: 0, worst: 0, work: 0, workMax: 0, t0: performance.now() };
function frame(now) {
  const gap = now - last;
  const dt = Math.min(0.05, gap / 1000);
  last = now;
  const w0 = performance.now();
  update(dt);
  render();
  const work = performance.now() - w0;
  PERF.frames++; PERF.gap += gap; PERF.worst = Math.max(PERF.worst, gap); PERF.work += work; PERF.workMax = Math.max(PERF.workMax, work);
  requestAnimationFrame(frame);
}
function perfReport() {
  const now = performance.now(), el = (now - PERF.t0) / 1000, n = PERF.frames;
  const mem = performance.memory || null;
  const r = {
    id: PERF.id, fps: el > 0 ? Math.round(n / el * 10) / 10 : 0, frameMs: n ? Math.round(PERF.gap / n * 10) / 10 : 0, worstMs: Math.round(PERF.worst),
    workMs: n ? Math.round(PERF.work / n * 100) / 100 : 0, workMax: Math.round(PERF.workMax * 10) / 10,
    canvas: `${cv.width}×${cv.height}`, css: `${Math.round(cv.getBoundingClientRect().width)}×${Math.round(cv.getBoundingClientRect().height)}`, dpr: window.devicePixelRatio || 1,
    res: Math.round(RES * 100) / 100, sharp: SHARP, riders: racers().length + S.pack.length, objects: S.objects.length, particles: (S.particles || []).length,
    heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
    hidden: document.hidden, focus: document.hasFocus(), audio: AC ? AC.state : 'off', mode: MODE, rtype: RTYPE, cam: CAM.shot, space: SP.on,
    scene: SP.on ? 'อวกาศ' : `${COUNTRIES[countryOf(playerScene().sid)].name} · ${playerScene().scene.name}`, ua: /LIVE ?Studio|TikTok/i.test(navigator.userAgent) ? 'LIVE Studio' : 'Chrome',
  };
  // เวลาเฉลี่ยต่อเฟรมของแต่ละส่วน (ms)
  r.parts = {};
  if (n) for (const [k, v] of Object.entries(PROF.acc)) if (k !== 'gpu:flush') r.parts[k] = Math.round(v / n * 100) / 100;
  PROF.acc = {};
  PERF.frames = 0; PERF.gap = 0; PERF.worst = 0; PERF.work = 0; PERF.workMax = 0; PERF.t0 = now;
  return r;
}

if (PANEL) startPanel();   // หน้า /admin: แค่แผงผู้ดูแล ไม่รันเกม ไม่มีเสียง
else {
  resize();
  // เปิดเกมมาตอนล็อกกลางวัน/กลางคืนไว้: เริ่มที่ช่วงนั้นเลย (ไม่ต้องรอฟ้าเลื่อน)
  if (TIME_LOCK) { S.hourOff = ((TIME_MODES[TIME_LOCK].hour - realHourTH()) % 24 + 24) % 24; S.hourGoal = S.hourOff; }
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
  setInterval(() => updateAdminStatus(true), 1000);   // ส่งสถานะให้หน้า /admin แม้เกมหยุดวาด (หน้าต่างถูกบัง)
}
window.__MTB = S; // สำหรับ debug
window.__MTB_live = onLiveMessage;
setSfxVol(SFX_VOL); setEnvVol(ENV_VOL);   // ให้สไลด์ทุกอันแสดงค่าที่จำไว้
window.__MTB_cam = CAM;
window.__MTB_audio = () => ({ ac: AC ? AC.state : null, sfx: SFX_GAIN ? SFX_GAIN.gain.value : null, vol: SFX_VOL, env: ENV_GAIN ? ENV_GAIN.gain.value : null, rain: rainGain ? rainGain.gain.value : null, wind: windGain ? windGain.gain.value : null });
window.__MTB_track = { SECTIONS, ELEV, sectionAt, elevAt, sectionLabel, getSeg };
window.__MTB_sp = SP;
// debug: เดินเกมไปข้างหน้า N วินาที (ใช้ทดสอบตอนแท็บถูกซ่อนแล้วเกมหยุด) + เข้าถึงสถานะโหมดแข่ง
// debug: วัดเวลาต่อเฟรมแยกส่วน (flush = รอ GPU วาดเสร็จทุกเฟรม เพื่อรวมเวลาระบายพิกเซลจริง)
window.__MTB_bench = (frames = 120, flush = true) => {
  PROF.acc = {};
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) { update(1 / 60); render(); if (flush) { const t = performance.now(); ctx.getImageData(0, 0, 1, 1); pmark('gpu:flush', t); } }
  const tot = (performance.now() - t0) / frames, out = { msPerFrame: +tot.toFixed(2), canvas: `${cv.width}x${cv.height}` };
  for (const [k, v] of Object.entries(PROF.acc).sort((a, b) => b[1] - a[1])) out[k] = +(v / frames).toFixed(2);
  PROF.acc = {};
  return out;
};
window.__MTB_set = (k, v) => { if (k === 'sharp') { SHARP = v; resize(); } if (k === 'pack') { PACK_N = v; initPack(); } };
window.__MTB_run = sec => { const n = Math.round(sec / 0.05); for (let i = 0; i < n; i++) update(0.05); render(); };
window.__MTB_race = { RACE, racers, startSpace, CAM, MUSIC, get RTYPE() { return RTYPE; } };
})();

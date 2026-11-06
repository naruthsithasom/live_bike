// การตั้งค่า (config.json) — โหลด / โหลดใหม่อัตโนมัติเมื่อไฟล์เปลี่ยน / บันทึกชื่อบัญชี
// config.json เป็นไฟล์ส่วนตัว (ชื่อบัญชี/รหัสผ่านฐานข้อมูล) ไม่ขึ้น git → ครั้งแรกสร้างจาก config.example.json ให้เอง
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'config.json');
const EXAMPLE = path.join(ROOT, 'config.example.json');
const DEFAULTS = { giftActions: {}, diamondTiers: [{ min: 1, action: 'jump' }], likesPerJump: 100, maxRepeatPerGift: 10 };

if (!fs.existsSync(FILE) && fs.existsSync(EXAMPLE)) {
  try { fs.copyFileSync(EXAMPLE, FILE); console.log('📝 สร้าง config.json จาก config.example.json แล้ว — ใส่ชื่อบัญชี TikTok ได้ในแผงผู้ดูแล'); }
  catch (e) { console.warn('⚠️  สร้าง config.json ไม่ได้:', e.message); }
}

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { console.warn('⚠️  อ่าน config.json ไม่ได้ ใช้ค่าเริ่มต้น:', e.message); return { ...DEFAULTS }; }
}

// อ็อบเจกต์เดียวที่ทุกไฟล์ใช้ร่วมกัน: โหลดใหม่ = แทนค่าในตัวเดิม (ไฟล์อื่นที่ถือ config ไว้เห็นค่าใหม่ทันที)
const config = read();
const listeners = [];
Object.defineProperty(config, 'onReload', { enumerable: false, value: fn => listeners.push(fn) });
Object.defineProperty(config, 'file', { enumerable: false, value: FILE });

fs.watchFile(FILE, { interval: 2000 }, () => {
  const next = read();
  for (const k of Object.keys(config)) delete config[k];
  Object.assign(config, next);
  console.log('🔄 โหลด config.json ใหม่แล้ว');
  for (const fn of listeners) { try { fn(config); } catch (e) { console.warn('⚠️ ', e.message); } }
});

// บันทึกชื่อบัญชี TikTok (จากปุ่มเชื่อม/ตัดไลฟ์ในแผงผู้ดูแล)
function saveUsername(name) {
  try {
    const cur = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cur.tiktokUsername = name;
    fs.writeFileSync(FILE, JSON.stringify(cur, null, 2) + '\n');
  } catch (e) { console.warn('⚠️  บันทึกชื่อบัญชีลง config.json ไม่ได้:', e.message); }
}

// บันทึกค่าตั้งค่าทั่วไปลง config.json (เช่น เวลาต่อรอบจากแผงผู้ดูแล)
function saveKey(key, value) {
  try {
    const cur = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cur[key] = value;
    fs.writeFileSync(FILE, JSON.stringify(cur, null, 2) + '\n');
  } catch (e) { console.warn(`⚠️  บันทึก ${key} ลง config.json ไม่ได้:`, e.message); }
}

module.exports = { config, saveUsername, saveKey, ROOT };

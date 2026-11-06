// Controller: ช่องข่าวสด (SSE) + ปุ่มเชื่อม/ตัดไลฟ์ + การตั้งค่าที่หน้าเกมใช้
const { config, saveUsername } = require('../config/index');
const hub = require('../lib/hub');
const { json, readJson } = require('../lib/http');
const { cleanUsername } = require('../lib/tiktokUser');
const live = require('../models/live');
const tiktok = require('./tiktokController');

// GET /events — หน้าเกม/แผงผู้ดูแลเปิดค้างไว้รับเหตุการณ์แบบสด
function events(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(`data: ${JSON.stringify({ type: 'status', live })}\n\n`);
  hub.addClient(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); hub.removeClient(res); });
}

// POST /connect {user} — ชื่อบัญชีถูกบันทึกลง config.json ให้เชื่อมเองครั้งหน้า
function connect(req, res) {
  readJson(req, j => {
    const name = cleanUsername(String((j && j.user) || ''));
    if (!/^[\w.]{2,24}$/.test(name)) return json(res, { ok: false, msg: 'ชื่อบัญชีไม่ถูกต้อง (ตัวอักษร ตัวเลข _ . เท่านั้น)' });
    saveUsername(name);
    tiktok.start(name);
    json(res, { ok: true, msg: `กำลังเชื่อม @${name} — ต้องกด Go LIVE ใน TikTok ก่อนถึงจะติด` });
  }, { limit: 2000 });
}

// POST /disconnect
function disconnect(req, res) {
  tiktok.stop();
  saveUsername('');
  json(res, { ok: true, msg: 'ตัดการเชื่อม TikTok แล้ว' });
}

// GET /config — ค่าที่หน้าเกมใช้ (ไม่มีรหัสผ่าน)
function publicConfig(req, res) {
  json(res, { giftActions: config.giftActions || {}, diamondTiers: config.diamondTiers || [], likesPerJump: config.likesPerJump || 100, live });
}

module.exports = { events, connect, disconnect, publicConfig };

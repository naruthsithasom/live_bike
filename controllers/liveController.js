// Controller: ช่องข่าวสด (SSE) + ปุ่มเชื่อม/ตัดไลฟ์ + การตั้งค่าที่หน้าเกมใช้
const { config, saveUsername } = require('../config/index');
const hub = require('../lib/hub');
const { json, readJson } = require('../lib/http');
const { cleanUsername } = require('../lib/tiktokUser');
const live = require('../models/live');
const tiktok = require('./tiktokController');

// GET /events — หน้าเกม/แผงผู้ดูแลเปิดค้างไว้รับเหตุการณ์แบบสด
function events(req, res) {
  // no-transform + X-Accel-Buffering: ให้ Cloudflare/พร็อกซีส่งต่อทันที ไม่บีบอัด/ไม่พักข้อความไว้ (ลิงก์ public ผ่านอุโมงค์)
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  if (res.socket) res.socket.setNoDelay(true);
  res.write(`: ${' '.repeat(2048)}\n\n`);   // ดันข้อความแรกให้หลุดบัฟเฟอร์ของพร็อกซี
  res.write(`data: ${JSON.stringify({ type: 'status', live })}\n\n`);
  hub.addClient(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 20000);
  req.on('close', () => { clearInterval(ping); hub.removeClient(res); });
}

// GET /events/poll?since=ID — สำรองของ /events สำหรับลิงก์ public (อุโมงค์ฟรีของ Cloudflare ไม่รองรับ SSE)
// ครั้งแรก (since ไม่มี) ได้สถานะไลฟ์ + id ล่าสุด · ครั้งต่อไปรอข้อความใหม่ได้ถึง 20 วิ
function poll(req, res, url) {
  const raw = url.searchParams.get('since');
  if (raw === null || raw === '') return json(res, { id: hub.log.seq, items: [{ type: 'status', live }] });
  const id = Math.max(0, parseInt(raw, 10) || 0);
  const cancel = hub.since(id, 20000, (items, last) => {
    if (res.writableEnded) return;
    // ข้อความเก่าเกิน 500 รายการหลุดไปแล้ว → ส่งสถานะใหม่ให้ตั้งต้นใหม่
    const gap = items.length && items[0].id > id + 1 && id > 0;
    json(res, { id: last, items: (gap ? [{ type: 'status', live }] : []).concat(items.map(m => m.obj)) });
  });
  req.on('close', () => { if (typeof cancel === 'function') cancel(); });
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

module.exports = { events, poll, connect, disconnect, publicConfig };

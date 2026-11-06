// Model: บันทึกทุกเหตุการณ์จาก TikTok LIVE (log ดักทุก event ที่ tiktok-live-connector ส่งมา)
// - เก็บล่าสุด 3000 รายการในหน่วยความจำ (หน้า /eventlog ดูสดได้)
// - เขียนลงไฟล์ logs/tiktok-events-YYYY-MM-DD.jsonl (1 บรรทัด = 1 เหตุการณ์ พร้อมข้อมูลดิบ)
// ข้อมูลในไฟล์มีชื่อ/แชทของผู้ชม — เก็บไว้ในเครื่องนี้เท่านั้น
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'logs');   // โฟลเดอร์ logs/ ที่รากโปรเจกต์
const MAX_MEM = 3000;
const MAX_RAW = 6000;   // ตัดข้อมูลดิบต่อเหตุการณ์ไม่ให้ไฟล์ใหญ่เกินไป
const log = { seq: 0, buf: [], counts: {}, startedAt: Date.now(), stream: null, day: '', raw: true, enabled: true, errors: 0, errSeen: new Map() };

function dayStr(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// แปลงข้อมูลจาก protobuf ให้เป็น JSON ได้ (BigInt, ไบต์ดิบ)
function toJsonSafe(obj) {
  let s;
  try {
    s = JSON.stringify(obj, (k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v && (v instanceof Uint8Array || Buffer.isBuffer(v))) return `[${v.length} bytes]`;
      return v;
    });
  } catch (e) { return { _error: String(e.message || e) }; }
  if (s === undefined) return null;
  if (s.length <= MAX_RAW) { try { return JSON.parse(s); } catch (e) { return s; } }
  return s.slice(0, MAX_RAW) + '…(ตัด)';
}
function userOf(d) {
  if (!d || typeof d !== 'object') return null;
  const u = d.user || d.userInfo || (d.common && d.common.user) || null;
  if (!u || (!u.uniqueId && !u.nickname)) return null;
  return { id: u.uniqueId || '', nick: u.nickname || u.uniqueId || '' };
}
function pick(...v) { return v.find(x => x !== undefined && x !== null && x !== '') }
// สรุปสั้นๆ เป็นภาษาไทยตามชนิดเหตุการณ์
function summarize(type, d) {
  d = d || {};
  switch (type) {
    case 'chat': return `💬 ${String(d.comment || '').slice(0, 200)}`;
    case 'gift': {
      const g = d.giftDetails || {};
      const streak = g.giftType === 1 && !d.repeatEnd;
      return `🎁 ${pick(g.giftName, 'Gift#' + d.giftId)} x${d.repeatCount || 1} (${g.diamondCount || 0}💎 ต่อชิ้น)${streak ? ' · กำลังส่งต่อเนื่อง' : ''}`;
    }
    case 'like': return `❤️ +${d.likeCount || 1} (รวมทั้งไลฟ์ ${d.totalLikeCount || '?'})`;
    case 'member': return '👋 เข้าห้อง';
    case 'follow': return '💖 กดติดตาม';
    case 'share': return '📣 แชร์ไลฟ์';
    case 'social': return `🔔 ${pick(d.common && d.common.displayText && d.common.displayText.defaultPattern, d.action, 'social')}`;
    case 'roomUser': return `👥 ผู้ชมตอนนี้ ${pick(d.viewerCount, d.total, '?')} คน`;
    case 'questionNew': return `❓ ${pick(d.details && d.details.text, d.questionText, '')}`;
    case 'envelope': return '🧧 กล่องสมบัติ (Treasure box)';
    case 'subNotify': case 'superFan': case 'superFanJoin': return '⭐ สมัครสมาชิก / ซูเปอร์แฟน';
    case 'emote': return '😀 ส่งอีโมต';
    case 'linkMicBattle': case 'linkMicArmies': return '⚔️ PK / แบทเทิล';
    case 'goalUpdate': return '🎯 อัปเดตเป้าหมาย (LIVE goal)';
    case 'pollMessage': return '📊 โพล';
    case 'roomPin': return '📌 ปักหมุดข้อความ';
    case 'streamEnd': return '📴 ไลฟ์จบ';
    case 'liveIntro': return '📝 คำแนะนำไลฟ์';
    case 'rankUpdate': case 'hourlyRank': case 'rankText': return '🏆 อันดับรายชั่วโมง';
    case 'connected': return '✅ เชื่อมห้องไลฟ์สำเร็จ';
    case 'disconnected': return '⚠️ หลุดการเชื่อมต่อ';
    case 'error': return `❌ ${String((d && (d.message || d.info)) || d).slice(0, 160)}`;
  }
  const p = d.common && d.common.displayText && d.common.displayText.defaultPattern;
  return p ? `· ${String(p).slice(0, 160)}` : `· (${type})`;
}
function write(rec) {
  const day = dayStr(rec.t);
  if (day !== log.day || !log.stream) {
    if (log.stream) log.stream.end();
    try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) { /* ignore */ }
    log.stream = fs.createWriteStream(path.join(DIR, `tiktok-events-${day}.jsonl`), { flags: 'a' });
    log.stream.on('error', () => { log.errors++; });
    log.day = day;
  }
  log.stream.write(JSON.stringify(rec) + '\n');
}
// type = ชื่อ event, data = ข้อมูลดิบจาก TikTok, extra = { test: true } ฯลฯ
function add(type, data, extra) {
  if (!log.enabled) return null;
  const t = Date.now();
  let text = '';
  try { text = summarize(type, data); } catch (e) { text = `· (${type})`; }
  log.counts[type] = (log.counts[type] || 0) + 1;
  // error ซ้ำเดิม (เช่นยังไม่ได้ไลฟ์ ลองเชื่อมใหม่ทุก 10 วิ) → บันทึกครั้งเดียวทุก 5 นาที ไม่ให้ log รก
  if (type === 'error' || type === 'disconnected') {
    const key = type + text;
    if (t - (log.errSeen.get(key) || 0) < 300000) return null;
    log.errSeen.set(key, t);
  } else if (type === 'connected') log.errSeen.clear();
  const rec = { id: ++log.seq, t, type, user: userOf(data), text, ...(extra || {}) };
  log.buf.push(rec);
  if (log.buf.length > MAX_MEM) log.buf.shift();
  try { write(log.raw ? { ...rec, raw: toJsonSafe(data) } : rec); } catch (e) { log.errors++; }
  return rec;
}
function recent({ since = 0, limit = 300 } = {}) {
  const items = log.buf.filter(r => r.id > since).slice(-Math.max(1, Math.min(limit, 1000)));
  return { items, counts: log.counts, total: log.seq, startedAt: log.startedAt, file: log.day ? `tiktok-events-${log.day}.jsonl` : '', raw: log.raw, errors: log.errors };
}
function files() {
  try {
    return fs.readdirSync(DIR).filter(f => /^tiktok-events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().reverse()
      .map(f => ({ name: f, size: fs.statSync(path.join(DIR, f)).size }));
  } catch (e) { return []; }
}
function filePath(name) { return /^tiktok-events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(String(name)) ? path.join(DIR, name) : null; }
function configure(cfg) { cfg = cfg || {}; log.enabled = cfg.enabled !== false; log.raw = cfg.raw !== false; }
// ล้างที่แสดงบนหน้า (ไฟล์ไม่ลบ)
function clear() { log.buf = []; log.counts = {}; log.startedAt = Date.now(); }

module.exports = { add, recent, files, filePath, configure, clear };

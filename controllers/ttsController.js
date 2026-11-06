// Controller: เสียงพูดภาษาไทยออนไลน์ (ใช้เมื่อ Windows ไม่มีเสียงไทยติดตั้ง)
// GET /tts?q=ข้อความ → ไฟล์เสียง mp3 จาก Google Translate (เสียงผู้หญิง) · เก็บไว้ในหน่วยความจำ ข้อความซ้ำไม่ต้องโหลดใหม่
// เสียงเล่นในหน้าต่างเกม (Chrome) → LIVE Studio จับเสียงไปไลฟ์ได้เหมือนเสียงเกม
const { text } = require('../lib/http');

const cache = new Map();   // ข้อความ → Buffer
const MAX_CACHE = 300;
let recent = [];           // เวลาที่ขอล่าสุด (กันยิงถี่เกิน)

async function speak(req, res, url) {
  const q = String(url.searchParams.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, 190);
  if (!q) return text(res, 'missing q', 400);
  let buf = cache.get(q);
  if (!buf) {
    const now = Date.now();
    recent = recent.filter(t => now - t < 60000);
    if (recent.length >= 60) return text(res, 'too many requests', 429);
    recent.push(now);
    const src = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(q)}`;
    const r = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', Referer: 'https://translate.google.com/' } });
    if (!r.ok) { console.warn(`⚠️  เสียงพูดออนไลน์ไม่ได้ (${r.status})`); return text(res, 'tts failed', 502); }
    buf = Buffer.from(await r.arrayBuffer());
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(q, buf);
  }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': buf.length, 'Cache-Control': 'private, max-age=3600' });
  res.end(buf);
}

module.exports = { speak };

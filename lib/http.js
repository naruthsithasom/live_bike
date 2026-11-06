// ตัวช่วย HTTP ที่ทุก controller ใช้
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function json(res, obj, { cache = false, status = 200 } = {}) {
  const h = { 'Content-Type': MIME['.json'] };
  if (!cache) h['Cache-Control'] = 'no-cache';
  res.writeHead(status, h);
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}
function text(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}
// อ่าน body แบบ JSON (จำกัดขนาด) · อ่านไม่ได้ = {} หรือ null ถ้า strict
function readJson(req, cb, { limit = 200000, strict = false } = {}) {
  let body = '';
  req.on('data', c => { body += c; if (body.length > limit) req.destroy(); });
  req.on('end', () => {
    let j = strict ? null : {};
    try { j = JSON.parse(body || '{}'); } catch (e) { /* ignore */ }
    cb(j);
  });
}

module.exports = { MIME, json, text, readJson };

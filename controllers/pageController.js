// Controller: หน้าเว็บ (View) — ส่งไฟล์จากโฟลเดอร์ views/ (เกม, แผงผู้ดูแล, monitor, followers, eventlog)
const fs = require('fs');
const path = require('path');
const { MIME, text } = require('../lib/http');

const VIEWS = path.join(__dirname, '..', 'views');
// ที่อยู่สั้น → ไฟล์หน้า
const PAGES = { '/': '/index.html', '/admin': '/index.html', '/monitor': '/monitor.html', '/followers': '/followers.html', '/eventlog': '/eventlog.html' };

function serve(req, res, url, urlPath) {
  const p = PAGES[urlPath.replace(/\/+$/, '') || '/'] || urlPath;
  const file = path.normalize(path.join(VIEWS, p));
  // อ่านได้เฉพาะไฟล์ในโฟลเดอร์ views/ (กันโฟลเดอร์ชื่อคล้ายกัน และไฟล์ซ่อน)
  if (!file.startsWith(VIEWS + path.sep) || /[\\/]\./.test(file.slice(VIEWS.length))) return text(res, 'Forbidden', 403);
  fs.readFile(file, (err, data) => {
    if (err) return text(res, 'Not found', 404);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

module.exports = { serve, VIEWS };

// Controller: log เหตุการณ์ TikTok (/eventlog)
const fs = require('fs');
const path = require('path');
const { json, text } = require('../lib/http');
const evlog = require('../models/eventlog');
const live = require('../models/live');

// GET /eventlog/recent?since=ID&limit=
function recent(req, res, url) {
  const d = evlog.recent({ since: parseInt(url.searchParams.get('since'), 10) || 0, limit: parseInt(url.searchParams.get('limit'), 10) || 300 });
  json(res, { ...d, live: { status: live.status, username: live.username }, files: evlog.files() });
}

// GET /eventlog/download?file=tiktok-events-YYYY-MM-DD.jsonl
function download(req, res, url) {
  const fp = evlog.filePath(url.searchParams.get('file'));
  if (!fp || !fs.existsSync(fp)) return text(res, 'Not found', 404);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Content-Disposition': `attachment; filename="${path.basename(fp)}"` });
  fs.createReadStream(fp).pipe(res);
}

// POST /eventlog/clear — ล้างที่แสดงบนหน้า (ไฟล์ไม่ลบ)
function clear(req, res) { evlog.clear(); json(res, '{"ok":true}'); }

module.exports = { recent, download, clear };

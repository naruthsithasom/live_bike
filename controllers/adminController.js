// Controller: แผงผู้ดูแลแบบหน้าแยก (/admin) — ส่งคำสั่งผ่านเซิร์ฟเวอร์ไปทุกหน้าเกม + รับสถานะกลับจากหน้าเกม
const { broadcast } = require('../lib/hub');
const { json, readJson } = require('../lib/http');
const admin = require('../models/admin');
const perf = require('../models/perf');

// POST /admin/cmd {kind, val, target} → ทุกหน้าเกมทำคำสั่งนี้
function command(req, res) {
  readJson(req, j => {
    if (!j || typeof j !== 'object') return json(res, '{"ok":false}');
    broadcast({ type: 'admin', kind: String(j.kind || ''), val: j.val == null ? '' : String(j.val), target: Number.isInteger(j.target) ? j.target : 0 });
    json(res, '{"ok":true}');
  }, { strict: true });
}

// POST /admin/state — หน้าเกมส่งสถานะ (ปุ่มที่เลือก, FPS ฯลฯ) ทุก ~1 วิ
function postState(req, res) {
  readJson(req, j => {
    if (!j || typeof j !== 'object') return json(res, '{"ok":false}');
    admin.set(j);
    perf.setPage(j.perf);
    json(res, '{"ok":true}');
  }, { strict: true });
}

// GET /admin/state — หน้า /admin อ่านสถานะล่าสุด
function getState(req, res) { json(res, admin.get()); }

module.exports = { command, postState, getState };

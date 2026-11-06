// Controller: ล็อกอิน / ออกจากระบบ แผงผู้ดูแล
const auth = require('../lib/auth');
const { json, readJson } = require('../lib/http');

// POST /login {password}
function login(req, res) {
  readJson(req, j => {
    const r = auth.login(req, res, String((j && j.password) || '').slice(0, 200));
    json(res, { ok: r.ok, msg: r.msg }, { status: r.status });
  }, { limit: 2000 });
}
// POST /logout
function logout(req, res) { auth.logout(req, res); json(res, { ok: true }); }
// GET /whoami — หน้าเว็บเช็กว่ามีสิทธิ์ผู้ดูแลไหม
function whoami(req, res) { json(res, { admin: auth.isAdmin(req), local: auth.isLocal(req) }); }

module.exports = { login, logout, whoami };

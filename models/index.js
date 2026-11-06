// ฐานข้อมูล 2 ที่ แบบ local-first (Sequelize)
//   local  = MySQL/MariaDB ในเครื่อง (XAMPP)  → เขียน/อ่านทันที เร็ว ไม่ติดเน็ต
//   remote = ฐานข้อมูลบนโฮสต์ (shared hosting) → ส่งข้อมูลใหม่ขึ้นไปเป็นรอบ (ค่าเริ่มต้นทุก 20 วิ) รวดเดียว
// - XAMPP ปิดอยู่ → เขียนตรงขึ้นโฮสต์แทน แล้วพอ XAMPP กลับมา ดึงข้อมูลช่วงนั้นกลับลงเครื่องให้เอง
// - เชื่อมไม่ได้ → ลองใหม่แบบเว้นระยะห่างขึ้นเรื่อยๆ (ไม่ยิงถี่ ไม่ให้โฮสต์มองเป็นการโจมตี)
// - ถ้าเชื่อมไม่ได้ทั้งคู่ เกมยังเล่นต่อได้ปกติ (แค่ไม่บันทึก)
let Sequelize = null, mysql = null;
try { ({ Sequelize } = require('sequelize')); mysql = require('mysql2/promise'); } catch (e) { /* ยังไม่ได้ npm install */ }
const { QueryTypes } = Sequelize ? require('sequelize') : {};
const { defineModels, syncSchema } = require('./definitions');

const TZ = '+07:00';   // เวลาไทยทั้ง 2 ที่ → เวลาในฐานข้อมูลตรงกัน
// ตารางที่เพิ่มอย่างเดียว (มี id) → ซิงก์ตาม id · viewers → ซิงก์ตามเวลาที่อัปเดตล่าสุด
const APPEND_TABLES = ['gifts', 'stage_results'];
// คีย์ธรรมชาติ ใช้เช็กว่าแถวนี้มีอยู่แล้วหรือยัง (กรณี id ชนกันหลังสลับไปเขียนบนโฮสต์ชั่วคราว)
const NATURAL_KEY = { gifts: ['unique_id', 'created_at', 'gift_name', 'gift_count'], stage_results: ['stage_no', 'started_at', 'rank_no', 'unique_id'] };
const CONN_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_CON_COUNT_ERROR', 'ER_TOO_MANY_USER_CONNECTIONS', 'ER_USER_LIMIT_REACHED', 'ER_HOST_IS_BLOCKED']);
const errCode = e => (e && ((e.original && e.original.code) || (e.parent && e.parent.code) || e.code)) || '';
const isConnErr = e => CONN_CODES.has(errCode(e)) || /^Sequelize(Connection|HostNotFound|HostNotReachable|AccessDenied|ConnectionRefused|ConnectionTimedOut|InvalidConnection)/.test((e && e.name) || '') || !!(e && e.fatal);
const isDup = e => errCode(e) === 'ER_DUP_ENTRY' || (e && e.name === 'SequelizeUniqueConstraintError');
const errText = e => String(errCode(e) || (e && e.message) || e);

function makeTarget(name, label) { return { name, label, seq: null, M: null, ok: false, error: '', key: '', cfg: null, retryAt: 0, backoff: 0, where: '' }; }
const L = makeTarget('local', 'ในเครื่อง');
const R = makeTarget('remote', 'โฮสต์');
const sync = { timer: null, busy: false, cursor: {}, viewersSince: null, lastRun: 0, lastPushed: 0, pushedTotal: 0, pulledTotal: 0, remoteQueries: 0, error: '', seconds: 20 };
let retryTimer = null;

// ฐานข้อมูลหลักที่ใช้อ่าน/เขียนตอนนี้: ในเครื่องก่อน ถ้าไม่ได้ค่อยใช้โฮสต์
function primary() { return L.ok ? L : R.ok ? R : null; }
const state = {
  get ok() { return !!primary(); },
  get error() { return [L, R].filter(t => t.cfg && t.cfg.enabled !== false && !t.ok).map(t => `${t.label}: ${t.error}`).join(' · '); },
  get using() { const p = primary(); return p ? p.name : 'none'; },
  local: L, remote: R, sync, lastFail: '',
};

async function connectTarget(T) {
  const cfg = T.cfg || {};
  await closeTarget(T);
  if (cfg.enabled === false) { T.error = 'ปิดไว้ใน config.json'; return false; }
  if (!Sequelize || !mysql) { T.error = 'ยังไม่ได้ติดตั้ง sequelize / mysql2 (รัน npm install)'; return false; }
  const host = cfg.host || '127.0.0.1', port = cfg.port || 3306, user = cfg.user || 'root', password = cfg.password || '';
  const name = String(cfg.database || 'live_bike').replace(/[^\w]/g, '');
  try {
    // สร้างฐานข้อมูลถ้ายังไม่มี (บน shared hosting ปกติสร้างไว้แล้วใน cPanel)
    const c = await mysql.createConnection({ host, port, user, password, connectTimeout: 10000 });
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await c.end();
    T.seq = new Sequelize(name, user, password, {
      host, port, dialect: 'mysql', logging: false, timezone: TZ,
      dialectOptions: { charset: 'utf8mb4', connectTimeout: 10000 },
      pool: { max: T === R ? 2 : 5, min: 0, idle: 30000, acquire: 15000 },
      define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
    });
    await T.seq.authenticate();
    T.M = defineModels(T.seq);
    await syncSchema(T.seq, T.M);   // สร้างตาราง / เพิ่มคอลัมน์ใหม่ จากนิยามใน models/definitions.js
    T.ok = true; T.error = ''; T.backoff = 0; T.where = `${user}@${host}:${port}/${name}`;
    console.log(`🗄️  เชื่อมฐานข้อมูล${T.label}แล้ว: ${T.where}`);
    return true;
  } catch (e) {
    T.ok = false; T.error = errText(e);
    scheduleRetry(T);
    console.warn(`⚠️  เชื่อมฐานข้อมูล${T.label}ไม่ได้ (${T.error}) — ลองใหม่ใน ${Math.round(T.backoff / 1000)} วิ`);
    await closeTarget(T, true);
    return false;
  }
}
async function closeTarget(T, keepError) {
  const s = T.seq; T.seq = null; T.M = null; T.ok = false;
  if (!keepError) T.error = '';
  if (s) { try { await s.close(); } catch (e) { /* ignore */ } }
}
// ลองใหม่แบบเว้นระยะ: ในเครื่อง 30 วิ → 5 นาที · โฮสต์ 60 วิ → 10 นาที
function scheduleRetry(T) {
  const min = T === R ? 60000 : 30000, max = T === R ? 600000 : 300000;
  T.backoff = Math.min(max, T.backoff ? T.backoff * 2 : min);
  T.retryAt = Date.now() + T.backoff;
}
function markDown(T, e) {
  if (!T.ok) return;
  T.ok = false; T.error = errText(e);
  scheduleRetry(T);
  console.warn(`⚠️  ฐานข้อมูล${T.label}หลุด (${T.error})${T === L && R.ok ? ' — สลับไปบันทึกบนโฮสต์ชั่วคราว' : ''}`);
  closeTarget(T, true);
}
async function retryLoop() {
  const now = Date.now();
  for (const T of [L, R]) {
    if (!T.cfg || T.cfg.enabled === false || T.ok || now < T.retryAt) continue;
    T.retryAt = now + 3600000;   // กันลองซ้อน
    if (await connectTarget(T)) {
      if (T === L && R.ok) await pullFromRemote();   // XAMPP กลับมา → ดึงข้อมูลช่วงที่หายไปลงเครื่อง
      if (T === R && L.ok) { sync.cursor = {}; sync.viewersSince = null; }   // โฮสต์กลับมา → ส่งทุกอย่างที่ค้าง
    }
  }
}

async function init(localCfg, remoteCfg) {
  const lk = JSON.stringify(localCfg || {}), rk = JSON.stringify(remoteCfg || { enabled: false });
  const lChanged = lk !== L.key, rChanged = rk !== R.key;
  L.key = lk; R.key = rk;
  L.cfg = localCfg || {}; R.cfg = remoteCfg || { enabled: false };
  sync.seconds = Math.max(5, Number((remoteCfg || {}).syncSeconds) || 20);
  if (lChanged) await connectTarget(L);
  if (rChanged) { await connectTarget(R); sync.cursor = {}; sync.viewersSince = null; }
  if (rChanged && R.cfg.enabled === false) console.log('🗄️  ฐานข้อมูลโฮสต์: ปิดอยู่ (dbRemote.enabled = false) — ใช้ในเครื่องอย่างเดียว');
  if ((lChanged || rChanged) && L.ok && R.ok) await pullFromRemote();
  if (!retryTimer) { retryTimer = setInterval(() => retryLoop().catch(() => {}), 10000); retryTimer.unref(); }
  if (sync.timer) clearInterval(sync.timer);
  sync.timer = setInterval(() => syncOnce().catch(() => {}), sync.seconds * 1000);
  sync.timer.unref();
}
async function close() {
  if (sync.timer) clearInterval(sync.timer);
  if (retryTimer) clearInterval(retryTimer);
  sync.timer = retryTimer = null;
  try { await syncOnce(); } catch (e) { /* ignore */ }
  await closeTarget(L); await closeTarget(R);
}

// รันคำสั่งกับฐานข้อมูลหลัก (fn ได้ { seq, M }) · หลุดกลางทาง → สลับไปอีกที่แล้วลองซ้ำ 1 ครั้ง
async function run(where, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const T = primary();
    if (!T) return undefined;
    try { if (T === R) sync.remoteQueries++; return await fn({ seq: T.seq, M: T.M }); }
    catch (e) {
      if (isConnErr(e)) { markDown(T, e); continue; }
      const msg = errText(e);
      if (msg !== state.lastFail) console.warn(`⚠️  ฐานข้อมูล (${where}): ${msg}`);
      state.lastFail = msg;
      return undefined;
    }
  }
  return undefined;
}
// คำสั่ง SQL ดิบ (ใช้กับสถิติ/การซิงก์ที่ ORM ทำได้ไม่ครบ)
const select = (T, sql, replacements) => { if (T === R) sync.remoteQueries++; return T.seq.query(sql, { replacements, type: QueryTypes.SELECT }); };
const exec = (T, sql, replacements) => { if (T === R) sync.remoteQueries++; return T.seq.query(sql, { replacements }); };

// ---------------------------------------------------------------- ซิงก์ ในเครื่อง → โฮสต์
const q = n => '`' + n + '`';
// Sequelize ตัดมิลลิวินาทีทิ้งตอนเขียนวันที่ → แปลงเองเป็นเวลาไทยพร้อมมิลลิวินาที ให้คัดลอกได้ตรงทุกหลัก
const TZ_MS = 7 * 3600000;
function sqlDate(d) { return new Date(d.getTime() + TZ_MS).toISOString().replace('T', ' ').replace('Z', ''); }
const val = v => (v === undefined ? null : v instanceof Date ? sqlDate(v) : v);
function insertSql(table, cols, rows, upsert) {
  const ph = '(' + cols.map(() => '?').join(',') + ')';
  let sql = `INSERT INTO ${q(table)} (${cols.map(q).join(',')}) VALUES ${rows.map(() => ph).join(',')}`;
  if (upsert) sql += ' ON DUPLICATE KEY UPDATE ' + cols.filter(c => c !== upsert).map(c => `${q(c)} = VALUES(${q(c)})`).join(', ');
  return [sql, rows.flatMap(r => cols.map(c => val(r[c])))];
}
async function insertRows(T, table, rows) {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  let n = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    try { await exec(T, ...insertSql(table, cols, chunk)); n += chunk.length; continue; }
    catch (e) { if (!isDup(e)) throw e; }
    // id ชน (เคยเขียนบนอีกที่ตอนสลับ) → ทีละแถว: มีอยู่แล้ว = ข้าม, ยังไม่มี = เพิ่มโดยให้ id ใหม่
    const nk = NATURAL_KEY[table], noId = cols.filter(c => c !== 'id');
    for (const r of chunk) {
      try { await exec(T, ...insertSql(table, cols, [r])); n++; continue; }
      catch (e2) { if (!isDup(e2)) throw e2; }
      const [ex] = await select(T, `SELECT COUNT(*) AS n FROM ${q(table)} WHERE ${nk.map(c => `${q(c)} <=> ?`).join(' AND ')}`, nk.map(c => val(r[c])));
      if (Number(ex.n) === 0) { await exec(T, ...insertSql(table, noId, [r])); n++; }
    }
  }
  return n;
}
async function upsertViewers(T, rows) {
  if (!rows.length) return 0;
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 500) await exec(T, ...insertSql('viewers', cols, rows.slice(i, i + 500), 'unique_id'));
  return rows.length;
}
async function syncOnce() {
  if (!L.ok || !R.ok || sync.busy) return;
  sync.busy = true;
  let pushed = 0;
  try {
    for (const t of APPEND_TABLES) {
      if (sync.cursor[t] == null) {   // ครั้งแรก: ถามโฮสต์ว่ามีถึง id ไหนแล้ว (ครั้งเดียว แล้วจำไว้)
        const [m] = await select(R, `SELECT IFNULL(MAX(id), 0) AS m FROM ${q(t)}`);
        sync.cursor[t] = Number(m.m);
      }
      const rows = await select(L, `SELECT * FROM ${q(t)} WHERE id > ? ORDER BY id LIMIT 2000`, [sync.cursor[t]]);
      if (!rows.length) continue;
      pushed += await insertRows(R, t, rows);
      sync.cursor[t] = Number(rows[rows.length - 1].id);
    }
    // viewers: ส่งเฉพาะแถวที่อัปเดตตั้งแต่รอบก่อน (เผื่อเวลาซ้อน 2 นาที — ส่งซ้ำได้ไม่เสียหาย)
    const [now] = await select(L, 'SELECT NOW() AS n');
    const vrows = sync.viewersSince
      ? await select(L, 'SELECT * FROM viewers WHERE last_seen >= ? - INTERVAL 120 SECOND OR followed_at >= ? - INTERVAL 120 SECOND', [val(sync.viewersSince), val(sync.viewersSince)])
      : await select(L, 'SELECT * FROM viewers');
    pushed += await upsertViewers(R, vrows);
    sync.viewersSince = now.n;
    sync.error = '';
  } catch (e) {
    sync.error = errText(e);
    if (isConnErr(e)) markDown(R, e); else console.warn(`⚠️  ซิงก์ขึ้นโฮสต์ไม่สำเร็จ: ${sync.error}`);
  } finally {
    sync.busy = false; sync.lastRun = Date.now();
    if (pushed) { sync.lastPushed = pushed; sync.pushedTotal += pushed; }
  }
}
// ดึงข้อมูลที่เขียนบนโฮสต์ตอน XAMPP ปิด กลับลงเครื่อง
async function pullFromRemote() {
  if (!L.ok || !R.ok) return;
  let pulled = 0;
  try {
    for (const t of APPEND_TABLES) {
      const [m] = await select(L, `SELECT IFNULL(MAX(id), 0) AS m FROM ${q(t)}`);
      const rows = await select(R, `SELECT * FROM ${q(t)} WHERE id > ? ORDER BY id LIMIT 20000`, [Number(m.m)]);
      pulled += await insertRows(L, t, rows);
    }
    const [lv] = await select(L, 'SELECT MAX(last_seen) AS m FROM viewers');
    const vrows = lv.m ? await select(R, 'SELECT * FROM viewers WHERE last_seen > ?', [val(lv.m)]) : await select(R, 'SELECT * FROM viewers');
    pulled += await upsertViewers(L, vrows);
    sync.cursor = {}; sync.viewersSince = null;
    sync.pulledTotal += pulled;
    if (pulled) console.log(`🔄 ดึงข้อมูลจากโฮสต์ลงเครื่อง ${pulled} แถว (ช่วงที่ XAMPP ปิด)`);
  } catch (e) { console.warn(`⚠️  ดึงข้อมูลจากโฮสต์ไม่สำเร็จ: ${errText(e)}`); }
}

function info() {
  return {
    using: state.using,
    local: { ok: L.ok, where: L.where, error: L.ok ? '' : L.error, enabled: !!L.cfg && L.cfg.enabled !== false },
    remote: { ok: R.ok, where: R.where, error: R.ok ? '' : R.error, enabled: !!R.cfg && R.cfg.enabled !== false },
    sync: { everySec: sync.seconds, lastRun: sync.lastRun, lastPushed: sync.lastPushed, pushedTotal: sync.pushedTotal, pulledTotal: sync.pulledTotal, remoteQueries: sync.remoteQueries, error: sync.error },
  };
}

module.exports = { init, close, run, syncOnce, pullFromRemote, info, state, QueryTypes };

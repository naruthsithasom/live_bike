// ศูนย์กระจายข่าว: ส่งเหตุการณ์ไปทุกหน้าเกม/แผงผู้ดูแลที่เปิดอยู่
//   - SSE (/events)          ใช้ในเครื่อง / วง Wi-Fi (เร็วสุด)
//   - long-poll (/events/poll) สำรองสำหรับลิงก์ public ผ่านอุโมงค์ฟรีของ Cloudflare ที่ไม่รองรับ SSE
const clients = new Set();
const taps = [];   // ตัวดักข้อความ (เช่น นับจำนวนเหตุการณ์ให้หน้า /monitor)
const log = { seq: 0, buf: [] };   // ข้อความล่าสุด 500 รายการ (ให้ long-poll ดึงต่อจาก id ที่เคยได้)
const waiters = new Set();         // คำขอ long-poll ที่รอข้อความใหม่อยู่

function broadcast(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(msg);
  log.buf.push({ id: ++log.seq, obj });
  if (log.buf.length > 500) log.buf.shift();
  for (const w of waiters) w();
  for (const fn of taps) fn(obj);
}
function addClient(res) { clients.add(res); }
function removeClient(res) { clients.delete(res); }
function onBroadcast(fn) { taps.push(fn); }

// ข้อความหลัง id ที่ระบุ · ไม่มีใหม่ → รอได้ถึง waitMs แล้วตอบ (ว่าง) ให้ถามใหม่
function since(id, waitMs, cb) {
  const pick = () => log.buf.filter(m => m.id > id);
  const now = pick();
  if (now.length || id > log.seq) return cb(now, log.seq);
  let done = false;
  const finish = () => { if (done) return; done = true; waiters.delete(wake); clearTimeout(timer); cb(pick(), log.seq); };
  const wake = () => setTimeout(finish, 30);   // รวบข้อความที่มาติดกันเป็นชุดเดียว
  const timer = setTimeout(finish, waitMs);
  waiters.add(wake);
  return () => { done = true; waiters.delete(wake); clearTimeout(timer); };   // ยกเลิก (ผู้ชมปิดหน้า)
}

module.exports = { broadcast, addClient, removeClient, onBroadcast, since, clients, log };

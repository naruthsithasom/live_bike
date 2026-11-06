// ศูนย์กระจายข่าว (Server-Sent Events): ส่งเหตุการณ์ไปทุกหน้าเกม/แผงผู้ดูแลที่เปิดอยู่
const clients = new Set();
const taps = [];   // ตัวดักข้อความ (เช่น นับจำนวนเหตุการณ์ให้หน้า /monitor)

function broadcast(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(msg);
  for (const fn of taps) fn(obj);
}
function addClient(res) { clients.add(res); }
function removeClient(res) { clients.delete(res); }
function onBroadcast(fn) { taps.push(fn); }

module.exports = { broadcast, addClient, removeClient, onBroadcast, clients };

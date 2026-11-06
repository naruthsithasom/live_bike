// Model: สถานะล่าสุดที่หน้าเกมส่งมา (ให้หน้า /admin แสดงปุ่มที่เลือกอยู่)
const admin = { state: null, at: 0 };
function set(j) { admin.state = j; admin.at = Date.now(); }
function get() { return { ...(admin.state || {}), age: admin.at ? Date.now() - admin.at : -1 }; }
module.exports = { set, get };

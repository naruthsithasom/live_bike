# 🚵 MTB Endless Ride — เกมปั่นจักรยานสำหรับ TikTok LIVE

เกมปั่นจักรยานเสือภูเขามุมมอง POV บนเบราว์เซอร์ (จอแนวตั้ง 9:16) ที่ผู้ชม TikTok LIVE ควบคุมได้ด้วยการกดติดตาม ส่งของขวัญ ไลก์ และแชท

## เริ่มใช้งาน

```bash
npm install
npm start                    # หรือ npm start -- @ชื่อบัญชีTikTok
```

เปิด `http://localhost:3000` (เกม) และ `http://localhost:3000/admin` (แผงผู้ดูแล)
ครั้งแรกระบบจะสร้าง `config.json` จาก `config.example.json` ให้เอง

## โครงสร้างโปรเจกต์ (MVC)

```
server.js          จุดเริ่มโปรแกรม: เปิดเว็บเซิร์ฟเวอร์ + เชื่อมฐานข้อมูล + เชื่อม TikTok
config/            โหลด/บันทึก config.json (โหลดใหม่อัตโนมัติเมื่อไฟล์เปลี่ยน)
models/            ข้อมูล
  definitions.js     ตารางฐานข้อมูล (Sequelize) — สร้างตาราง/เพิ่มคอลัมน์อัตโนมัติ
  index.js           ฐานข้อมูล 2 ที่ (ในเครื่อง + โฮสต์) + ซิงก์
  viewer.js gift.js stage.js       ข้อมูลผู้ชม / ของขวัญ / ผลด่าน
  race.js live.js giftCatalog.js   สถานะการแข่ง / ไลฟ์ / รายการของขวัญ
  eventlog.js perf.js admin.js     log เหตุการณ์ / ประสิทธิภาพเครื่อง / สถานะแผงผู้ดูแล
controllers/       การทำงานแต่ละส่วน
  tiktokController   เชื่อม TikTok LIVE + แปลงเหตุการณ์เป็นคำสั่งเกม
  giftController     ของขวัญ · raceController โหมดแข่ง · adminController แผงผู้ดูแล
  liveController     ข่าวสด (SSE) + เชื่อม/ตัดไลฟ์ · statsController สถิติ
  eventlogController log เหตุการณ์ · pageController ส่งหน้าเว็บ
routes/            ที่อยู่ URL → controller
views/             หน้าเว็บ + ตัวเกม (game.js, index.html, monitor/followers/eventlog.html)
lib/               ตัวช่วยที่ใช้ร่วมกัน (SSE hub, HTTP, ข้อมูลผู้ใช้ TikTok)
logs/              log เหตุการณ์ TikTok รายวัน (ไม่ขึ้น git)
```

## ฐานข้อมูล

ใช้ MySQL/MariaDB ผ่าน **Sequelize** ได้ 2 ที่พร้อมกันแบบ local-first:

| ใน config.json | คือ | ทำงานยังไง |
|---|---|---|
| `db` | ฐานข้อมูลในเครื่อง (เช่น XAMPP) | บันทึก/อ่านทันที |
| `dbRemote` | ฐานข้อมูลบนโฮสต์ (shared hosting) | ส่งข้อมูลใหม่ขึ้นไปรวดเดียวทุก `syncSeconds` วินาที |

- ฐานข้อมูลในเครื่องปิดอยู่ → บันทึกตรงขึ้นโฮสต์แทน แล้วดึงกลับลงเครื่องเมื่อเปิดกลับมา
- เชื่อมไม่ได้ → ลองใหม่แบบเว้นระยะห่างขึ้นเรื่อยๆ (ไม่ยิงถี่จนโฮสต์มองเป็นการโจมตี)
- ไม่มีฐานข้อมูลเลย → เกมยังเล่นได้ แค่ไม่บันทึก
- ตาราง: `viewers` (ผู้ชม), `gifts` (ของขวัญ), `stage_results` (ผลแต่ละด่าน) — นิยามใน `models/definitions.js`

## ⚠️ ความปลอดภัย

- **`config.json` มีรหัสผ่านฐานข้อมูล ห้ามขึ้น git** (อยู่ใน `.gitignore` แล้ว) — ใช้ `config.example.json` เป็นแบบ
- **`logs/` มีชื่อและแชทของผู้ชมจริง** ห้ามเผยแพร่ (อยู่ใน `.gitignore` แล้ว)
- เซิร์ฟเวอร์ **ไม่มีระบบล็อกอิน** และเปิดให้เครื่องอื่นในวง Wi-Fi เดียวกันเข้าได้ (ให้มือถือเปิดเกมได้)
  คนในวงเน็ตเดียวกันสั่งแผงผู้ดูแล/ส่งของขวัญปลอม/ดู log ได้ → ใช้ในเครือข่ายที่ไว้ใจได้เท่านั้น
  **อย่าเปิดพอร์ต 3000 ออกอินเทอร์เน็ต**
- การเชื่อม TikTok LIVE ใช้ไลบรารีไม่เป็นทางการ (`tiktok-live-connector` + EulerStream) อาจใช้ไม่ได้ชั่วคราวเมื่อ TikTok เปลี่ยนระบบ

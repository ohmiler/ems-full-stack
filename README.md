# ระบบจัดการพนักงาน (EMS)

ระบบจัดการพนักงานแบบ full-stack: **Node.js (Express) + SQLite (better-sqlite3)** ฝั่ง server และ **React + Vite** ฝั่ง client

## ฟีเจอร์

- พนักงาน: เพิ่ม / แก้ไข / ลบ / ค้นหา / กรองตามแผนกและสถานะ / แบ่งหน้า
- แผนกและตำแหน่งงาน
- เข้าสู่ระบบ แบ่งสิทธิ์ **ผู้ดูแลระบบ (admin)** กับ **พนักงาน (employee)**
- การลา: พนักงานยื่นใบลา ผู้ดูแลระบบอนุมัติ / ไม่อนุมัติ
- ลงเวลาเข้า-ออกงาน
- หน้าภาพรวม (dashboard)

## เริ่มใช้งาน

ต้องใช้ Node.js 22 ขึ้นไป

```powershell
npm install
npm run setup   # สร้าง .env พร้อม JWT_SECRET และรหัสผ่าน admin แบบสุ่ม
npm run seed    # สร้างบัญชี admin + ข้อมูลตัวอย่าง
npm run dev     # server :3001 + client :5173
```

เปิด <http://localhost:5173> แล้วเข้าสู่ระบบด้วย `ADMIN_USERNAME` / `ADMIN_PASSWORD` ที่อยู่ในไฟล์ `.env`

พนักงานจะเข้าสู่ระบบได้เมื่อผู้ดูแลระบบสร้างบัญชีให้ (หน้า **พนักงาน** → ปุ่ม **บัญชี**)

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน server และ client พร้อมกัน (โหมดพัฒนา) |
| `npm test` | รันชุดทดสอบ API (ใช้ฐานข้อมูลในหน่วยความจำ) |
| `npm run build` | build client ไปที่ `client/dist` |
| `npm start` | รัน server อย่างเดียว — ถ้ามี `client/dist` จะเสิร์ฟหน้าเว็บให้ด้วยที่พอร์ต 3001 |

สำหรับ production ให้ตั้ง `NODE_ENV=production` (cookie จะถูกส่งเฉพาะผ่าน HTTPS)

## โครงสร้าง

```
server/src/
  app.js, index.js, config.js
  db/          connection.js, schema.sql, seed.js
  middleware/  auth.js (JWT ใน httpOnly cookie), validate.js (zod), error.js
  routes/      auth, employees, departments, positions, leaves, attendance, dashboard
server/test/   api.test.js
client/src/
  api/, context/, components/, lib/, pages/
```

ไฟล์ฐานข้อมูลอยู่ที่ `server/data/ems.db` (เปลี่ยนได้ด้วย `DB_PATH` ใน `.env`)

## สิทธิ์การใช้งาน

| | admin | employee |
|---|---|---|
| ดูรายชื่อพนักงาน แผนก ตำแหน่ง | ✔ | ✔ (ไม่เห็นเงินเดือนของคนอื่น) |
| เพิ่ม / แก้ไข / ลบ ข้อมูล | ✔ | ✖ |
| ยื่นใบลา / ลงเวลา | เฉพาะบัญชีที่ผูกกับพนักงาน | ✔ |
| อนุมัติการลา | ✔ | ✖ |
| ดูการลา / ลงเวลา | ทุกคน | ของตัวเอง |

## Deploy ขึ้น VPS (Ubuntu)

รันบน VPS ด้วย root — ใช้ได้ทั้งติดตั้งครั้งแรกและอัปเดตเวอร์ชันใหม่ (ไม่แตะ `.env` และฐานข้อมูลเดิม):

```bash
curl -fsSL https://raw.githubusercontent.com/ohmiler/ems-full-stack/main/deploy/install.sh | bash
```

- โค้ดอยู่ที่ `/opt/ems` รันด้วยผู้ใช้ `ems` ผ่าน systemd (`systemctl status ems`, `journalctl -u ems`)
- แอปฟังที่ `127.0.0.1:3001` เท่านั้น ต้องตั้ง reverse proxy (เช่น OpenLiteSpeed, Nginx, Caddy) พร้อม HTTPS ส่งต่อจากโดเมนมาที่พอร์ตนี้
- ชื่อผู้ใช้/รหัสผ่าน admin ถูกสุ่มตอนติดตั้งครั้งแรก ดูได้ที่ `/opt/ems/.env`
- ฐานข้อมูลอยู่ที่ `/opt/ems/server/data/ems.db` — สำรองไฟล์นี้เป็นระยะ

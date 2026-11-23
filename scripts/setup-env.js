// สร้างไฟล์ .env พร้อมค่า secret แบบสุ่ม (ไม่เขียนทับถ้ามีอยู่แล้ว)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.log('.env มีอยู่แล้ว — ไม่มีการเปลี่ยนแปลง');
  process.exit(0);
}

const content = [
  'API_PORT=3001',
  `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
  'ADMIN_USERNAME=admin',
  `ADMIN_PASSWORD=${crypto.randomBytes(9).toString('base64url')}`,
  '',
].join('\n');

fs.writeFileSync(envPath, content, { mode: 0o600 });
console.log('สร้าง .env แล้ว — ดูชื่อผู้ใช้/รหัสผ่าน admin ได้ในไฟล์ .env');

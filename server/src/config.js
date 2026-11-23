import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(serverRoot, '..');

// โหลด .env จาก root ของโปรเจกต์ (ค่าที่ตั้งใน environment อยู่แล้วมีสิทธิ์เหนือกว่า)
try {
  process.loadEnvFile(path.join(projectRoot, '.env'));
} catch {
  // ไม่มี .env — ใช้ค่าจาก environment อย่างเดียว
}

if (!process.env.JWT_SECRET) {
  console.error('ไม่พบ JWT_SECRET — รัน `npm run setup` เพื่อสร้างไฟล์ .env ก่อน');
  process.exit(1);
}

export const config = {
  // API_PORT มาก่อน PORT เพราะเครื่องมือ dev บางตัวตั้ง PORT ให้เป็นพอร์ตของหน้าเว็บ
  port: Number(process.env.API_PORT || process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET,
  dbPath: process.env.DB_PATH || path.join(serverRoot, 'data', 'ems.db'),
  isProd: process.env.NODE_ENV === 'production',
  clientDist: path.join(projectRoot, 'client', 'dist'),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
};

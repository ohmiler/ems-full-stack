import app from './app.js';
import db from './db/connection.js';
import { config } from './config.js';

const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
if (!hasUsers) {
  console.warn('ยังไม่มีบัญชีผู้ใช้ในระบบ — รัน `npm run seed` เพื่อสร้างบัญชี admin');
}

app.listen(config.port, config.host, () => {
  console.log(`EMS API พร้อมใช้งานที่ http://localhost:${config.port}`);
});

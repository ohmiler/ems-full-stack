import { HttpError } from '../utils.js';

export function notFound(_req, res) {
  res.status(404).json({ error: 'ไม่พบเส้นทางที่ร้องขอ' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' });
  }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ' });
  }
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(409).json({ error: 'ข้อมูลที่อ้างอิงไม่ถูกต้อง หรือยังถูกใช้งานอยู่' });
  }
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
}

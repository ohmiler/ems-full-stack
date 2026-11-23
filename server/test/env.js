// ต้อง import ไฟล์นี้ก่อน app เสมอ เพื่อให้ test ใช้ฐานข้อมูลในหน่วยความจำ
import crypto from 'node:crypto';

process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

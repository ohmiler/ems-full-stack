import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, issueToken, clearToken } from '../middleware/auth.js';
import { HttpError } from '../utils.js';

const router = Router();

// hash ปลอมไว้เทียบเมื่อไม่พบผู้ใช้ เพื่อให้เวลาตอบใกล้เคียงกัน (กันการเดาชื่อผู้ใช้จากเวลา)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// จำกัดจำนวนครั้งที่ login ผิดต่อ IP (เก็บในหน่วยความจำ)
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map();

function tooManyFails(ip) {
  const entry = fails.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    fails.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFail(ip) {
  const entry = fails.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) fails.set(ip, { count: 1, first: Date.now() });
  else entry.count += 1;
}

function publicUser(user) {
  const employee = user.employee_id
    ? db.prepare('SELECT id, employee_code, first_name, last_name FROM employees WHERE id = ?').get(user.employee_id)
    : null;
  return { id: user.id, username: user.username, role: user.role, employee };
}

const loginBody = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

router.post('/login', validate(loginBody), (req, res) => {
  if (tooManyFails(req.ip)) throw new HttpError(429, 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง');

  const { username, password } = req.valid.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  const ok = bcrypt.compareSync(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    recordFail(req.ip);
    throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  fails.delete(req.ip);
  issueToken(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearToken(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const changePasswordBody = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(8).max(200),
});

router.post('/change-password', requireAuth, validate(changePasswordBody), (req, res) => {
  const { current_password, new_password } = req.valid.body;
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, row.password_hash)) {
    throw new HttpError(400, 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), req.user.id);
  res.status(204).end();
});

export default router;

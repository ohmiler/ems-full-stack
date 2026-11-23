import jwt from 'jsonwebtoken';
import db from '../db/connection.js';
import { config } from '../config.js';
import { HttpError } from '../utils.js';

export const COOKIE_NAME = 'ems_token';
const MAX_AGE_SECONDS = 8 * 60 * 60;

export function issueToken(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: MAX_AGE_SECONDS });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: MAX_AGE_SECONDS * 1000,
  });
}

export function clearToken(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: config.isProd });
}

const findUser = db.prepare('SELECT id, username, role, employee_id FROM users WHERE id = ?');

export function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  // ตรวจกับฐานข้อมูลทุกครั้ง เพื่อให้บัญชีที่ถูกลบ/เปลี่ยนสิทธิ์มีผลทันที
  const user = findUser.get(payload.sub);
  if (!user) throw new HttpError(401, 'กรุณาเข้าสู่ระบบ');

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
    next();
  };
}

export const requireAdmin = requireRole('admin');

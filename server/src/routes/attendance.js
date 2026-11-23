import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { HttpError, dateString, queryParam, today, nowTime } from '../utils.js';

const router = Router();

function ownEmployeeId(req) {
  if (!req.user.employee_id) throw new HttpError(400, 'บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงลงเวลาไม่ได้');
  return req.user.employee_id;
}

const findToday = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?');

// สถานะการลงเวลาวันนี้ของผู้ใช้ปัจจุบัน
router.get('/today', (req, res) => {
  const record = req.user.employee_id ? findToday.get(req.user.employee_id, today()) : null;
  res.json({ date: today(), record: record ?? null, can_check: Boolean(req.user.employee_id) });
});

router.post('/check-in', (req, res) => {
  const employeeId = ownEmployeeId(req);
  const date = today();
  if (findToday.get(employeeId, date)) throw new HttpError(409, 'วันนี้ลงเวลาเข้างานไปแล้ว');

  db.prepare('INSERT INTO attendance (employee_id, work_date, check_in) VALUES (?, ?, ?)').run(employeeId, date, nowTime());
  res.status(201).json(findToday.get(employeeId, date));
});

router.post('/check-out', (req, res) => {
  const employeeId = ownEmployeeId(req);
  const date = today();
  const record = findToday.get(employeeId, date);
  if (!record) throw new HttpError(409, 'วันนี้ยังไม่ได้ลงเวลาเข้างาน');
  if (record.check_out) throw new HttpError(409, 'วันนี้ลงเวลาออกงานไปแล้ว');

  db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(nowTime(), record.id);
  res.json(findToday.get(employeeId, date));
});

const listQuery = z.object({
  from: queryParam(dateString),
  to: queryParam(dateString),
  employee_id: queryParam(z.coerce.number().int().positive()),
});

// admin: ดูได้ทุกคน (ค่าเริ่มต้น = วันนี้) / พนักงาน: เฉพาะของตัวเอง (ค่าเริ่มต้น = 30 วันล่าสุด)
router.get('/', validate(listQuery, 'query'), (req, res) => {
  const q = req.valid.query;
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !req.user.employee_id) return res.json([]);

  const defaultFrom = isAdmin ? today() : today(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const from = q.from ?? defaultFrom;
  const to = q.to ?? today();
  const employeeId = isAdmin ? q.employee_id : req.user.employee_id;

  const where = ['a.work_date BETWEEN ? AND ?'];
  const params = [from, to];
  if (employeeId) {
    where.push('a.employee_id = ?');
    params.push(employeeId);
  }

  res.json(
    db
      .prepare(`
        SELECT a.*, e.employee_code, e.first_name, e.last_name
        FROM attendance a JOIN employees e ON e.id = a.employee_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.work_date DESC, a.check_in DESC
        LIMIT 1000
      `)
      .all(...params),
  );
});

export default router;

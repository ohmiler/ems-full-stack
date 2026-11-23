import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError, dateString, idParam, queryParam } from '../utils.js';

const router = Router();

const SELECT = `
  SELECT l.*, e.employee_code, e.first_name, e.last_name, u.username AS reviewed_by_username
  FROM leave_requests l
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN users u ON u.id = l.reviewed_by
`;

const listQuery = z.object({
  status: queryParam(z.enum(['pending', 'approved', 'rejected'])),
});

// admin เห็นทุกคำขอ / พนักงานเห็นเฉพาะของตัวเอง
router.get('/', validate(listQuery, 'query'), (req, res) => {
  const { status } = req.valid.query;
  const where = [];
  const params = [];

  if (req.user.role !== 'admin') {
    if (!req.user.employee_id) return res.json([]);
    where.push('l.employee_id = ?');
    params.push(req.user.employee_id);
  }
  if (status) {
    where.push('l.status = ?');
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json(db.prepare(`${SELECT} ${whereSql} ORDER BY l.created_at DESC, l.id DESC`).all(...params));
});

const createBody = z
  .object({
    type: z.enum(['sick', 'personal', 'vacation']),
    start_date: dateString,
    end_date: dateString,
    reason: z.string().trim().max(500).nullish(),
  })
  .refine((b) => b.end_date >= b.start_date, {
    path: ['end_date'],
    message: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
  });

router.post('/', validate(createBody), (req, res) => {
  if (!req.user.employee_id) throw new HttpError(400, 'บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน จึงยื่นลาไม่ได้');
  const { type, start_date, end_date, reason } = req.valid.body;

  const overlap = db
    .prepare(`
      SELECT 1 FROM leave_requests
      WHERE employee_id = ? AND status != 'rejected' AND start_date <= ? AND end_date >= ?
    `)
    .get(req.user.employee_id, end_date, start_date);
  if (overlap) throw new HttpError(409, 'ช่วงวันที่นี้ซ้อนกับคำขอลาที่มีอยู่แล้ว');

  const info = db
    .prepare('INSERT INTO leave_requests (employee_id, type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.employee_id, type, start_date, end_date, reason || null);
  res.status(201).json(db.prepare(`${SELECT} WHERE l.id = ?`).get(info.lastInsertRowid));
});

const statusBody = z.object({ status: z.enum(['approved', 'rejected']) });

router.patch('/:id/status', requireAdmin, validate(idParam, 'params'), validate(statusBody), (req, res) => {
  const { id } = req.valid.params;
  const leave = db.prepare('SELECT status FROM leave_requests WHERE id = ?').get(id);
  if (!leave) throw new HttpError(404, 'ไม่พบคำขอลา');
  if (leave.status !== 'pending') throw new HttpError(409, 'คำขอนี้ถูกพิจารณาไปแล้ว');

  db.prepare('UPDATE leave_requests SET status = ?, reviewed_by = ? WHERE id = ?').run(req.valid.body.status, req.user.id, id);
  res.json(db.prepare(`${SELECT} WHERE l.id = ?`).get(id));
});

// พนักงานยกเลิกคำขอของตัวเองได้ตราบใดที่ยังรออนุมัติ
router.delete('/:id', validate(idParam, 'params'), (req, res) => {
  const { id } = req.valid.params;
  const leave = db.prepare('SELECT employee_id, status FROM leave_requests WHERE id = ?').get(id);
  const isOwner = leave && req.user.employee_id === leave.employee_id;
  if (!leave || (!isOwner && req.user.role !== 'admin')) throw new HttpError(404, 'ไม่พบคำขอลา');
  if (leave.status !== 'pending') throw new HttpError(409, 'ยกเลิกได้เฉพาะคำขอที่ยังรออนุมัติ');

  db.prepare('DELETE FROM leave_requests WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;

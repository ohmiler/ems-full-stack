import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError, dateString, idParam, optionalId, queryParam } from '../utils.js';

const router = Router();

const SELECT = `
  SELECT e.*, d.name AS department_name, p.title AS position_title
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN positions p ON p.id = e.position_id
`;

/** พนักงานทั่วไปเห็นเงินเดือนเฉพาะของตัวเอง */
function forViewer(row, user) {
  if (user.role === 'admin' || user.employee_id === row.id) return row;
  return { ...row, salary: null };
}

const listQuery = z.object({
  q: queryParam(z.string().trim().max(100)),
  department_id: queryParam(z.coerce.number().int().positive()),
  status: queryParam(z.enum(['active', 'resigned'])),
  page: queryParam(z.coerce.number().int().min(1)),
  limit: queryParam(z.coerce.number().int().min(1).max(100)),
});

router.get('/', validate(listQuery, 'query'), (req, res) => {
  const { q, department_id, status, page = 1, limit = 10 } = req.valid.query;
  const where = [];
  const params = [];

  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`(e.first_name LIKE ? ESCAPE '\\' OR e.last_name LIKE ? ESCAPE '\\'
      OR e.employee_code LIKE ? ESCAPE '\\' OR e.email LIKE ? ESCAPE '\\'
      OR (e.first_name || ' ' || e.last_name) LIKE ? ESCAPE '\\')`);
    params.push(like, like, like, like, like);
  }
  if (department_id) {
    where.push('e.department_id = ?');
    params.push(department_id);
  }
  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM employees e ${whereSql}`).get(...params).n;
  const rows = db
    .prepare(`${SELECT} ${whereSql} ORDER BY e.employee_code LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit);

  res.json({
    data: rows.map((r) => forViewer(r, req.user)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

function getOr404(id) {
  const row = db.prepare(`${SELECT} WHERE e.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'ไม่พบพนักงาน');
  return row;
}

router.get('/:id', validate(idParam, 'params'), (req, res) => {
  const row = forViewer(getOr404(req.valid.params.id), req.user);
  if (req.user.role === 'admin') {
    row.account = db.prepare('SELECT username FROM users WHERE employee_id = ?').get(row.id) ?? null;
  }
  res.json(row);
});

const employeeBody = z.object({
  employee_code: z.string().trim().min(1).max(20),
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  phone: z.string().trim().max(30).nullish(),
  department_id: optionalId,
  position_id: optionalId,
  salary: z.coerce.number().min(0).max(1e9).default(0),
  hire_date: dateString,
  status: z.enum(['active', 'resigned']).default('active'),
});

router.post('/', requireAdmin, validate(employeeBody), (req, res) => {
  const b = req.valid.body;
  const info = db
    .prepare(`
      INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, position_id, salary, hire_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(b.employee_code, b.first_name, b.last_name, b.email, b.phone || null, b.department_id, b.position_id, b.salary, b.hire_date, b.status);
  res.status(201).json(getOr404(info.lastInsertRowid));
});

router.put('/:id', requireAdmin, validate(idParam, 'params'), validate(employeeBody), (req, res) => {
  const { id } = req.valid.params;
  const b = req.valid.body;
  getOr404(id);
  db.prepare(`
    UPDATE employees SET employee_code = ?, first_name = ?, last_name = ?, email = ?, phone = ?,
      department_id = ?, position_id = ?, salary = ?, hire_date = ?, status = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(b.employee_code, b.first_name, b.last_name, b.email, b.phone || null, b.department_id, b.position_id, b.salary, b.hire_date, b.status, id);
  res.json(getOr404(id));
});

// ลบพนักงาน: บัญชีผู้ใช้ ประวัติการลา และการลงเวลาของคนนั้นจะถูกลบตาม (ON DELETE CASCADE)
router.delete('/:id', requireAdmin, validate(idParam, 'params'), (req, res) => {
  const { id } = req.valid.params;
  getOr404(id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
  res.status(204).end();
});

const accountBody = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'ใช้ได้เฉพาะ a-z, 0-9, จุด, ขีด และขีดล่าง'),
  password: z.string().min(8).max(200),
});

// สร้างบัญชีผู้ใช้ให้พนักงาน หรือเปลี่ยนชื่อผู้ใช้/รีเซ็ตรหัสผ่านถ้ามีอยู่แล้ว
router.put('/:id/account', requireAdmin, validate(idParam, 'params'), validate(accountBody), (req, res) => {
  const { id } = req.valid.params;
  const { username, password } = req.valid.body;
  getOr404(id);
  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, existing.id);
  } else {
    db.prepare("INSERT INTO users (username, password_hash, role, employee_id) VALUES (?, ?, 'employee', ?)").run(username, hash, id);
  }
  res.json({ username });
});

router.delete('/:id/account', requireAdmin, validate(idParam, 'params'), (req, res) => {
  db.prepare('DELETE FROM users WHERE employee_id = ?').run(req.valid.params.id);
  res.status(204).end();
});

export default router;

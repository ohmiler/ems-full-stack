import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError, idParam, optionalId } from '../utils.js';

const router = Router();

const SELECT = `
  SELECT p.*, d.name AS department_name,
    (SELECT COUNT(*) FROM employees e WHERE e.position_id = p.id) AS employee_count
  FROM positions p LEFT JOIN departments d ON d.id = p.department_id
`;

router.get('/', (_req, res) => {
  res.json(db.prepare(`${SELECT} ORDER BY d.name, p.title`).all());
});

const body = z.object({
  title: z.string().trim().min(1).max(100),
  department_id: optionalId,
});

router.post('/', requireAdmin, validate(body), (req, res) => {
  const { title, department_id } = req.valid.body;
  const info = db.prepare('INSERT INTO positions (title, department_id) VALUES (?, ?)').run(title, department_id);
  res.status(201).json(db.prepare(`${SELECT} WHERE p.id = ?`).get(info.lastInsertRowid));
});

router.put('/:id', requireAdmin, validate(idParam, 'params'), validate(body), (req, res) => {
  const { id } = req.valid.params;
  const { title, department_id } = req.valid.body;
  const info = db.prepare('UPDATE positions SET title = ?, department_id = ? WHERE id = ?').run(title, department_id, id);
  if (!info.changes) throw new HttpError(404, 'ไม่พบตำแหน่ง');
  res.json(db.prepare(`${SELECT} WHERE p.id = ?`).get(id));
});

router.delete('/:id', requireAdmin, validate(idParam, 'params'), (req, res) => {
  const { id } = req.valid.params;
  const used = db.prepare('SELECT COUNT(*) AS n FROM employees WHERE position_id = ?').get(id).n;
  if (used) throw new HttpError(409, 'ลบไม่ได้ เนื่องจากยังมีพนักงานอยู่ในตำแหน่งนี้');
  const info = db.prepare('DELETE FROM positions WHERE id = ?').run(id);
  if (!info.changes) throw new HttpError(404, 'ไม่พบตำแหน่ง');
  res.status(204).end();
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import db from '../db/connection.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { HttpError, idParam } from '../utils.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(
    db
      .prepare(`
        SELECT d.*,
          (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id) AS employee_count,
          (SELECT COUNT(*) FROM positions p WHERE p.department_id = d.id) AS position_count
        FROM departments d ORDER BY d.name
      `)
      .all(),
  );
});

const body = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
});

router.post('/', requireAdmin, validate(body), (req, res) => {
  const { name, description } = req.valid.body;
  const info = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, description || null);
  res.status(201).json(db.prepare('SELECT * FROM departments WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', requireAdmin, validate(idParam, 'params'), validate(body), (req, res) => {
  const { id } = req.valid.params;
  const { name, description } = req.valid.body;
  const info = db.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
  if (!info.changes) throw new HttpError(404, 'ไม่พบแผนก');
  res.json(db.prepare('SELECT * FROM departments WHERE id = ?').get(id));
});

router.delete('/:id', requireAdmin, validate(idParam, 'params'), (req, res) => {
  const { id } = req.valid.params;
  const used = db
    .prepare(`
      SELECT (SELECT COUNT(*) FROM employees WHERE department_id = @id)
           + (SELECT COUNT(*) FROM positions WHERE department_id = @id) AS n
    `)
    .get({ id }).n;
  if (used) throw new HttpError(409, 'ลบไม่ได้ เนื่องจากยังมีพนักงานหรือตำแหน่งอยู่ในแผนกนี้');
  const info = db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  if (!info.changes) throw new HttpError(404, 'ไม่พบแผนก');
  res.status(204).end();
});

export default router;

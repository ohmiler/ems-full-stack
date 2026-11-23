import { Router } from 'express';
import db from '../db/connection.js';
import { today } from '../utils.js';

const router = Router();

const count = (sql, ...params) => db.prepare(sql).get(...params).n;

router.get('/summary', (req, res) => {
  const date = today();

  if (req.user.role === 'admin') {
    return res.json({
      role: 'admin',
      date,
      active_employees: count("SELECT COUNT(*) AS n FROM employees WHERE status = 'active'"),
      resigned_employees: count("SELECT COUNT(*) AS n FROM employees WHERE status = 'resigned'"),
      departments: count('SELECT COUNT(*) AS n FROM departments'),
      pending_leaves: count("SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending'"),
      checked_in_today: count('SELECT COUNT(*) AS n FROM attendance WHERE work_date = ?', date),
      on_leave_today: count(
        "SELECT COUNT(DISTINCT employee_id) AS n FROM leave_requests WHERE status = 'approved' AND ? BETWEEN start_date AND end_date",
        date,
      ),
      by_department: db
        .prepare(`
          SELECT COALESCE(d.name, 'ไม่ระบุแผนก') AS name, COUNT(e.id) AS count
          FROM employees e LEFT JOIN departments d ON d.id = e.department_id
          WHERE e.status = 'active'
          GROUP BY d.id ORDER BY count DESC, name
        `)
        .all(),
      recent_leaves: db
        .prepare(`
          SELECT l.id, l.type, l.start_date, l.end_date, l.status, e.first_name, e.last_name
          FROM leave_requests l JOIN employees e ON e.id = l.employee_id
          ORDER BY l.created_at DESC, l.id DESC LIMIT 5
        `)
        .all(),
    });
  }

  const employeeId = req.user.employee_id;
  res.json({
    role: 'employee',
    date,
    today_attendance: employeeId
      ? db.prepare('SELECT check_in, check_out FROM attendance WHERE employee_id = ? AND work_date = ?').get(employeeId, date) ?? null
      : null,
    my_pending_leaves: employeeId
      ? count("SELECT COUNT(*) AS n FROM leave_requests WHERE employee_id = ? AND status = 'pending'", employeeId)
      : 0,
    my_approved_leave_days: employeeId
      ? count(
          `SELECT COALESCE(SUM(julianday(end_date) - julianday(start_date) + 1), 0) AS n
           FROM leave_requests WHERE employee_id = ? AND status = 'approved' AND substr(start_date, 1, 4) = ?`,
          employeeId,
          date.slice(0, 4),
        )
      : 0,
    my_attendance_this_month: employeeId
      ? count('SELECT COUNT(*) AS n FROM attendance WHERE employee_id = ? AND substr(work_date, 1, 7) = ?', employeeId, date.slice(0, 7))
      : 0,
  });
});

export default router;

import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import db from './connection.js';
import { config } from '../config.js';

const SAMPLE_DEPARTMENTS = [
  ['ฝ่ายบุคคล', 'สรรหา ดูแลสวัสดิการ และพัฒนาบุคลากร'],
  ['ฝ่ายไอที', 'พัฒนาและดูแลระบบสารสนเทศ'],
  ['ฝ่ายบัญชี', 'บัญชี การเงิน และงบประมาณ'],
  ['ฝ่ายขาย', 'ขายและดูแลลูกค้า'],
];

const SAMPLE_POSITIONS = [
  ['เจ้าหน้าที่ฝ่ายบุคคล', 'ฝ่ายบุคคล'],
  ['ผู้จัดการฝ่ายบุคคล', 'ฝ่ายบุคคล'],
  ['นักพัฒนาซอฟต์แวร์', 'ฝ่ายไอที'],
  ['ผู้ดูแลระบบ', 'ฝ่ายไอที'],
  ['นักบัญชี', 'ฝ่ายบัญชี'],
  ['พนักงานขาย', 'ฝ่ายขาย'],
];

const SAMPLE_EMPLOYEES = [
  ['EMP001', 'สมชาย', 'ใจดี', 'somchai@example.com', '081-000-0001', 'ฝ่ายไอที', 'นักพัฒนาซอฟต์แวร์', 45000, '2022-03-01'],
  ['EMP002', 'สมหญิง', 'รักงาน', 'somying@example.com', '081-000-0002', 'ฝ่ายบุคคล', 'ผู้จัดการฝ่ายบุคคล', 60000, '2020-06-15'],
  ['EMP003', 'วิชัย', 'มั่นคง', 'wichai@example.com', '081-000-0003', 'ฝ่ายบัญชี', 'นักบัญชี', 38000, '2023-01-10'],
  ['EMP004', 'มานี', 'สุขใจ', 'manee@example.com', '081-000-0004', 'ฝ่ายขาย', 'พนักงานขาย', 30000, '2024-08-01'],
  ['EMP005', 'ปิติ', 'ยินดี', 'piti@example.com', '081-000-0005', 'ฝ่ายไอที', 'ผู้ดูแลระบบ', 42000, '2021-11-20'],
];

/**
 * สร้างบัญชี admin (ถ้ายังไม่มี) และข้อมูลตัวอย่าง (ถ้าตารางยังว่าง)
 */
export function seed({ adminUsername, adminPassword, sample = true }) {
  const result = { adminCreated: false, sampleCreated: false };

  db.transaction(() => {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
    if (!existing) {
      if (!adminPassword || adminPassword.length < 8) {
        throw new Error('ADMIN_PASSWORD ต้องมีอย่างน้อย 8 ตัวอักษร');
      }
      db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
        adminUsername,
        bcrypt.hashSync(adminPassword, 10),
      );
      result.adminCreated = true;
    }

    const hasDepartments = db.prepare('SELECT COUNT(*) AS n FROM departments').get().n > 0;
    if (sample && !hasDepartments) {
      const insDept = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
      const deptIds = {};
      for (const [name, description] of SAMPLE_DEPARTMENTS) {
        deptIds[name] = insDept.run(name, description).lastInsertRowid;
      }

      const insPos = db.prepare('INSERT INTO positions (title, department_id) VALUES (?, ?)');
      const posIds = {};
      for (const [title, dept] of SAMPLE_POSITIONS) {
        posIds[title] = insPos.run(title, deptIds[dept]).lastInsertRowid;
      }

      const insEmp = db.prepare(`
        INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, position_id, salary, hire_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [code, first, last, email, phone, dept, pos, salary, hired] of SAMPLE_EMPLOYEES) {
        insEmp.run(code, first, last, email, phone, deptIds[dept], posIds[pos], salary, hired);
      }
      result.sampleCreated = true;
    }
  })();

  return result;
}

// รันตรง ๆ ด้วย `npm run seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const r = seed({ adminUsername: config.adminUsername, adminPassword: config.adminPassword });
    console.log(r.adminCreated ? `สร้างบัญชี admin "${config.adminUsername}" แล้ว (รหัสผ่านตาม ADMIN_PASSWORD ใน .env)` : 'บัญชี admin มีอยู่แล้ว');
    console.log(r.sampleCreated ? 'เพิ่มข้อมูลตัวอย่างแล้ว' : 'ข้ามข้อมูลตัวอย่าง (มีข้อมูลอยู่แล้ว)');
  } catch (err) {
    console.error(`seed ไม่สำเร็จ: ${err.message}`);
    process.exit(1);
  }
}

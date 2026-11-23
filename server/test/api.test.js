import './env.js';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../src/app.js';
import { seed } from '../src/db/seed.js';

const adminPassword = crypto.randomBytes(12).toString('base64url');
const staffPassword = crypto.randomBytes(12).toString('base64url');

const admin = request.agent(app);
const staff = request.agent(app);
let staffEmployeeId;

before(async () => {
  seed({ adminUsername: 'admin', adminPassword });
  await admin.post('/api/auth/login').send({ username: 'admin', password: adminPassword }).expect(200);

  // ผูกบัญชี employee กับพนักงานตัวอย่าง EMP001
  const list = await admin.get('/api/employees?q=EMP001').expect(200);
  staffEmployeeId = list.body.data[0].id;
  await admin.put(`/api/employees/${staffEmployeeId}/account`).send({ username: 'somchai', password: staffPassword }).expect(200);
  await staff.post('/api/auth/login').send({ username: 'somchai', password: staffPassword }).expect(200);
});

test('auth: ต้อง login ก่อนเรียก API', async () => {
  await request(app).get('/api/employees').expect(401);
});

test('auth: รหัสผ่านผิดได้ 401 และไม่ตั้ง cookie', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-password' }).expect(401);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('auth: cookie เป็น httpOnly และ /me คืนข้อมูลผู้ใช้', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: adminPassword }).expect(200);
  assert.match(res.headers['set-cookie'][0], /HttpOnly/);
  assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);
  assert.equal(res.body.user.password_hash, undefined);

  const me = await staff.get('/api/auth/me').expect(200);
  assert.equal(me.body.user.role, 'employee');
  assert.equal(me.body.user.employee.employee_code, 'EMP001');
});

test('auth: token ปลอมถูกปฏิเสธ', async () => {
  await request(app).get('/api/auth/me').set('Cookie', 'ems_token=not.a.jwt').expect(401);
});

test('employees: ค้นหา กรอง และแบ่งหน้า', async () => {
  const all = await admin.get('/api/employees?limit=2').expect(200);
  assert.equal(all.body.total, 5);
  assert.equal(all.body.data.length, 2);
  assert.equal(all.body.pages, 3);

  const search = await admin.get(`/api/employees?q=${encodeURIComponent('สมหญิง')}`).expect(200);
  assert.equal(search.body.total, 1);
  assert.equal(search.body.data[0].employee_code, 'EMP002');

  // อักขระ wildcard ของ LIKE ต้องถูก escape
  const wildcard = await admin.get('/api/employees?q=%25').expect(200);
  assert.equal(wildcard.body.total, 0);

  // พารามิเตอร์ว่างต้องไม่ทำให้ validation ล้ม
  await admin.get('/api/employees?q=&department_id=&status=').expect(200);
});

test('employees: admin เพิ่ม/แก้ไข/ลบได้ และข้อมูลซ้ำได้ 409', async () => {
  const body = {
    employee_code: 'EMP100',
    first_name: 'ทดสอบ',
    last_name: 'ระบบ',
    email: 'test100@example.com',
    hire_date: '2025-01-15',
    salary: 25000,
    department_id: '',
    position_id: null,
  };
  const created = await admin.post('/api/employees').send(body).expect(201);
  assert.equal(created.body.department_id, null);
  assert.equal(created.body.status, 'active');

  await admin.post('/api/employees').send(body).expect(409);

  const updated = await admin
    .put(`/api/employees/${created.body.id}`)
    .send({ ...body, first_name: 'แก้ไขแล้ว', status: 'resigned' })
    .expect(200);
  assert.equal(updated.body.first_name, 'แก้ไขแล้ว');
  assert.equal(updated.body.status, 'resigned');

  await admin.delete(`/api/employees/${created.body.id}`).expect(204);
  await admin.get(`/api/employees/${created.body.id}`).expect(404);
});

test('employees: validation ปฏิเสธข้อมูลไม่ครบ', async () => {
  const res = await admin.post('/api/employees').send({ employee_code: 'X', email: 'not-an-email' }).expect(400);
  assert.ok(res.body.details.some((d) => d.field === 'email'));
  assert.ok(res.body.details.some((d) => d.field === 'first_name'));
});

test('สิทธิ์: employee แก้ไขข้อมูลไม่ได้ (403)', async () => {
  await staff.post('/api/employees').send({}).expect(403);
  await staff.delete(`/api/employees/${staffEmployeeId}`).expect(403);
  await staff.post('/api/departments').send({ name: 'x' }).expect(403);
  await staff.put(`/api/employees/${staffEmployeeId}/account`).send({ username: 'hacker', password: 'password123' }).expect(403);
});

test('สิทธิ์: employee เห็นเงินเดือนเฉพาะของตัวเอง', async () => {
  const res = await staff.get('/api/employees?limit=100').expect(200);
  for (const e of res.body.data) {
    if (e.id === staffEmployeeId) assert.equal(e.salary, 45000);
    else assert.equal(e.salary, null);
  }
  const other = res.body.data.find((e) => e.id !== staffEmployeeId);
  const detail = await staff.get(`/api/employees/${other.id}`).expect(200);
  assert.equal(detail.body.salary, null);
  assert.equal(detail.body.account, undefined);
});

test('departments/positions: CRUD และห้ามลบเมื่อยังถูกใช้งาน', async () => {
  const depts = await admin.get('/api/departments').expect(200);
  const it = depts.body.find((d) => d.name === 'ฝ่ายไอที');
  assert.equal(it.employee_count, 2);
  await admin.delete(`/api/departments/${it.id}`).expect(409);

  const dept = await admin.post('/api/departments').send({ name: 'ฝ่ายการตลาด' }).expect(201);
  await admin.post('/api/departments').send({ name: 'ฝ่ายการตลาด' }).expect(409);

  const pos = await admin.post('/api/positions').send({ title: 'นักการตลาด', department_id: dept.body.id }).expect(201);
  assert.equal(pos.body.department_name, 'ฝ่ายการตลาด');
  await admin.delete(`/api/departments/${dept.body.id}`).expect(409);

  await admin.delete(`/api/positions/${pos.body.id}`).expect(204);
  await admin.delete(`/api/departments/${dept.body.id}`).expect(204);
  await admin.delete(`/api/departments/${dept.body.id}`).expect(404);
});

test('leaves: ยื่นลา → admin อนุมัติ และพิจารณาซ้ำไม่ได้', async () => {
  await staff.post('/api/leaves').send({ type: 'sick', start_date: '2026-12-05', end_date: '2026-12-01' }).expect(400);
  await admin.post('/api/leaves').send({ type: 'sick', start_date: '2026-12-01', end_date: '2026-12-01' }).expect(400);

  const leave = await staff
    .post('/api/leaves')
    .send({ type: 'vacation', start_date: '2026-12-01', end_date: '2026-12-03', reason: 'พักร้อน' })
    .expect(201);
  assert.equal(leave.body.status, 'pending');

  // ช่วงวันที่ซ้อนกัน
  await staff.post('/api/leaves').send({ type: 'sick', start_date: '2026-12-03', end_date: '2026-12-04' }).expect(409);

  await staff.patch(`/api/leaves/${leave.body.id}/status`).send({ status: 'approved' }).expect(403);

  const approved = await admin.patch(`/api/leaves/${leave.body.id}/status`).send({ status: 'approved' }).expect(200);
  assert.equal(approved.body.status, 'approved');
  assert.equal(approved.body.reviewed_by_username, 'admin');

  await admin.patch(`/api/leaves/${leave.body.id}/status`).send({ status: 'rejected' }).expect(409);
  await staff.delete(`/api/leaves/${leave.body.id}`).expect(409);

  const mine = await staff.get('/api/leaves').expect(200);
  assert.equal(mine.body.length, 1);
});

test('leaves: employee มองไม่เห็นและยกเลิกคำขอของคนอื่นไม่ได้', async () => {
  const otherPassword = crypto.randomBytes(12).toString('base64url');
  const list = await admin.get('/api/employees?q=EMP002').expect(200);
  await admin.put(`/api/employees/${list.body.data[0].id}/account`).send({ username: 'somying', password: otherPassword }).expect(200);
  const other = request.agent(app);
  await other.post('/api/auth/login').send({ username: 'somying', password: otherPassword }).expect(200);

  const leave = await other.post('/api/leaves').send({ type: 'personal', start_date: '2027-01-10', end_date: '2027-01-10' }).expect(201);

  const mine = await staff.get('/api/leaves').expect(200);
  assert.ok(!mine.body.some((l) => l.id === leave.body.id));
  await staff.delete(`/api/leaves/${leave.body.id}`).expect(404);

  await other.delete(`/api/leaves/${leave.body.id}`).expect(204);
});

test('attendance: ลงเวลาเข้า-ออก และลงซ้ำไม่ได้', async () => {
  await staff.post('/api/attendance/check-out').expect(409);
  await admin.post('/api/attendance/check-in').expect(400);

  const checkIn = await staff.post('/api/attendance/check-in').expect(201);
  assert.match(checkIn.body.check_in, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(checkIn.body.check_out, null);
  await staff.post('/api/attendance/check-in').expect(409);

  const checkOut = await staff.post('/api/attendance/check-out').expect(200);
  assert.match(checkOut.body.check_out, /^\d{2}:\d{2}:\d{2}$/);
  await staff.post('/api/attendance/check-out').expect(409);

  const todayStatus = await staff.get('/api/attendance/today').expect(200);
  assert.equal(todayStatus.body.record.id, checkIn.body.id);

  const adminView = await admin.get('/api/attendance').expect(200);
  assert.equal(adminView.body.length, 1);
  assert.equal(adminView.body[0].employee_code, 'EMP001');
});

test('dashboard: สรุปต่างกันตามสิทธิ์', async () => {
  const a = await admin.get('/api/dashboard/summary').expect(200);
  assert.equal(a.body.role, 'admin');
  assert.equal(a.body.active_employees, 5);
  assert.equal(a.body.checked_in_today, 1);
  assert.equal(a.body.by_department.reduce((s, d) => s + d.count, 0), 5);

  const s = await staff.get('/api/dashboard/summary').expect(200);
  assert.equal(s.body.role, 'employee');
  assert.equal(s.body.active_employees, undefined);
  assert.equal(s.body.my_approved_leave_days, 3);
});

test('auth: เปลี่ยนรหัสผ่าน และลบบัญชีแล้ว session ใช้ไม่ได้ทันที', async () => {
  const newPassword = crypto.randomBytes(12).toString('base64url');
  await staff.post('/api/auth/change-password').send({ current_password: 'wrong', new_password: newPassword }).expect(400);
  await staff.post('/api/auth/change-password').send({ current_password: staffPassword, new_password: 'short' }).expect(400);
  await staff.post('/api/auth/change-password').send({ current_password: staffPassword, new_password: newPassword }).expect(204);

  await request(app).post('/api/auth/login').send({ username: 'somchai', password: staffPassword }).expect(401);
  await request(app).post('/api/auth/login').send({ username: 'somchai', password: newPassword }).expect(200);

  await admin.delete(`/api/employees/${staffEmployeeId}/account`).expect(204);
  await staff.get('/api/auth/me').expect(401);
});

test('เส้นทาง /api ที่ไม่มีอยู่ได้ 404 แบบ JSON', async () => {
  const res = await admin.get('/api/nope').expect(404);
  assert.ok(res.body.error);
});

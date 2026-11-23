import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import departmentRoutes from './routes/departments.js';
import positionRoutes from './routes/positions.js';
import leaveRoutes from './routes/leaves.js';
import attendanceRoutes from './routes/attendance.js';
import dashboardRoutes from './routes/dashboard.js';

// ข้อความ validation เป็นภาษาไทย
z.config(z.locales.th());

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/departments', requireAuth, departmentRoutes);
app.use('/api/positions', requireAuth, positionRoutes);
app.use('/api/leaves', requireAuth, leaveRoutes);
app.use('/api/attendance', requireAuth, attendanceRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api', notFound);

// production: เสิร์ฟ React ที่ build แล้ว และให้ทุกเส้นทางที่ไม่ใช่ /api กลับไปที่ index.html
if (fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  app.use(express.static(config.clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;

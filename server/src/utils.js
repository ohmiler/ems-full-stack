import { z } from 'zod';

const pad = (n) => String(n).padStart(2, '0');

/** วันที่วันนี้ตามเวลาเครื่อง server รูปแบบ YYYY-MM-DD */
export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** เวลาปัจจุบันตามเวลาเครื่อง server รูปแบบ HH:MM:SS */
export function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// zod schema ที่ใช้ร่วมกันหลาย route
export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'วันที่ไม่ถูกต้อง');

export const idParam = z.object({ id: z.coerce.number().int().positive() });

const blankToNull = (v) => (v === '' || v === undefined || v === null ? null : v);
const blankToUndefined = (v) => (v === '' || v === null ? undefined : v);

/** id ที่เว้นว่างได้ (ค่าว่าง/ไม่ส่ง = null) — ใช้ใน body */
export const optionalId = z.preprocess(blankToNull, z.coerce.number().int().positive().nullable());

/** ห่อ schema สำหรับ query string: ค่าว่าง "" ถือว่าไม่ได้ส่งมา */
export const queryParam = (schema) => z.preprocess(blankToUndefined, schema.optional());

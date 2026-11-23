const dateFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const moneyFmt = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });

/** แปลง 'YYYY-MM-DD' เป็นวันที่แบบไทย (พ.ศ.) */
export function formatDate(s) {
  if (!s) return '-';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

export function formatMoney(n) {
  return n === null || n === undefined ? '-' : moneyFmt.format(n);
}

export function formatTime(t) {
  return t ? t.slice(0, 5) : '-';
}

/** วันที่วันนี้ของเครื่องผู้ใช้ รูปแบบ YYYY-MM-DD (สำหรับ input type="date") */
export function todayInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(start, end) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
}

export const LEAVE_TYPES = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน' };
export const LEAVE_STATUS = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' };
export const EMPLOYEE_STATUS = { active: 'ทำงานอยู่', resigned: 'ลาออกแล้ว' };

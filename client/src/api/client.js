export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** เรียก API ฝั่ง server — cookie สำหรับยืนยันตัวตนถูกแนบให้อัตโนมัติ */
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 0);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    let message = data?.error || (res.status >= 502 ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : 'เกิดข้อผิดพลาด');
    if (data?.details?.length) {
      message += ` — ${data.details.map((d) => `${d.field}: ${d.message}`).join(', ')}`;
    }
    throw new ApiError(message, res.status);
  }
  return data;
}

/** สร้าง query string โดยข้ามค่าที่ว่าง */
export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

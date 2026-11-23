import { useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { formatDate, formatTime, todayInput } from '../lib/format.js';

function TodayCard({ onChanged }) {
  const today = useFetch('/attendance/today');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const record = today.data?.record;

  async function check(action) {
    setBusy(true);
    setError('');
    try {
      await api(`/attendance/${action}`, { method: 'POST' });
      today.reload();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!today.data) return null;

  return (
    <section className="card today-card">
      <div>
        <h2>วันนี้ · {formatDate(today.data.date)}</h2>
        <div className="today-times">
          <div>
            <span className="muted small">เข้างาน</span>
            <strong>{formatTime(record?.check_in)}</strong>
          </div>
          <div>
            <span className="muted small">ออกงาน</span>
            <strong>{formatTime(record?.check_out)}</strong>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
      </div>
      <div className="today-actions">
        {!record && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => check('check-in')}>
            ลงเวลาเข้างาน
          </button>
        )}
        {record && !record.check_out && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => check('check-out')}>
            ลงเวลาออกงาน
          </button>
        )}
        {record?.check_out && <span className="badge approved">ลงเวลาครบแล้ว</span>}
      </div>
    </section>
  );
}

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const [range, setRange] = useState(() => (isAdmin ? { from: todayInput(), to: todayInput() } : { from: '', to: '' }));
  const list = useFetch(`/attendance${qs(range)}`);
  const setDate = (k) => (e) => setRange((r) => ({ ...r, [k]: e.target.value }));

  return (
    <>
      <header className="page-header">
        <div>
          <h1>ลงเวลา</h1>
          <p className="muted">{isAdmin ? 'บันทึกการเข้า-ออกงานของพนักงาน' : 'ประวัติการเข้า-ออกงานของคุณ (ค่าเริ่มต้น 30 วันล่าสุด)'}</p>
        </div>
      </header>

      {user.employee && <TodayCard onChanged={list.reload} />}

      <div className="toolbar">
        <label className="inline-field">
          <span>ตั้งแต่</span>
          <input type="date" value={range.from} max={range.to || undefined} onChange={setDate('from')} />
        </label>
        <label className="inline-field">
          <span>ถึง</span>
          <input type="date" value={range.to} min={range.from || undefined} onChange={setDate('to')} />
        </label>
      </div>

      {list.error && <div className="alert error">{list.error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>วันที่</th>
              {isAdmin && <th>พนักงาน</th>}
              <th>เข้างาน</th>
              <th>ออกงาน</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((a) => (
              <tr key={a.id}>
                <td>{formatDate(a.work_date)}</td>
                {isAdmin && (
                  <td>
                    <strong>
                      {a.first_name} {a.last_name}
                    </strong>
                    <div className="muted small">{a.employee_code}</div>
                  </td>
                )}
                <td>{formatTime(a.check_in)}</td>
                <td>{formatTime(a.check_out)}</td>
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  ไม่มีข้อมูลการลงเวลาในช่วงวันที่นี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

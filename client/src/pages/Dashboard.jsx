import { Link } from 'react-router-dom';
import { useFetch } from '../lib/useFetch.js';
import { formatDate, formatTime, LEAVE_STATUS, LEAVE_TYPES } from '../lib/format.js';

function Stat({ label, value, hint, to }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </>
  );
  return to ? (
    <Link className="card stat" to={to}>
      {body}
    </Link>
  ) : (
    <div className="card stat">{body}</div>
  );
}

function AdminDashboard({ s }) {
  const max = Math.max(1, ...s.by_department.map((d) => d.count));
  return (
    <>
      <div className="stat-grid">
        <Stat label="พนักงานที่ทำงานอยู่" value={s.active_employees} hint={`ลาออกแล้ว ${s.resigned_employees} คน`} to="/employees" />
        <Stat label="แผนก" value={s.departments} to="/departments" />
        <Stat label="เข้างานวันนี้" value={s.checked_in_today} hint={`ลาวันนี้ ${s.on_leave_today} คน`} to="/attendance" />
        <Stat label="คำขอลารออนุมัติ" value={s.pending_leaves} to="/leaves" />
      </div>

      <div className="two-col">
        <section className="card">
          <h2>พนักงานตามแผนก</h2>
          {s.by_department.length === 0 && <p className="muted">ยังไม่มีข้อมูล</p>}
          <div className="bars">
            {s.by_department.map((d) => (
              <div className="bar-row" key={d.name}>
                <span className="bar-label">{d.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
                </div>
                <span className="bar-value">{d.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>คำขอลาล่าสุด</h2>
          {s.recent_leaves.length === 0 && <p className="muted">ยังไม่มีคำขอลา</p>}
          <ul className="simple-list">
            {s.recent_leaves.map((l) => (
              <li key={l.id}>
                <div>
                  <strong>
                    {l.first_name} {l.last_name}
                  </strong>
                  <div className="muted small">
                    {LEAVE_TYPES[l.type]} · {formatDate(l.start_date)}
                    {l.end_date !== l.start_date && ` – ${formatDate(l.end_date)}`}
                  </div>
                </div>
                <span className={`badge ${l.status}`}>{LEAVE_STATUS[l.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function EmployeeDashboard({ s }) {
  const a = s.today_attendance;
  return (
    <div className="stat-grid">
      <Stat
        label="ลงเวลาวันนี้"
        value={a ? formatTime(a.check_in) : 'ยังไม่ลงเวลา'}
        hint={a ? (a.check_out ? `ออกงาน ${formatTime(a.check_out)}` : 'ยังไม่ลงเวลาออก') : 'กดเพื่อลงเวลาเข้างาน'}
        to="/attendance"
      />
      <Stat label="มาทำงานเดือนนี้" value={`${s.my_attendance_this_month} วัน`} to="/attendance" />
      <Stat label="คำขอลารออนุมัติ" value={s.my_pending_leaves} to="/leaves" />
      <Stat label="วันลาที่อนุมัติแล้วปีนี้" value={`${s.my_approved_leave_days} วัน`} to="/leaves" />
    </div>
  );
}

export default function Dashboard() {
  const { data, error, loading } = useFetch('/dashboard/summary');

  return (
    <>
      <header className="page-header">
        <div>
          <h1>ภาพรวม</h1>
          {data && <p className="muted">ข้อมูล ณ วันที่ {formatDate(data.date)}</p>}
        </div>
      </header>
      {error && <div className="alert error">{error}</div>}
      {loading && !data && <p className="muted">กำลังโหลด…</p>}
      {data && (data.role === 'admin' ? <AdminDashboard s={data} /> : <EmployeeDashboard s={data} />)}
    </>
  );
}

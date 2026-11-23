import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';

const NAV = [
  { to: '/', label: 'ภาพรวม', end: true },
  { to: '/employees', label: 'พนักงาน' },
  { to: '/departments', label: 'แผนก' },
  { to: '/positions', label: 'ตำแหน่ง' },
  { to: '/leaves', label: 'การลา' },
  { to: '/attendance', label: 'ลงเวลา' },
];

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) return setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
    setBusy(true);
    setError('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: form.current_password, new_password: form.new_password },
      });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose} width={420}>
      {done ? (
        <>
          <div className="alert success">เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</div>
          <div className="form-actions">
            <button type="button" className="btn primary" onClick={onClose}>
              ปิด
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            <span>รหัสผ่านปัจจุบัน</span>
            <input type="password" autoComplete="current-password" required value={form.current_password} onChange={set('current_password')} />
          </label>
          <label className="field">
            <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={form.new_password} onChange={set('new_password')} />
          </label>
          <label className="field">
            <span>ยืนยันรหัสผ่านใหม่</span>
            <input type="password" autoComplete="new-password" required minLength={8} value={form.confirm} onChange={set('confirm')} />
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              บันทึก
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const displayName = user.employee ? `${user.employee.first_name} ${user.employee.last_name}` : user.username;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">EMS</span>
          <span>ระบบจัดการพนักงาน</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-name">{displayName}</div>
          <div className="user-role">{user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</div>
          <button type="button" className="btn small ghost" onClick={() => setShowPassword(true)}>
            เปลี่ยนรหัสผ่าน
          </button>
          <button type="button" className="btn small ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { EMPLOYEE_STATUS, formatDate, formatMoney, todayInput } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const EMPTY = {
  employee_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department_id: '',
  position_id: '',
  salary: '',
  hire_date: '',
  status: 'active',
};

function EmployeeForm({ employee, departments, positions, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    employee
      ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, employee[k] ?? '']))
      : { ...EMPTY, hire_date: todayInput() },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // แสดงเฉพาะตำแหน่งของแผนกที่เลือก (รวมตำแหน่งที่ไม่ผูกแผนก)
  const positionOptions = positions.filter(
    (p) => !form.department_id || !p.department_id || String(p.department_id) === String(form.department_id),
  );

  function changeDepartment(e) {
    const department_id = e.target.value;
    setForm((f) => {
      const current = positions.find((p) => String(p.id) === String(f.position_id));
      const stillValid = !current || !current.department_id || String(current.department_id) === department_id;
      return { ...f, department_id, position_id: stillValid ? f.position_id : '' };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(employee ? `/employees/${employee.id}` : '/employees', {
        method: employee ? 'PUT' : 'POST',
        body: { ...form, salary: form.salary === '' ? 0 : Number(form.salary) },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน'} onClose={onClose} width={640}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>รหัสพนักงาน *</span>
            <input required maxLength={20} value={form.employee_code} onChange={set('employee_code')} />
          </label>
          <label className="field">
            <span>สถานะ</span>
            <select value={form.status} onChange={set('status')}>
              {Object.entries(EMPLOYEE_STATUS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ชื่อ *</span>
            <input required maxLength={100} value={form.first_name} onChange={set('first_name')} />
          </label>
          <label className="field">
            <span>นามสกุล *</span>
            <input required maxLength={100} value={form.last_name} onChange={set('last_name')} />
          </label>
          <label className="field">
            <span>อีเมล *</span>
            <input type="email" required value={form.email} onChange={set('email')} />
          </label>
          <label className="field">
            <span>เบอร์โทรศัพท์</span>
            <input maxLength={30} value={form.phone} onChange={set('phone')} />
          </label>
          <label className="field">
            <span>แผนก</span>
            <select value={form.department_id} onChange={changeDepartment}>
              <option value="">— ไม่ระบุ —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>ตำแหน่ง</span>
            <select value={form.position_id} onChange={set('position_id')}>
              <option value="">— ไม่ระบุ —</option>
              {positionOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>เงินเดือน (บาท)</span>
            <input type="number" min="0" step="1" value={form.salary} onChange={set('salary')} />
          </label>
          <label className="field">
            <span>วันที่เริ่มงาน *</span>
            <input type="date" required value={form.hire_date} onChange={set('hire_date')} />
          </label>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AccountModal({ employee, onClose }) {
  const detail = useFetch(`/employees/${employee.id}`);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const account = detail.data?.account;

  useEffect(() => {
    if (account) setUsername(account.username);
  }, [account]);

  async function run(fn, successMessage) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setPassword('');
      setMessage(successMessage);
      detail.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const save = (e) => {
    e.preventDefault();
    run(
      () => api(`/employees/${employee.id}/account`, { method: 'PUT', body: { username, password } }),
      'บันทึกบัญชีผู้ใช้แล้ว',
    );
  };

  const remove = () =>
    run(async () => {
      await api(`/employees/${employee.id}/account`, { method: 'DELETE' });
      setUsername('');
    }, 'ลบบัญชีผู้ใช้แล้ว');

  return (
    <Modal title={`บัญชีผู้ใช้ — ${employee.first_name} ${employee.last_name}`} onClose={onClose} width={440}>
      {detail.loading && !detail.data ? (
        <p className="muted">กำลังโหลด…</p>
      ) : (
        <form onSubmit={save}>
          <p className="muted">
            {account
              ? `มีบัญชีอยู่แล้ว (${account.username}) — กรอกรหัสผ่านใหม่เพื่อรีเซ็ต`
              : 'พนักงานคนนี้ยังไม่มีบัญชีสำหรับเข้าสู่ระบบ'}
          </p>
          <label className="field">
            <span>ชื่อผู้ใช้</span>
            <input required minLength={3} maxLength={50} pattern="[a-zA-Z0-9._\-]+" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="field">
            <span>{account ? 'รหัสผ่านใหม่' : 'รหัสผ่านเริ่มต้น'} (อย่างน้อย 8 ตัวอักษร)</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
          <div className="form-actions">
            {account && (
              <button type="button" className="btn danger push-left" onClick={remove} disabled={busy}>
                ลบบัญชี
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              ปิด
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

export default function Employees() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ q: '', department_id: '', status: '', page: 1 });
  const [modal, setModal] = useState(null); // { type: 'form' | 'account' | 'delete', employee? }

  // หน่วงการค้นหาเล็กน้อยเพื่อไม่ให้เรียก API ทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useFetch(`/employees${qs({ ...filters, limit: 10 })}`);
  const departments = useFetch('/departments');
  const positions = useFetch('/positions');
  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value, page: 1 }));
  const close = () => setModal(null);
  const result = list.data;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>พนักงาน</h1>
          {result && <p className="muted">ทั้งหมด {result.total} คน</p>}
        </div>
        {isAdmin && (
          <button type="button" className="btn primary" onClick={() => setModal({ type: 'form' })}>
            + เพิ่มพนักงาน
          </button>
        )}
      </header>

      <div className="toolbar">
        <input
          type="search"
          placeholder="ค้นหาชื่อ รหัส หรืออีเมล"
          aria-label="ค้นหาพนักงาน"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="กรองตามแผนก" value={filters.department_id} onChange={setFilter('department_id')}>
          <option value="">ทุกแผนก</option>
          {(departments.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select aria-label="กรองตามสถานะ" value={filters.status} onChange={setFilter('status')}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(EMPLOYEE_STATUS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {list.error && <div className="alert error">{list.error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ-นามสกุล</th>
              <th>แผนก</th>
              <th>ตำแหน่ง</th>
              <th>อีเมล</th>
              <th>เริ่มงาน</th>
              {isAdmin && <th className="num">เงินเดือน</th>}
              <th>สถานะ</th>
              {isAdmin && <th aria-label="จัดการ" />}
            </tr>
          </thead>
          <tbody>
            {result?.data.map((e) => (
              <tr key={e.id}>
                <td>{e.employee_code}</td>
                <td>
                  <strong>
                    {e.first_name} {e.last_name}
                  </strong>
                  {e.phone && <div className="muted small">{e.phone}</div>}
                </td>
                <td>{e.department_name ?? '-'}</td>
                <td>{e.position_title ?? '-'}</td>
                <td>{e.email}</td>
                <td>{formatDate(e.hire_date)}</td>
                {isAdmin && <td className="num">{formatMoney(e.salary)}</td>}
                <td>
                  <span className={`badge ${e.status}`}>{EMPLOYEE_STATUS[e.status]}</span>
                </td>
                {isAdmin && (
                  <td className="actions">
                    <button type="button" className="btn small" onClick={() => setModal({ type: 'form', employee: e })}>
                      แก้ไข
                    </button>
                    <button type="button" className="btn small" onClick={() => setModal({ type: 'account', employee: e })}>
                      บัญชี
                    </button>
                    <button type="button" className="btn small danger" onClick={() => setModal({ type: 'delete', employee: e })}>
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  ไม่พบพนักงานตามเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
            {!result && list.loading && (
              <tr>
                <td colSpan={9} className="empty">
                  กำลังโหลด…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && result.pages > 1 && (
        <div className="pagination">
          <button type="button" className="btn small" disabled={result.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}>
            ก่อนหน้า
          </button>
          <span>
            หน้า {result.page} / {result.pages}
          </span>
          <button type="button" className="btn small" disabled={result.page >= result.pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}>
            ถัดไป
          </button>
        </div>
      )}

      {modal?.type === 'form' && (
        <EmployeeForm
          employee={modal.employee}
          departments={departments.data ?? []}
          positions={positions.data ?? []}
          onClose={close}
          onSaved={list.reload}
        />
      )}
      {modal?.type === 'account' && <AccountModal employee={modal.employee} onClose={close} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="ลบพนักงาน"
          message={`ต้องการลบ ${modal.employee.first_name} ${modal.employee.last_name} (${modal.employee.employee_code}) ใช่หรือไม่? บัญชีผู้ใช้ ประวัติการลา และการลงเวลาของพนักงานคนนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนได้`}
          confirmLabel="ลบ"
          danger
          onClose={close}
          onConfirm={async () => {
            await api(`/employees/${modal.employee.id}`, { method: 'DELETE' });
            list.reload();
          }}
        />
      )}
    </>
  );
}

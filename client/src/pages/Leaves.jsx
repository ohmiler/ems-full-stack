import { useState } from 'react';
import { api, qs } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { daysBetween, formatDate, LEAVE_STATUS, LEAVE_TYPES, todayInput } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function LeaveForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'sick', start_date: todayInput(), end_date: todayInput(), reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/leaves', { method: 'POST', body: form });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="ยื่นใบลา" onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <label className="field">
          <span>ประเภทการลา</span>
          <select value={form.type} onChange={set('type')}>
            {Object.entries(LEAVE_TYPES).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>ตั้งแต่วันที่</span>
            <input type="date" required value={form.start_date} onChange={set('start_date')} />
          </label>
          <label className="field">
            <span>ถึงวันที่</span>
            <input type="date" required min={form.start_date} value={form.end_date} onChange={set('end_date')} />
          </label>
        </div>
        <label className="field">
          <span>เหตุผล</span>
          <textarea rows={3} maxLength={500} value={form.reason} onChange={set('reason')} />
        </label>
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            ส่งคำขอ
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Leaves() {
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState('');
  const list = useFetch(`/leaves${qs({ status })}`);
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  const review = (leave, newStatus) => ({
    type: 'confirm',
    title: newStatus === 'approved' ? 'อนุมัติการลา' : 'ไม่อนุมัติการลา',
    message: `${newStatus === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}คำขอ${LEAVE_TYPES[leave.type]}ของ ${leave.first_name} ${leave.last_name} ใช่หรือไม่?`,
    confirmLabel: newStatus === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ',
    danger: newStatus === 'rejected',
    run: () => api(`/leaves/${leave.id}/status`, { method: 'PATCH', body: { status: newStatus } }),
  });

  const cancel = (leave) => ({
    type: 'confirm',
    title: 'ยกเลิกคำขอลา',
    message: 'ต้องการยกเลิกคำขอลานี้ใช่หรือไม่?',
    confirmLabel: 'ยกเลิกคำขอ',
    danger: true,
    run: () => api(`/leaves/${leave.id}`, { method: 'DELETE' }),
  });

  return (
    <>
      <header className="page-header">
        <div>
          <h1>การลา</h1>
          <p className="muted">{isAdmin ? 'คำขอลาของพนักงานทั้งหมด' : 'ประวัติการลาของคุณ'}</p>
        </div>
        {user.employee && (
          <button type="button" className="btn primary" onClick={() => setModal({ type: 'form' })}>
            + ยื่นใบลา
          </button>
        )}
      </header>

      <div className="toolbar">
        <select aria-label="กรองตามสถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          {Object.entries(LEAVE_STATUS).map(([v, label]) => (
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
              {isAdmin && <th>พนักงาน</th>}
              <th>ประเภท</th>
              <th>ช่วงวันที่</th>
              <th className="num">จำนวนวัน</th>
              <th>เหตุผล</th>
              <th>สถานะ</th>
              <th aria-label="จัดการ" />
            </tr>
          </thead>
          <tbody>
            {list.data?.map((l) => {
              const isOwn = user.employee?.id === l.employee_id;
              return (
                <tr key={l.id}>
                  {isAdmin && (
                    <td>
                      <strong>
                        {l.first_name} {l.last_name}
                      </strong>
                      <div className="muted small">{l.employee_code}</div>
                    </td>
                  )}
                  <td>{LEAVE_TYPES[l.type]}</td>
                  <td>
                    {formatDate(l.start_date)}
                    {l.end_date !== l.start_date && ` – ${formatDate(l.end_date)}`}
                  </td>
                  <td className="num">{daysBetween(l.start_date, l.end_date)}</td>
                  <td>{l.reason || '-'}</td>
                  <td>
                    <span className={`badge ${l.status}`}>{LEAVE_STATUS[l.status]}</span>
                  </td>
                  <td className="actions">
                    {l.status === 'pending' && isAdmin && (
                      <>
                        <button type="button" className="btn small primary" onClick={() => setModal(review(l, 'approved'))}>
                          อนุมัติ
                        </button>
                        <button type="button" className="btn small danger" onClick={() => setModal(review(l, 'rejected'))}>
                          ไม่อนุมัติ
                        </button>
                      </>
                    )}
                    {l.status === 'pending' && isOwn && (
                      <button type="button" className="btn small" onClick={() => setModal(cancel(l))}>
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  ยังไม่มีคำขอลา
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'form' && <LeaveForm onClose={close} onSaved={list.reload} />}
      {modal?.type === 'confirm' && (
        <ConfirmDialog
          title={modal.title}
          message={modal.message}
          confirmLabel={modal.confirmLabel}
          danger={modal.danger}
          onClose={close}
          onConfirm={async () => {
            await modal.run();
            list.reload();
          }}
        />
      )}
    </>
  );
}

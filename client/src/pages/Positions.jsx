import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function PositionForm({ position, departments, onClose, onSaved }) {
  const [title, setTitle] = useState(position?.title ?? '');
  const [departmentId, setDepartmentId] = useState(position?.department_id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(position ? `/positions/${position.id}` : '/positions', {
        method: position ? 'PUT' : 'POST',
        body: { title, department_id: departmentId },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={position ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง'} onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <label className="field">
          <span>ชื่อตำแหน่ง *</span>
          <input required maxLength={100} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>แผนก</span>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
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
    </Modal>
  );
}

export default function Positions() {
  const { isAdmin } = useAuth();
  const list = useFetch('/positions');
  const departments = useFetch('/departments');
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>ตำแหน่ง</h1>
          {list.data && <p className="muted">ทั้งหมด {list.data.length} ตำแหน่ง</p>}
        </div>
        {isAdmin && (
          <button type="button" className="btn primary" onClick={() => setModal({ type: 'form' })}>
            + เพิ่มตำแหน่ง
          </button>
        )}
      </header>

      {list.error && <div className="alert error">{list.error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อตำแหน่ง</th>
              <th>แผนก</th>
              <th className="num">พนักงาน</th>
              {isAdmin && <th aria-label="จัดการ" />}
            </tr>
          </thead>
          <tbody>
            {list.data?.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.title}</strong>
                </td>
                <td>{p.department_name ?? '-'}</td>
                <td className="num">{p.employee_count}</td>
                {isAdmin && (
                  <td className="actions">
                    <button type="button" className="btn small" onClick={() => setModal({ type: 'form', position: p })}>
                      แก้ไข
                    </button>
                    <button type="button" className="btn small danger" onClick={() => setModal({ type: 'delete', position: p })}>
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  ยังไม่มีตำแหน่ง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'form' && (
        <PositionForm position={modal.position} departments={departments.data ?? []} onClose={close} onSaved={list.reload} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="ลบตำแหน่ง"
          message={`ต้องการลบตำแหน่ง "${modal.position.title}" ใช่หรือไม่?`}
          confirmLabel="ลบ"
          danger
          onClose={close}
          onConfirm={async () => {
            await api(`/positions/${modal.position.id}`, { method: 'DELETE' });
            list.reload();
          }}
        />
      )}
    </>
  );
}

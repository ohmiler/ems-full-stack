import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function DepartmentForm({ department, onClose, onSaved }) {
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(department ? `/departments/${department.id}` : '/departments', {
        method: department ? 'PUT' : 'POST',
        body: { name, description },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={department ? 'แก้ไขแผนก' : 'เพิ่มแผนก'} onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <label className="field">
          <span>ชื่อแผนก *</span>
          <input required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>รายละเอียด</span>
          <textarea rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
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

export default function Departments() {
  const { isAdmin } = useAuth();
  const list = useFetch('/departments');
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>แผนก</h1>
          {list.data && <p className="muted">ทั้งหมด {list.data.length} แผนก</p>}
        </div>
        {isAdmin && (
          <button type="button" className="btn primary" onClick={() => setModal({ type: 'form' })}>
            + เพิ่มแผนก
          </button>
        )}
      </header>

      {list.error && <div className="alert error">{list.error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อแผนก</th>
              <th>รายละเอียด</th>
              <th className="num">ตำแหน่ง</th>
              <th className="num">พนักงาน</th>
              {isAdmin && <th aria-label="จัดการ" />}
            </tr>
          </thead>
          <tbody>
            {list.data?.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.name}</strong>
                </td>
                <td>{d.description || '-'}</td>
                <td className="num">{d.position_count}</td>
                <td className="num">{d.employee_count}</td>
                {isAdmin && (
                  <td className="actions">
                    <button type="button" className="btn small" onClick={() => setModal({ type: 'form', department: d })}>
                      แก้ไข
                    </button>
                    <button type="button" className="btn small danger" onClick={() => setModal({ type: 'delete', department: d })}>
                      ลบ
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {list.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  ยังไม่มีแผนก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.type === 'form' && <DepartmentForm department={modal.department} onClose={close} onSaved={list.reload} />}
      {modal?.type === 'delete' && (
        <ConfirmDialog
          title="ลบแผนก"
          message={`ต้องการลบแผนก "${modal.department.name}" ใช่หรือไม่?`}
          confirmLabel="ลบ"
          danger
          onClose={close}
          onConfirm={async () => {
            await api(`/departments/${modal.department.id}`, { method: 'DELETE' });
            list.reload();
          }}
        />
      )}
    </>
  );
}

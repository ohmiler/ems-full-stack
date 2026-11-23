import { useState } from 'react';
import Modal from './Modal.jsx';

/** กล่องยืนยันก่อนทำรายการ — onConfirm เป็น async และ error จะแสดงในกล่อง */
export default function ConfirmDialog({ title, message, confirmLabel = 'ยืนยัน', danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose} width={420}>
      <p>{message}</p>
      {error && <div className="alert error">{error}</div>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          ยกเลิก
        </button>
        <button type="button" className={`btn ${danger ? 'danger' : 'primary'}`} onClick={handleConfirm} disabled={busy}>
          {busy ? 'กำลังดำเนินการ…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

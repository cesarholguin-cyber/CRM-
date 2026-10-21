import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react';
import { tutorialsApi } from '../lib/api';

export default function DeleteTutorialDialog({ tutorial, onClose, onDeleted }) {
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const submitting = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    cancelButton.current.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  async function remove(event) {
    event.preventDefault();
    if (!confirmed || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      await tutorialsApi.delete(tutorial.id, confirmed);
      onDeleted(tutorial.id);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo completar la eliminación. Marca la casilla y vuelve a intentarlo.');
      setConfirmed(false);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  // Reuse the CRM's existing confirmation styles (including dark/mobile modes).
  return createPortal(<dialog ref={dialog} className="client-delete-dialog" aria-labelledby="tutorial-delete-title"
    aria-describedby="tutorial-delete-description" aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <form onSubmit={remove}>
      <div className="client-delete-heading">
        <span className="client-delete-symbol"><AlertTriangle size={24} aria-hidden="true"/></span>
        <button type="button" className="crm-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar confirmación"><X size={20}/></button>
      </div>
      <h2 id="tutorial-delete-title">¿Eliminar video?</h2>
      <p id="tutorial-delete-description">Vas a eliminar <strong>{tutorial.title}</strong> de la biblioteca y borrar su archivo del almacenamiento. El equipo ya no podrá verlo. Esta acción no se puede deshacer.</p>
      <label className={`client-delete-confirm ${confirmed ? 'is-checked' : ''}`}>
        <input type="checkbox" checked={confirmed} required disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>
        <span>Confirmo que quiero eliminar este video y entiendo que no podré recuperarlo desde el CRM.</span>
      </label>
      {error && <p className="client-delete-error" role="alert">{error}</p>}
      <div className="client-delete-actions">
        <button ref={cancelButton} type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button type="submit" className="client-delete-submit" disabled={!confirmed || busy}>
          {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true"/> : <Trash2 size={17} aria-hidden="true"/>}
          {busy ? 'Eliminando…' : 'Eliminar video'}
        </button>
      </div>
    </form>
  </dialog>, document.body);
}

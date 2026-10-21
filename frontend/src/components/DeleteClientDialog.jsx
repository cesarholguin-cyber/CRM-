import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react';
import { clientsApi } from '../lib/api';

export default function DeleteClientDialog({ client, onClose, onDeleted }) {
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const submitting = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.showModal();
    cancelButton.current?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  async function remove(event) {
    event.preventDefault();
    if (!confirmed || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await clientsApi.delete(client.id, confirmed);
      onDeleted(client.id);
    } catch (err) {
      const message = err.response?.data?.detail;
      setError(typeof message === 'string' ? message : 'No se pudo eliminar el cliente. Intenta nuevamente.');
      setConfirmed(false);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className="client-delete-dialog" aria-labelledby="client-delete-title"
      aria-describedby="client-delete-description" aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
      <form onSubmit={remove}>
        <div className="client-delete-heading">
          <span className="client-delete-symbol"><AlertTriangle size={24} aria-hidden="true" /></span>
          <button type="button" className="crm-icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar confirmación"><X size={20}/></button>
        </div>
        <h2 id="client-delete-title">¿Eliminar cliente?</h2>
        <p id="client-delete-description">Vas a eliminar a <strong>{client.full_name?.replace(/^dec::/, '')}</strong> y su historial de contacto. Esta acción no se puede deshacer.</p>
        <label className={`client-delete-confirm ${confirmed ? 'is-checked' : ''}`}>
          <input type="checkbox" checked={confirmed} required disabled={busy}
            onChange={event => setConfirmed(event.target.checked)} />
          <span>Confirmo que quiero eliminar este cliente y entiendo que no podré recuperarlo desde el CRM.</span>
        </label>
        {error && <p className="client-delete-error" role="alert">{error}</p>}
        <div className="client-delete-actions">
          <button ref={cancelButton} type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="client-delete-submit" disabled={!confirmed || busy}>
            {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true"/> : <Trash2 size={17} aria-hidden="true"/>}
            {busy ? 'Eliminando…' : 'Eliminar cliente'}
          </button>
        </div>
      </form>
    </dialog>, document.body,
  );
}

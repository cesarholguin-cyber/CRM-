import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, CheckCircle, XCircle, X } from 'lucide-react';
import { salesApi, webRequestsApi } from '../lib/api';

export default function ReservationActions({ saleId, requestId, hasLot = true, closed = false, title, onChanged }) {
  const navigate = useNavigate();
  const dialog = useRef(null);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (action) dialog.current?.showModal(); else dialog.current?.close();
  }, [action]);
  const labels = { sale: 'Venta', sold: 'Ya se ha vendido el lote', cancel: 'Cancelado' };
  const description = action === 'cancel'
    ? saleId ? 'Se cancelará este apartado y el lote volverá a estar disponible en la landing. El historial se conserva.' : 'Se cancelará esta solicitud de cita o consulta. Una cita no bloquea inventario; no se modificarán apartados ni ventas de otras solicitudes.'
    : action === 'sold' ? 'El lote quedará vendido en el CRM y en la landing, y ya no podrá apartarse. Esta acción registra la venta; no realiza ningún cobro.'
    : 'Se abrirá un registro de venta para este cliente y lote. El terreno quedará apartado durante 15 días mientras formalizas la operación.';
  function choose(next) {
    setError('');
    if (next === 'sale' && saleId) { navigate(`/sales?sale_id=${saleId}`); return; }
    setAction(next);
  }
  async function confirm() {
    if (busy) return;
    setBusy(true); setError('');
    let result;
    try {
      if (requestId) result = (await webRequestsApi.action(requestId, action)).data;
      else result = (await salesApi.update(saleId, { status: action === 'sold' ? 'paid' : 'cancelled' })).data;
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar el cambio. Reintenta.');
      setBusy(false); return;
    }
    const completed = action;
    setBusy(false); setAction(null);
    onChanged(completed === 'cancel' ? (saleId ? 'Apartado cancelado. El lote ya está disponible en la landing.' : 'Solicitud cancelada.') : completed === 'sold' ? 'Lote marcado como vendido. La landing mostrará su nuevo estado.' : 'Registro de venta creado.');
    if (completed === 'sale') navigate(`/sales?sale_id=${result.sale_id}`);
  }
  return <>
    <div className="reservation-actions">
      <button className="btn-primary" onClick={() => choose('sale')} disabled={closed && !saleId || !hasLot}><ShoppingCart size={16}/>Venta</button>
      <button className="btn-success" onClick={() => choose('sold')} disabled={closed || !hasLot}><CheckCircle size={16}/>Ya se ha vendido el lote</button>
      <button className="btn-danger" onClick={() => choose('cancel')} disabled={closed}><XCircle size={16}/>Cancelado</button>
    </div>
    {!hasLot && <p className="reservation-action-note">Esta solicitud no tiene un lote elegido. Registra la operación desde Ventas cuando el cliente seleccione uno.</p>}
    {createPortal(<dialog ref={dialog} className="crm-command reservation-confirm" aria-labelledby={`action-title-${requestId ? 'web-'+requestId : 'sale-'+saleId}`} onCancel={e => { if (busy) e.preventDefault(); else setAction(null); }} onClose={() => { if (!busy) setAction(null); }}>
      <div className="crm-command-heading"><h2 id={`action-title-${requestId ? 'web-'+requestId : 'sale-'+saleId}`}>{labels[action]}</h2><button className="crm-icon-button" disabled={busy} onClick={() => setAction(null)} aria-label="Cerrar confirmación"><X size={19}/></button></div>
      <div className="reservation-confirm-body"><strong>{title}</strong><p>{description}</p>{error && <p role="alert" className="reservation-action-error">{error}</p>}<div className="reservation-actions"><button className="btn-secondary" disabled={busy} onClick={() => setAction(null)}>Volver</button><button className={action === 'cancel' ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={confirm}>{busy ? 'Guardando…' : action === 'cancel' ? 'Confirmar cancelación' : action === 'sold' ? 'Confirmar vendido' : 'Abrir registro de venta'}</button></div></div>
    </dialog>, document.body)}
  </>;
}

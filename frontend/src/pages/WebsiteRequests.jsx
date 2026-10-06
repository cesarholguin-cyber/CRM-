import { useEffect, useState } from 'react';
import { webRequestsApi } from '../lib/api';
import { CalendarDays, MessageSquare, RefreshCw } from 'lucide-react';

const states = { pending: 'Pendiente', contacted: 'Contactado', confirmed: 'Cita confirmada', completed: 'Atendido', cancelled: 'Cancelado' };
export default function WebsiteRequests() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [busy, setBusy] = useState(null);
  async function load() {
    try { const res = await webRequestsApi.list(); setRows(res.data.filter(r => r.kind !== 'reservation')); setError(''); }
    catch { setError('No pudimos cargar las citas. Reintenta para ver las solicitudes más recientes.'); }
  }
  useEffect(() => { load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 15000); return () => clearInterval(timer); }, []);
  async function update(row, status) {
    setBusy(row.id);
    try { await webRequestsApi.update(row.id, status); await load(); }
    catch { setError('No se pudo guardar el cambio. Intenta de nuevo.'); }
    finally { setBusy(null); }
  }
  const visible = rows.filter(r => filter === 'all' || !['completed', 'cancelled'].includes(r.status));
  return <section className="mb-8" aria-label="Citas y consultas desde la web">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div><h2 className="text-xl font-semibold text-rf-dark dark:text-gray-100">Citas y consultas <span className="text-sm text-gray-500">({visible.length})</span></h2><p className="text-sm text-gray-500">Solicitudes de la web. Pedir una visita no bloquea el lote.</p></div>
      <div className="flex gap-2"><select aria-label="Filtrar solicitudes" className="input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Pendientes y en seguimiento</option><option value="all">Todas las solicitudes</option></select><button type="button" className="btn-secondary" aria-label="Actualizar citas" onClick={load}><RefreshCw size={18}/></button></div>
    </div>
    {error && <p role="alert" className="mb-3 text-red-600">{error}</p>}
    {!visible.length && !error && <div className="card p-6 text-gray-500">Las solicitudes de cita y consulta aparecerán aquí automáticamente.</div>}
    <div className="grid gap-3">{visible.map(row => <article key={row.id} className="card web-request-card p-5">
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0"><div className="flex items-center gap-2 text-rf-green-800 dark:text-rf-green-400">{row.kind === 'visit' ? <CalendarDays size={19}/> : <MessageSquare size={19}/>}<strong>{row.kind === 'visit' ? 'Solicitud de cita' : 'Consulta'} · {row.reference}</strong></div>
          <h3 className="mt-2 font-semibold text-rf-dark dark:text-gray-100">{row.full_name}</h3>
          <p className="text-sm text-gray-500">{row.project_name}{row.block && ` · Manzana ${row.block.replace(/^M/, '')} · Lote ${row.lot_number}`}</p>
          <div className="flex flex-wrap gap-x-5 text-sm mt-2">{row.phone && <a href={`tel:${row.phone}`}>Teléfono: {row.phone}</a>}{row.email && <a href={`mailto:${row.email}`}>{row.email}</a>}</div>
          {row.preferred_date && <p className="text-sm mt-2"><b>Fecha solicitada:</b> {row.preferred_date} · {row.preferred_time}</p>}
          {row.message && <p className="mt-2 text-sm whitespace-pre-wrap break-words">{row.message}</p>}
          <p className="text-xs text-gray-400 mt-2">Recibido: {new Date(row.created_at).toLocaleString('es-MX')}</p>
        </div>
        <label className="text-sm">Seguimiento<select className="input mt-1" aria-label={`Estado de ${row.reference}`} disabled={busy === row.id} value={row.status} onChange={e=>update(row,e.target.value)}>{Object.entries(states).filter(([s])=>row.kind==='visit'||s!=='confirmed').map(([s,label])=><option key={s} value={s}>{label}</option>)}</select></label>
      </div>
    </article>)}</div>
  </section>;
}

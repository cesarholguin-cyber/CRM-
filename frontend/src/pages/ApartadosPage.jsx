import { useState, useEffect, useCallback } from 'react';
import WebsiteRequests from './WebsiteRequests';
import ReservationActions from '../components/ReservationActions';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { blockLabel } from '../lib/lotInventory';
import { Bookmark, Search, Clock, ChevronDown, RefreshCw } from 'lucide-react';

const states = { reserved: 'Apartado', option_signed: 'Opción firmada', contract_signed: 'Contrato firmado', financing: 'Financiamiento', paid: 'Vendido', cancelled: 'Cancelado', reversed: 'Reversado' };
const closedStates = ['paid', 'cancelled', 'reversed'];
export default function ApartadosPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [lots, setLots] = useState({});
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const loadData = useCallback(async () => {
    try {
      const [salesRes, clientsRes, projectsRes] = await Promise.all([salesApi.list(), clientsApi.list(), projectsApi.list()]);
      const lotsData = await Promise.all(projectsRes.data.map(p => lotsApi.list(p.id)));
      setReservations(salesRes.data || []); setClients(clientsRes.data || []); setProjects(projectsRes.data || []);
      setLots(Object.fromEntries(lotsData.flatMap(r => r.data).map(l => [l.id, l]))); setError('');
    } catch { setError('No pudimos cargar los apartados. Actualiza para reintentar.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadData(); const timer = setInterval(() => { if (!document.hidden) loadData(); }, 15000); return () => clearInterval(timer); }, [loadData]);
  function changed(message) { setNotice(message); setRevision(value => value + 1); loadData(); }
  const active = reservations.filter(s => !closedStates.includes(s.status));
  const filtered = (history ? reservations : active).filter(s => {
    const client = clients.find(c => c.id === s.client_id);
    const lot = lots[s.lot_id];
    const project = projects.find(p => p.id === lot?.project_id);
    return `${client?.full_name || ''} ${blockLabel(lot?.block)} lote ${lot?.lot_number || ''} ${project?.name || ''}`.toLowerCase().includes(search.toLowerCase());
  });
  return <div className="animate-fade-in">
    <div className="mb-8"><div className="flex items-center gap-3 mb-2"><Bookmark size={24}/><h1 className="text-3xl font-bold text-rf-dark dark:text-gray-100">Apartados</h1><span className="badge bg-amber-100 text-amber-800">{active.length} lotes activos</span></div><p className="text-sm text-rf-gray-light">Abre un registro para gestionar la venta, marcarlo vendido o cancelarlo.</p></div>
    {notice && <p role="status" className="reservation-notice">{notice}</p>}
    <WebsiteRequests revision={revision} onChanged={changed}/>
    <div className="reservation-section-header"><h2 className="text-xl font-semibold">Lotes apartados</h2><button className="btn-secondary" aria-label="Actualizar apartados" onClick={loadData}><RefreshCw size={17}/></button></div>
    {error && <p role="alert" className="text-red-600 mb-3">{error}</p>}
    <div className="card p-4 mb-5 flex flex-wrap gap-4 items-center"><div className="relative flex-1 min-w-0"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input aria-label="Buscar apartados" placeholder="Buscar cliente, manzana, lote…" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10"/></div><label className="flex items-center gap-2 text-sm text-rf-gray-light"><input type="checkbox" checked={history} onChange={e => setHistory(e.target.checked)}/>Mostrar historial</label></div>
    {loading ? <p role="status" className="card p-8">Cargando apartados…</p> : !filtered.length ? <div className="card p-10 text-center"><Bookmark size={30} className="mx-auto mb-4 text-rf-gray-light"/><h3 className="text-lg font-semibold">{search ? 'No hay coincidencias' : 'No hay apartados activos'}</h3><p className="text-sm text-rf-gray-light mt-2">{search ? 'Prueba otro cliente, manzana o lote.' : 'Las reservas de la landing aparecerán aquí. Puedes consultar las operaciones anteriores en el historial.'}</p></div> : <div className="space-y-3">{filtered.map(sale => {
      const lot = lots[sale.lot_id];
      const client = clients.find(c => c.id === sale.client_id);
      const project = projects.find(p => p.id === lot?.project_id);
      const title = `${project?.name || 'Proyecto'} · ${blockLabel(lot?.block)} · Lote ${lot?.lot_number ?? sale.lot_id}`;
      const days = sale.reservation_expires_at ? Math.ceil((new Date(sale.reservation_expires_at) - Date.now()) / 86400000) : null;
      return <details key={sale.id} className="card reservation-record">
        <summary aria-label={`Abrir apartado ${sale.id}: ${title}`}><span className="reservation-record-icon"><Bookmark size={20}/></span><span className="reservation-record-title"><strong>{client?.full_name?.replace(/^dec::/, '') || `Cliente #${sale.client_id}`}</strong><span>{title}</span><small>Apartado #{sale.id}{lot ? ` · ${lot.area_sqm} m²` : ''}</small></span><span className={`reservation-state ${sale.status}`}>{states[sale.status] || sale.status}</span><ChevronDown size={18} className="reservation-chevron"/></summary>
        <div className="reservation-record-body"><div className="reservation-contact"><span>{client?.email || client?.phone || 'Sin contacto registrado'}</span><strong>${sale.sale_price.toLocaleString('es-MX')} MXN</strong>{days !== null && <span><Clock size={14}/>{days <= 0 ? 'Plazo vencido' : `${days} días restantes`}</span>}</div><ReservationActions saleId={sale.id} closed={closedStates.includes(sale.status)} title={title} onChanged={changed}/></div>
      </details>;
    })}</div>}
  </div>;
}

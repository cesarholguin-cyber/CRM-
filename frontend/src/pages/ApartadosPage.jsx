import { useState, useEffect } from 'react';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { Bookmark, Search, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const statusConfig = {
  reserved: { label: 'Apartado', color: 'bg-amber-100 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Vendido', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border border-red-200', dot: 'bg-red-500' },
};

export default function ApartadosPage() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [lots, setLots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      salesApi.list({ status: 'reserved' }),
      clientsApi.list(),
      projectsApi.list(),
    ]).then(([salesRes, clientsRes, projectsRes]) => {
      setReservations(salesRes.data || []);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
      const promises = (projectsRes.data || []).map((p) =>
        lotsApi.list(p.id).then((r) => ({ projectId: p.id, lots: r.data || [] }))
      );
      return Promise.all(promises);
    }).then((lotsData) => {
      const allLots = {};
      (lotsData || []).forEach((ld) => {
        (ld.lots || []).forEach((l) => { allLots[l.id] = l; });
      });
      setLots(allLots);
    }).catch(console.error)
    .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const findClientName = (id) => {
    const c = clients.find((cl) => cl.id === id);
    return c ? c.full_name.replace(/^dec::/, '') : `Cliente #${id}`;
  };

  const findClient = (id) => clients.find((cl) => cl.id === id);
  const findLot = (id) => lots[id];
  const findProjectName = (projectId) => {
    const p = projects.find((pr) => pr.id === projectId);
    return p ? p.name : '';
  };

  const daysRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const exp = new Date(expiresAt);
    const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleMarkPaid = async (saleId) => {
    try {
      await salesApi.update(saleId, { status: 'paid' });
      setReservations((prev) => prev.filter((s) => s.id !== saleId));
      setConfirmAction(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al marcar como vendido');
    }
  };

  const handleCancel = async (saleId) => {
    try {
      await salesApi.update(saleId, { status: 'cancelled' });
      setReservations((prev) => prev.filter((s) => s.id !== saleId));
      setConfirmAction(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al cancelar apartado');
    }
  };

  const filtered = reservations.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = findClientName(s.client_id).toLowerCase();
    const lot = findLot(s.lot_id);
    const lotNum = lot ? `lote ${lot.lot_number}` : '';
    return name.includes(q) || lotNum.includes(q) || `#${s.id}`.includes(q);
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8 stagger-1 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Apartados</h1>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200">
              {reservations.length} activos
            </span>
          </div>
          <p className="text-base text-rf-gray-light mt-1">Reservaciones de lotes desde la web</p>
        </div>
      </div>

      <div className="card p-4 mb-6 shadow-premium-xs stagger-2 animate-fade-in">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-3 border-rf-green-200 border-t-rf-green-800 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-rf-cream flex items-center justify-center">
            <Bookmark size={32} className="text-rf-gold" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">No hay apartados activos</h3>
          <p className="text-gray-400">Los lotes apartados desde la web aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sale, i) => {
            const lot = findLot(sale.lot_id);
            const client = findClient(sale.client_id);
            const days = daysRemaining(sale.reservation_expires_at);
            const cfg = statusConfig.reserved;
            return (
              <div
                key={sale.id}
                className={`card-hover p-5 animate-slide-up stagger-${Math.min(i + 1, 9)}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-rf-cream flex items-center justify-center flex-shrink-0">
                      <Bookmark size={18} className="text-rf-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-rf-dark">Apartado #{sale.id}</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>

                      {client && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-400">Cliente:</span>
                            <span className="ml-1.5 font-medium text-rf-dark">{client.full_name.replace(/^dec::/, '')}</span>
                          </div>
                          {client.email && (
                            <div>
                              <span className="text-gray-400">Email:</span>
                              <span className="ml-1.5 text-rf-dark">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div>
                              <span className="text-gray-400">Teléfono:</span>
                              <span className="ml-1.5 text-rf-dark">{client.phone}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {lot && (
                        <div className="mt-1 text-sm text-gray-500">
                          Lote #{lot.lot_number} · {lot.area_sqm} m² · {findProjectName(lot.project_id)}
                        </div>
                      )}

                      {days !== null && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${
                          days <= 0 ? 'bg-red-100 text-red-700' :
                          days <= 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {days <= 0 ? <AlertTriangle size={12} /> : <Clock size={12} />}
                          {days <= 0 ? 'Vencido' : `${days} días restantes`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setConfirmAction({ type: 'paid', saleId: sale.id })}
                      className="btn-success flex items-center gap-1.5 text-xs"
                    >
                      <CheckCircle size={14} /> Vendido
                    </button>
                    <button
                      onClick={() => setConfirmAction({ type: 'cancel', saleId: sale.id })}
                      className="btn-danger flex items-center gap-1.5 text-xs"
                    >
                      <XCircle size={14} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setConfirmAction(null)}>
          <div className="card p-6 w-full max-w-sm shadow-premium-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${
                confirmAction.type === 'paid' ? 'bg-emerald-100' : 'bg-red-100'
              }`}>
                {confirmAction.type === 'paid' ? (
                  <CheckCircle size={28} className="text-emerald-600" />
                ) : (
                  <XCircle size={28} className="text-red-600" />
                )}
              </div>
              <h3 className="text-lg font-bold text-rf-dark mb-2">
                {confirmAction.type === 'paid' ? 'Marcar como vendido' : 'Eliminar apartado'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {confirmAction.type === 'paid'
                  ? '¿Confirmas que este apartado se ha pagado completamente?'
                  : '¿Estás seguro de eliminar este apartado? El lote quedará disponible nuevamente.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmAction.type === 'paid'
                    ? handleMarkPaid(confirmAction.saleId)
                    : handleCancel(confirmAction.saleId)
                  }
                  className={`flex-1 py-2.5 text-white rounded-xl font-medium text-sm transition-all ${
                    confirmAction.type === 'paid'
                      ? 'btn-success'
                      : 'btn-danger'
                  }`}
                >
                  {confirmAction.type === 'paid' ? 'Sí, marcar vendido' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

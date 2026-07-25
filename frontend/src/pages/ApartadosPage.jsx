import { useState, useEffect } from 'react';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { Bookmark, Search, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const statusConfig = {
  reserved: { label: 'Apartado', color: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50', dot: 'bg-amber-500' },
  paid: { label: 'Vendido', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50', dot: 'bg-red-500' },
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
            <div className="w-1 h-7 rounded-full bg-gradient-to-b from-rf-green-800 to-rf-green-400 animate-stagger-accent" />
            <h1 className="text-3xl font-bold text-rf-dark dark:text-gray-100">Apartados</h1>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50">
              {reservations.length} activos
            </span>
          </div>
          <p className="text-base text-rf-gray-light dark:text-gray-500 mt-1 ml-4">Reservaciones de lotes desde la web</p>
        </div>
      </div>

      <div className="card p-4 mb-6 shadow-premium-xs stagger-2 animate-fade-in ring-1 ring-gray-100/60 dark:ring-gray-800/60">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por cliente, lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 bg-gray-50/50 dark:bg-gray-900/50 focus:bg-white dark:focus:bg-gray-800 transition-colors duration-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-rf-green-800 border-r-rf-green-400/50 animate-spin" />
            <div className="absolute inset-1.5 rounded-full border-[2px] border-transparent border-b-rf-green-400 border-l-rf-green-800/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-rf-green-800 dark:bg-rf-green-400 animate-pulse" />
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center animate-blur-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-rf-cream dark:bg-gray-800 flex items-center justify-center ring-1 ring-amber-200/30">
            <Bookmark size={32} className="text-rf-gold dark:text-rf-gold-light" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark dark:text-gray-100 mb-2">No hay apartados activos</h3>
          <p className="text-gray-400 dark:text-gray-500">Los lotes apartados desde la web aparecerán aquí</p>
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
                className="card-hover p-5 animate-slide-up"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 ring-1 ring-amber-200/30 dark:from-amber-900/20 dark:to-amber-900/10 dark:ring-amber-800/30 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Bookmark size={18} className="text-rf-gold dark:text-rf-gold-light" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="font-semibold text-rf-dark dark:text-gray-100 text-[15px]">Apartado #{sale.id}</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>

                      {client && (
                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                          <div>
                            <span className="text-gray-400 dark:text-gray-500">Cliente:</span>
                            <span className="ml-1.5 font-medium text-rf-dark dark:text-gray-100">{client.full_name.replace(/^dec::/, '')}</span>
                          </div>
                          {client.email && (
                            <div>
                              <span className="text-gray-400 dark:text-gray-500">Email:</span>
                              <span className="ml-1.5 text-rf-dark dark:text-gray-100">{client.email}</span>
                            </div>
                          )}
                          {client.phone && (
                            <div>
                              <span className="text-gray-400 dark:text-gray-500">Teléfono:</span>
                              <span className="ml-1.5 text-rf-dark dark:text-gray-100">{client.phone}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {lot && (
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Lote #{lot.lot_number} · {lot.area_sqm} m² · {findProjectName(lot.project_id)}
                        </div>
                      )}

                      {days !== null && (
                        <div className={`mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ring-1 ${
                          days <= 0 ? 'bg-red-100/80 text-red-700 ring-red-200/50 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/40' :
                          days <= 3 ? 'bg-orange-100/80 text-orange-700 ring-orange-200/50 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-800/40' :
                          'bg-blue-50/80 text-blue-600 ring-blue-200/50 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-800/40'
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setConfirmAction(null)}>
          <div className="card p-6 w-full max-w-sm shadow-premium-xl animate-scale-in overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rf-green-800 via-rf-green-600 to-rf-green-400" />
            <div className="text-center pt-2">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg ring-4 ${
                confirmAction.type === 'paid'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-emerald-100 dark:ring-emerald-900/20'
                  : 'bg-red-100 dark:bg-red-900/30 ring-red-100 dark:ring-red-900/20'
              }`}>
                {confirmAction.type === 'paid' ? (
                  <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle size={28} className="text-red-600 dark:text-red-400" />
                )}
              </div>
              <h3 className="text-lg font-bold text-rf-dark dark:text-gray-100 mb-2">
                {confirmAction.type === 'paid' ? 'Marcar como vendido' : 'Eliminar apartado'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
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

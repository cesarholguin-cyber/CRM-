import { useState, useEffect } from 'react';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { ShoppingCart, Plus, TrendingUp, DollarSign, Calendar, LayoutGrid, List, ChevronDown, X } from 'lucide-react';

const statusConfig = {
  reserved: { label: 'Apartado', color: 'bg-amber-100/80 text-amber-700 border-amber-200/50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50', dot: 'bg-amber-500' },
  option_signed: { label: 'Opción Firmada', color: 'bg-blue-100/80 text-blue-700 border-blue-200/50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50', dot: 'bg-blue-500' },
  contract_signed: { label: 'Contrato Firmado', color: 'bg-indigo-100/80 text-indigo-700 border-indigo-200/50 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800/50', dot: 'bg-indigo-500' },
  financing: { label: 'Financiamiento', color: 'bg-purple-100/80 text-purple-700 border-purple-200/50 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50', dot: 'bg-purple-500' },
  paid: { label: 'Pagado', color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/50 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100/80 text-red-700 border-red-200/50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50', dot: 'bg-red-500' },
  reversed: { label: 'Reversado', color: 'bg-gray-100/80 text-gray-600 border-gray-200/50 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-600/50', dot: 'bg-gray-400' },
};

const pipelineStages = ['reserved', 'option_signed', 'contract_signed', 'financing', 'paid'];

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [lots, setLots] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ client_id: '', lot_id: '', sale_price: '', down_payment: '', payment_terms_months: 24, interest_rate: 12 });
  const [quote, setQuote] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    loadSales();
    projectsApi.list().then((r) => setProjects(r.data)).catch(() => {});
    clientsApi.list().then((r) => setClients(r.data)).catch(() => {});
  }, [filter]);

  const loadSales = () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;
    salesApi.list(params).then((r) => setSales(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  const loadLots = (projectId) => {
    if (!projectId) return;
    lotsApi.list(projectId, { status: 'available' }).then((r) => setLots(r.data)).catch(() => {});
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await salesApi.create({
        ...form,
        client_id: parseInt(form.client_id),
        lot_id: parseInt(form.lot_id),
        sale_price: parseFloat(form.sale_price),
        down_payment: parseFloat(form.down_payment || 0),
        payment_terms_months: parseInt(form.payment_terms_months || 24),
        interest_rate: parseFloat(form.interest_rate || 0),
      });
      setSales([res.data, ...sales]);
      setShowModal(false);
      resetForm();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear venta');
    }
  };

  const handleQuote = async () => {
    if (!form.lot_id) return alert('Selecciona un lote');
    try {
      const res = await salesApi.quote({
        lot_id: parseInt(form.lot_id),
        down_payment_percentage: 30,
        payment_terms_months: parseInt(form.payment_terms_months || 24),
        interest_rate: parseFloat(form.interest_rate || 12),
      });
      setQuote(res.data);
      setForm({ ...form, sale_price: res.data.total_price, down_payment: res.data.down_payment });
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const resetForm = () => {
    setForm({ client_id: '', lot_id: '', sale_price: '', down_payment: '', payment_terms_months: 24, interest_rate: 12 });
    setQuote(null);
    setSelectedProject('');
    setLots([]);
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const findClientName = (id) => clients.find((c) => c.id === id)?.full_name || `Cliente #${id}`;
  const getSalesByStatus = (status) => sales.filter((s) => s.status === status);

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-slide-up">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark dark:text-gray-100 tracking-tight">Ventas</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200/60">
              {sales.length}
            </span>
          </div>
          <p className="text-sm text-rf-gray-light dark:text-gray-500">Gestiona apartados, contratos y financiamiento</p>
        </div>
        <button onClick={openNew} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Nueva Venta
        </button>
      </div>

      {/* Filter Bar + View Toggle */}
      <div className="glass-panel rounded-2xl p-3 shadow-premium-sm mb-6 flex flex-wrap gap-2 items-center animate-slide-up stagger-1">
        <div className="flex gap-1 flex-wrap flex-1">
          {['', 'reserved', 'option_signed', 'contract_signed', 'financing', 'paid', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                filter === s
                  ? 'bg-rf-green-800 text-white shadow-premium-xs'
                  : 'text-rf-gray hover:bg-gray-100 hover:text-rf-dark dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-100'
              }`}
            >
              {s ? (statusConfig[s]?.label || s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : 'Todas'}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-700/50 p-0.5 rounded-lg">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'list' ? 'bg-white dark:bg-[#1a1d27] text-rf-dark dark:text-gray-100 shadow-premium-xs' : 'text-rf-gray-light dark:text-gray-500 hover:text-rf-gray dark:hover:text-gray-400'}`}
            title="Vista lista"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'pipeline' ? 'bg-white dark:bg-[#1a1d27] text-rf-dark dark:text-gray-100 shadow-premium-xs' : 'text-rf-gray-light dark:text-gray-500 hover:text-rf-gray dark:hover:text-gray-400'}`}
            title="Vista pipeline"
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-[3px] border-rf-green-100 dark:border-rf-green-800/50 border-t-rf-green-800 rounded-full animate-spin" />
        </div>
      ) : sales.length === 0 ? (
        /* Empty State */
        <div className="card p-16 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200/50 dark:border-amber-800/50 flex items-center justify-center">
            <ShoppingCart size={28} className="text-amber-400 dark:text-amber-300" />
          </div>
          <h3 className="text-lg font-semibold text-rf-dark dark:text-gray-100 mb-1.5">No hay ventas</h3>
          <p className="text-sm text-rf-gray-light dark:text-gray-500 mb-6 max-w-sm mx-auto">Registra tu primera venta para empezar a dar seguimiento</p>
          <button onClick={openNew} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Registrar Primera Venta
          </button>
        </div>
      ) : viewMode === 'pipeline' ? (
        /* Pipeline View */
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {pipelineStages.map((stage, stageIdx) => {
            const stageSales = getSalesByStatus(stage);
            const cfg = statusConfig[stage];
            return (
              <div key={stage} className={`min-w-[280px] flex-shrink-0 snap-start animate-fade-in stagger-${Math.min(stageIdx + 1, 9)}`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <h3 className="text-sm font-semibold text-rf-dark dark:text-gray-100">{cfg.label}</h3>
                  </div>
                  <span className={`badge text-[10px] py-0 px-1.5 ${cfg.color}`}>{stageSales.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {stageSales.length === 0 ? (
                    <div className="border border-dashed border-gray-200 dark:border-gray-600/50 rounded-xl p-4 text-center">
                      <p className="text-xs text-rf-gray-light dark:text-gray-500">Sin ventas</p>
                    </div>
                  ) : stageSales.map((sale, i) => (
                    <div
                      key={sale.id}
                      className={`card-hover p-4 cursor-pointer animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-sm text-rf-dark dark:text-gray-100">Venta #{sale.id}</p>
                        <span className="text-xs font-bold text-rf-green-800 dark:text-rf-green-300">${(sale.sale_price || 0).toLocaleString('es-MX')}</span>
                      </div>
                      <p className="text-xs text-rf-gray-light dark:text-gray-500 mb-1">{findClientName(sale.client_id)}</p>
                      {sale.monthly_payment && (
                        <div className="flex items-center gap-3 text-[11px] text-rf-gray-light dark:text-gray-500 mt-2 pt-2 border-t border-gray-100 dark:border-t-gray-700/50">
                          <span className="flex items-center gap-1"><DollarSign size={10} /> ${sale.monthly_payment.toLocaleString('es-MX')}/mes</span>
                          <span className="flex items-center gap-1"><Calendar size={10} /> {sale.payment_terms_months} meses</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {sales.map((sale, i) => {
            const cfg = statusConfig[sale.status] || statusConfig.reserved;
            return (
              <div
                key={sale.id}
                className={`card-hover p-5 group animate-fade-in stagger-${Math.min(i + 1, 9)}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rf-green-50 dark:bg-rf-green-900/30 border border-rf-green-200/50 dark:border-rf-green-800/50 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart size={18} className="text-rf-green-700 dark:text-rf-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-rf-dark dark:text-gray-100">Venta #{sale.id}</p>
                      <p className="text-sm text-rf-gray-light dark:text-gray-500">{findClientName(sale.client_id)} · Lote #{sale.lot_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-lg font-bold text-rf-dark dark:text-gray-100">${(sale.sale_price || 0).toLocaleString('es-MX')}</span>
                  </div>
                </div>
                {sale.monthly_payment && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-t-gray-700/50 text-xs text-rf-gray dark:text-gray-400">
                    <span className="flex items-center gap-1.5"><DollarSign size={12} className="text-rf-gray-light dark:text-gray-500" /> Pago mensual: <strong className="text-rf-dark dark:text-gray-100">${sale.monthly_payment.toLocaleString('es-MX')}</strong></span>
                    <span className="flex items-center gap-1.5"><Calendar size={12} className="text-rf-gray-light dark:text-gray-500" /> Plazo: <strong className="text-rf-dark dark:text-gray-100">{sale.payment_terms_months} meses</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-[#1a1d27] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-premium-xl animate-scale-in border border-gray-100 dark:border-gray-700/50" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Nueva Venta</h2>
                <p className="text-xs text-rf-gray-light dark:text-gray-500 mt-0.5">Registra una nueva operación de venta</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-rf-gray-light dark:text-gray-500 hover:text-rf-dark dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Step 1: Selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-rf-green-800 text-white flex items-center justify-center text-[10px] font-bold">1</div>
                  <span className="text-sm font-semibold text-rf-dark dark:text-gray-100">Selección</span>
                </div>
                <div className="space-y-3 pl-1">
                  <div>
                    <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Cliente</label>
                    <div className="relative">
                      <select
                        value={form.client_id}
                        onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                        className="input appearance-none cursor-pointer pr-8"
                        required
                      >
                        <option value="">Seleccionar cliente</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Proyecto</label>
                    <div className="relative">
                      <select
                        value={selectedProject}
                        onChange={(e) => { setSelectedProject(e.target.value); loadLots(e.target.value); }}
                        className="input appearance-none cursor-pointer pr-8"
                      >
                        <option value="">Seleccionar proyecto</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Lote</label>
                    <div className="relative">
                      <select
                        value={form.lot_id}
                        onChange={(e) => setForm({ ...form, lot_id: e.target.value })}
                        className="input appearance-none cursor-pointer pr-8"
                        required
                      >
                        <option value="">Seleccionar lote</option>
                        {lots.map((l) => <option key={l.id} value={l.id}>Lote #{l.lot_number} - {l.area_sqm}m² - ${(l.total_price || 0).toLocaleString('es-MX')}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light dark:text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quote Section */}
              <div className="border border-gray-100 dark:border-gray-700/50 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50">
                <button type="button" onClick={handleQuote} className="btn-secondary w-full inline-flex items-center justify-center gap-2">
                  <TrendingUp size={15} />
                  Calcular cotización
                </button>

                {quote && (
                  <div className="mt-4 space-y-2 text-sm animate-scale-in">
                    <p className="font-semibold text-rf-dark dark:text-gray-100 flex items-center gap-2 mb-3">
                      <TrendingUp size={14} className="text-rf-green-700 dark:text-rf-green-400" />
                      Resumen de Cotización
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-rf-gray dark:text-gray-400">Precio total:</span>
                      <span className="font-medium text-right text-rf-dark dark:text-gray-100">${quote.total_price.toLocaleString('es-MX')}</span>
                      <span className="text-rf-gray dark:text-gray-400">Enganche (30%):</span>
                      <span className="font-medium text-right text-rf-dark dark:text-gray-100">${quote.down_payment.toLocaleString('es-MX')}</span>
                      <span className="text-rf-gray dark:text-gray-400">Mensualidades:</span>
                      <span className="font-medium text-right text-rf-dark dark:text-gray-100">${quote.monthly_payment.toLocaleString('es-MX')} x {quote.payment_terms_months} meses</span>
                      <div className="col-span-2 grid grid-cols-2 pt-2 mt-1 border-t border-gray-200 dark:border-gray-600/50">
                        <span className="text-rf-gray dark:text-gray-400 font-medium">Total a pagar:</span>
                        <span className="font-bold text-rf-green-800 dark:text-rf-green-300 text-right">${quote.total_to_pay.toLocaleString('es-MX')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Financial Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-rf-green-800 text-white flex items-center justify-center text-[10px] font-bold">2</div>
                  <span className="text-sm font-semibold text-rf-dark dark:text-gray-100">Detalles financieros</span>
                </div>
                <div className="space-y-3 pl-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Precio de venta</label>
                      <input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Enganche</label>
                      <input type="number" value={form.down_payment} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} className="input" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Plazo (meses)</label>
                      <input type="number" value={form.payment_terms_months} onChange={(e) => setForm({ ...form, payment_terms_months: e.target.value })} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Interés anual (%)</label>
                      <input type="number" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} className="input" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Crear Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

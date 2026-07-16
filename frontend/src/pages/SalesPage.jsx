import { useState, useEffect } from 'react';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { ShoppingCart, Plus, Search, TrendingUp, DollarSign, Calendar } from 'lucide-react';

const statusConfig = {
  reserved: { label: 'Apartado', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  option_signed: { label: 'Opción Firmada', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  contract_signed: { label: 'Contrato Firmado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  financing: { label: 'Financiamiento', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  paid: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  reversed: { label: 'Reversado', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
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

  const findClientName = (id) => clients.find((c) => c.id === id)?.full_name || `Cliente #${id}`;

  const getSalesByStatus = (status) => sales.filter((s) => s.status === status);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Ventas</h1>
            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{sales.length} total</span>
          </div>
          <p className="text-base text-rf-gray-light mt-1">Gestiona apartados, contratos y financiamiento</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 text-sm font-medium shadow-md">
          <Plus size={18} /> Nueva Venta
        </button>
      </div>

      {/* Filters + View toggle */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 mb-6 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="flex gap-1.5 flex-wrap">
          {['', 'reserved', 'option_signed', 'contract_signed', 'financing', 'paid', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${filter === s ? 'bg-rf-green-800 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
              {s ? (statusConfig[s]?.label || s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())) : 'Todas'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white text-rf-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            Lista
          </button>
          <button onClick={() => setViewMode('pipeline')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'pipeline' ? 'bg-white text-rf-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            Pipeline
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-rf-green-100 border-t-rf-green-800 rounded-full animate-spin" />
            <div className="w-12 h-12 border-4 border-rf-green-200 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-16 border border-dashed border-gray-200 text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center">
            <ShoppingCart size={40} className="text-rf-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">No hay ventas</h3>
          <p className="text-gray-400 mb-6">Registra tu primera venta para empezar a dar seguimiento</p>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="inline-flex items-center gap-2 bg-rf-green-800 text-white px-5 py-2.5 rounded-xl hover:bg-rf-green-700 transition-all text-sm font-medium shadow-md">
            <Plus size={18} /> Registrar Primera Venta
          </button>
        </div>
      ) : viewMode === 'pipeline' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {pipelineStages.map((stage, stageIdx) => {
            const stageSales = getSalesByStatus(stage);
            const cfg = statusConfig[stage];
            return (
              <div key={stage} className="min-w-[280px] flex-shrink-0 snap-start" style={{ animation: `slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${stageIdx * 80}ms both` }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <h3 className="text-sm font-semibold text-rf-dark">{cfg.label}</h3>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{stageSales.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {stageSales.length === 0 ? (
                    <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400">Sin ventas</p>
                    </div>
                  ) : stageSales.map((sale, i) => (
                    <div
                      key={sale.id}
                      className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                      style={{ animation: `scale-in 0.3s ease-out ${i * 50}ms both` }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-sm text-rf-dark">Venta #{sale.id}</p>
                        <span className="text-xs font-bold text-rf-green-800">${(sale.sale_price || 0).toLocaleString('es-MX')}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-1">{findClientName(sale.client_id)}</p>
                      {sale.monthly_payment && (
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-50">
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
        <div className="space-y-3">
          {sales.map((sale, i) => {
            const cfg = statusConfig[sale.status] || statusConfig.reserved;
            return (
              <div
                key={sale.id}
                className="group bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover:-translate-y-0.5"
                style={{ animation: `slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 50}ms both` }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <ShoppingCart size={18} className="text-rf-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-rf-dark">Venta #{sale.id}</p>
                      <p className="text-sm text-gray-400">{findClientName(sale.client_id)} · Lote #{sale.lot_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="text-lg font-bold text-rf-green-800">${(sale.sale_price || 0).toLocaleString('es-MX')}</span>
                  </div>
                </div>
                {sale.monthly_payment && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><DollarSign size={12} /> Pago mensual: <strong className="text-rf-dark">${sale.monthly_payment.toLocaleString('es-MX')}</strong></span>
                    <span className="flex items-center gap-1.5"><Calendar size={12} /> Plazo: <strong className="text-rf-dark">{sale.payment_terms_months} meses</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-rf-dark mb-6">Nueva Venta</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Cliente</label>
                <select value={form.client_id} onChange={(e) => setForm({...form, client_id: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" required>
                  <option value="">Seleccionar cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Proyecto</label>
                <select value={selectedProject} onChange={(e) => { setSelectedProject(e.target.value); loadLots(e.target.value); }} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all">
                  <option value="">Seleccionar proyecto</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Lote</label>
                <select value={form.lot_id} onChange={(e) => setForm({...form, lot_id: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" required>
                  <option value="">Seleccionar lote</option>
                  {lots.map((l) => <option key={l.id} value={l.id}>Lote #{l.lot_number} - {l.area_sqm}m² - ${(l.total_price || 0).toLocaleString('es-MX')}</option>)}
                </select>
              </div>

              <button type="button" onClick={handleQuote} className="w-full py-2.5 bg-gradient-to-r from-rf-gold to-rf-gold-dark text-white rounded-xl hover:from-rf-gold-dark hover:to-rf-gold hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">
                Calcular cotización
              </button>

              {quote && (
                <div className="bg-gradient-to-br from-rf-green-50 to-white rounded-xl p-4 border border-rf-green-100 space-y-2 text-sm animate-scale-in">
                  <p className="font-semibold text-rf-dark flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-rf-green-600" />
                    Cotización
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-gray-500">Precio total:</span><span className="font-medium text-right text-rf-dark">${quote.total_price.toLocaleString('es-MX')}</span>
                    <span className="text-gray-500">Enganche (30%):</span><span className="font-medium text-right text-rf-dark">${quote.down_payment.toLocaleString('es-MX')}</span>
                    <span className="text-gray-500">Mensualidades:</span><span className="font-medium text-right text-rf-dark">${quote.monthly_payment.toLocaleString('es-MX')} x {quote.payment_terms_months} meses</span>
                    <span className="text-gray-500 border-t border-rf-green-100 pt-1">Total a pagar:</span><span className="font-bold text-rf-green-800 text-right border-t border-rf-green-100 pt-1">${quote.total_to_pay.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Precio de venta</label>
                  <input type="number" value={form.sale_price} onChange={(e) => setForm({...form, sale_price: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Enganche</label>
                  <input type="number" value={form.down_payment} onChange={(e) => setForm({...form, down_payment: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Plazo (meses)</label>
                  <input type="number" value={form.payment_terms_months} onChange={(e) => setForm({...form, payment_terms_months: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Interés anual (%)</label>
                  <input type="number" value={form.interest_rate} onChange={(e) => setForm({...form, interest_rate: e.target.value})} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 focus:bg-white transition-all" />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">Crear Venta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

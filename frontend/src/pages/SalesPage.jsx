import { useState, useEffect } from 'react';
import { salesApi, clientsApi, lotsApi, projectsApi } from '../lib/api';
import { ShoppingCart, Plus, Search } from 'lucide-react';

const statusColors = {
  reserved: 'bg-amber-100 text-amber-700',
  option_signed: 'bg-blue-100 text-blue-700',
  contract_signed: 'bg-indigo-100 text-indigo-700',
  financing: 'bg-purple-100 text-purple-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  reversed: 'bg-gray-100 text-gray-600',
};

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
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

  const getStatusBadge = (status) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || ''}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Ventas</h1>
          <p className="text-sm text-rf-gray-light mt-1">Gestiona apartados, contratos y financiamiento</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-rf-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-rf-green-700 hover:shadow-lg transition-all text-sm font-medium active:scale-95">
          <Plus size={18} /> Nueva Venta
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-6 flex gap-2 flex-wrap">
        {['', 'reserved', 'option_signed', 'contract_signed', 'financing', 'paid', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === s ? 'bg-rf-green-800 text-white' : 'bg-rf-cream text-rf-gray hover:bg-rf-cream-dark'}`}>
            {s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-rf-green-600 border-t-transparent rounded-full" /></div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-rf-cream-dark text-center">
          <ShoppingCart size={48} className="mx-auto text-rf-green-300 mb-4" />
          <h3 className="text-lg font-medium text-rf-dark mb-2">No hay ventas</h3>
          <p className="text-sm text-rf-gray-light">Registra tu primera venta para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale, i) => (
            <div key={sale.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover:-translate-y-0.5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-rf-dark">Venta #{sale.id}</p>
                  <p className="text-sm text-rf-gray-light">Cliente ID: {sale.client_id} · Lote ID: {sale.lot_id}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(sale.status)}
                  <span className="font-bold text-rf-green-800">${(sale.sale_price || 0).toLocaleString('es-MX')}</span>
                </div>
              </div>
              {sale.monthly_payment && (
                <p className="text-xs text-rf-gray mt-1">Pago mensual: ${sale.monthly_payment.toLocaleString('es-MX')} · {sale.payment_terms_months} meses</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-rf-dark mb-4">Nueva Venta</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Cliente</label>
                <select value={form.client_id} onChange={(e) => setForm({...form, client_id: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required>
                  <option value="">Seleccionar cliente</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Proyecto</label>
                <select value={selectedProject} onChange={(e) => { setSelectedProject(e.target.value); loadLots(e.target.value); }} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500">
                  <option value="">Seleccionar proyecto</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Lote</label>
                <select value={form.lot_id} onChange={(e) => setForm({...form, lot_id: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required>
                  <option value="">Seleccionar lote</option>
                  {lots.map((l) => <option key={l.id} value={l.id}>Lote #{l.lot_number} - {l.area_sqm}m² - ${(l.total_price || 0).toLocaleString('es-MX')}</option>)}
                </select>
              </div>

              <button type="button" onClick={handleQuote} className="w-full py-2 bg-rf-gold text-white rounded-lg hover:bg-rf-gold-dark transition text-sm font-medium">
                Calcular cotización
              </button>

              {quote && (
                <div className="bg-rf-cream rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-medium text-rf-dark">Cotización:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-rf-gray">Precio total:</span><span className="font-medium text-right">${quote.total_price.toLocaleString('es-MX')}</span>
                    <span className="text-rf-gray">Enganche (30%):</span><span className="font-medium text-right">${quote.down_payment.toLocaleString('es-MX')}</span>
                    <span className="text-rf-gray">Mensualidades:</span><span className="font-medium text-right">${quote.monthly_payment.toLocaleString('es-MX')} x {quote.payment_terms_months} meses</span>
                    <span className="text-rf-gray">Total a pagar:</span><span className="font-bold text-rf-green-800 text-right">${quote.total_to_pay.toLocaleString('es-MX')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Precio de venta</label>
                  <input type="number" value={form.sale_price} onChange={(e) => setForm({...form, sale_price: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Enganche</label>
                  <input type="number" value={form.down_payment} onChange={(e) => setForm({...form, down_payment: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Plazo (meses)</label>
                  <input type="number" value={form.payment_terms_months} onChange={(e) => setForm({...form, payment_terms_months: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Interés anual (%)</label>
                  <input type="number" value={form.interest_rate} onChange={(e) => setForm({...form, interest_rate: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-rf-cream-dark rounded-lg text-rf-gray hover:bg-rf-cream transition text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-rf-green-800 text-white rounded-lg hover:bg-rf-green-700 transition text-sm font-medium">Crear Venta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

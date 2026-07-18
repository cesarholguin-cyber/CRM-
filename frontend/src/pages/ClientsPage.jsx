import { useState, useEffect } from 'react';
import { clientsApi } from '../lib/api';
import { Users, Plus, Search, Phone, Mail, MessageCircle, Filter, UserPlus, Sparkles } from 'lucide-react';

const statusConfig = {
  lead: { label: 'Lead', color: 'bg-gray-100/80 text-gray-600 border-gray-200/50', dot: 'bg-gray-400' },
  contacted: { label: 'Contactado', color: 'bg-blue-100/80 text-blue-700 border-blue-200/50', dot: 'bg-blue-500' },
  visit_scheduled: { label: 'Visita Agendada', color: 'bg-purple-100/80 text-purple-700 border-purple-200/50', dot: 'bg-purple-500' },
  visit_completed: { label: 'Visita Realizada', color: 'bg-indigo-100/80 text-indigo-700 border-indigo-200/50', dot: 'bg-indigo-500' },
  interested: { label: 'Interesado', color: 'bg-amber-100/80 text-amber-700 border-amber-200/50', dot: 'bg-amber-500' },
  reservation: { label: 'Apartado', color: 'bg-orange-100/80 text-orange-700 border-orange-200/50', dot: 'bg-orange-500' },
  sold: { label: 'Vendido', color: 'bg-rf-green-100/80 text-rf-green-800 border-rf-green-600/50', dot: 'bg-rf-green-800' },
  lost: { label: 'Perdido', color: 'bg-red-100/80 text-red-700 border-red-200/50', dot: 'bg-red-500' },
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', notes: '', status: 'lead' });

  useEffect(() => {
    loadClients();
  }, [statusFilter]);

  const loadClients = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (search) params.search = search;
    clientsApi.list(params)
      .then((res) => setClients(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedClient) {
        const res = await clientsApi.update(selectedClient.id, form);
        setClients(clients.map(c => c.id === selectedClient.id ? res.data : c));
      } else {
        const res = await clientsApi.create(form);
        setClients([res.data, ...clients]);
      }
      setShowModal(false);
      setSelectedClient(null);
      setForm({ full_name: '', email: '', phone: '', notes: '', status: 'lead' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const openEdit = (client) => {
    setSelectedClient(client);
    setForm({ full_name: client.full_name, email: client.email || '', phone: client.phone || '', notes: client.notes || '', status: client.status });
    setShowModal(true);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Clientes</h1>
            <span className="px-2.5 py-0.5 bg-rf-green-100/80 backdrop-blur-sm text-rf-green-800 rounded-full text-xs font-medium border border-rf-green-200/50 shadow-sm">{clients.length} total</span>
          </div>
          <p className="text-base text-rf-gray-light mt-1">Gestiona leads, prospectos y compradores</p>
        </div>
        <button onClick={() => { setSelectedClient(null); setForm({ full_name: '', email: '', phone: '', notes: '', status: 'lead' }); setShowModal(true); }} className="relative overflow-hidden group bg-gradient-to-r from-rf-green-800 via-rf-green-700 to-rf-green-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:from-rf-green-700 hover:via-rf-green-600 hover:to-rf-green-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 text-sm font-medium shadow-md">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <UserPlus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-sm mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadClients()} placeholder="Buscar clientes por nombre..." className="w-full pl-10 pr-3 py-2.5 border border-gray-200/80 rounded-xl text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-300" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200/80 rounded-xl px-3 py-2.5 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm">
            <option value="">Todos los estados</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-14 h-14 border-[3px] border-rf-green-100/50 border-t-rf-green-800 rounded-full animate-spin" />
            <div className="w-14 h-14 border-[3px] border-rf-green-200/30 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-16 border border-dashed border-white/50 text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center shadow-lg">
            <Users size={40} className="text-rf-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">No hay clientes</h3>
          <p className="text-gray-400 mb-6">Registra tu primer cliente para empezar a gestionar ventas</p>
          <button onClick={() => { setSelectedClient(null); setForm({ full_name: '', email: '', phone: '', notes: '', status: 'lead' }); setShowModal(true); }} className="inline-flex items-center gap-2 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white px-5 py-2.5 rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all text-sm font-medium shadow-md">
            <UserPlus size={18} /> Registrar Primer Cliente
          </button>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/30 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100/50 bg-gray-50/30">
                  <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Contacto</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Origen</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Creado</th>
                  <th className="px-4 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => {
                  const cfg = statusConfig[client.status] || statusConfig.lead;
                  return (
                    <tr
                      key={client.id}
                      className="border-b border-gray-50 hover:bg-rf-green-50/30 transition-all duration-200 cursor-pointer group"
                      onClick={() => openEdit(client)}
                      style={{ animation: `slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 40}ms both` }}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rf-green-700 to-rf-green-900 text-white flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                            {client.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-rf-dark group-hover:text-rf-green-800 transition-colors">{client.full_name}</p>
                            {client.notes && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{client.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          {client.email && (
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Mail size={12} className="text-gray-300" />
                              {client.email}
                            </span>
                          )}
                          {client.phone && (
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Phone size={12} className="text-gray-300" />
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-400 hidden md:table-cell capitalize">{client.lead_source || '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-400 hidden md:table-cell">{client.created_at ? new Date(client.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          {client.phone && (
                            <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-gray-300 hover:text-emerald-500 hover:bg-emerald-50/80 transition-all duration-200 hover:scale-110" title="Enviar WhatsApp">
                              <MessageCircle size={16} />
                            </a>
                          )}
                          {client.email && (
                            <a href={`mailto:${client.email}`} className="p-2 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50/80 transition-all duration-200 hover:scale-110" title="Enviar correo">
                              <Mail size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-800 to-rf-green-700 flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rf-dark">{selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">{selectedClient ? 'Actualiza los datos del cliente' : 'Registra un nuevo cliente en el sistema'}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Nombre completo *</label>
                <input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="Nombre del cliente" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="+52 555 555 5555" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Estado</label>
                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md">
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={3} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md resize-none" placeholder="Notas adicionales..." />
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">{selectedClient ? 'Guardar' : 'Crear Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

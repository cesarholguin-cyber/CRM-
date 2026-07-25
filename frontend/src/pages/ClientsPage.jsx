import { useState, useEffect } from 'react';
import { clientsApi } from '../lib/api';
import { Users, Plus, Search, Phone, Mail, MessageCircle, Filter, UserPlus, ChevronDown, X } from 'lucide-react';

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

  const openNew = () => {
    setSelectedClient(null);
    setForm({ full_name: '', email: '', phone: '', notes: '', status: 'lead' });
    setShowModal(true);
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-slide-up">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark tracking-tight">Clientes</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rf-green-100 text-rf-green-800 border border-rf-green-200/60">
              {clients.length}
            </span>
          </div>
          <p className="text-sm text-rf-gray-light">Gestiona leads, prospectos y compradores</p>
        </div>
        <button onClick={openNew} className="btn-primary inline-flex items-center gap-2">
          <UserPlus size={16} /> Nuevo Cliente
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 shadow-premium-sm mb-6 flex flex-wrap gap-3 items-center animate-slide-up stagger-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rf-gray-light" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadClients()}
            placeholder="Buscar clientes por nombre..."
            className="input pl-10"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-rf-gray-light pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input pl-9 pr-8 appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light pointer-events-none" />
        </div>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="btn-ghost inline-flex items-center gap-1.5 text-xs">
            <X size={14} /> Limpiar filtro
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-[3px] border-rf-green-100 border-t-rf-green-800 rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        /* Empty State */
        <div className="card p-16 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-rf-green-50 border border-rf-green-200/50 flex items-center justify-center">
            <Users size={28} className="text-rf-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-rf-dark mb-1.5">No hay clientes</h3>
          <p className="text-sm text-rf-gray-light mb-6 max-w-sm mx-auto">Registra tu primer cliente para empezar a gestionar ventas</p>
          <button onClick={openNew} className="btn-primary inline-flex items-center gap-2">
            <UserPlus size={16} /> Registrar Primer Cliente
          </button>
        </div>
      ) : (
        /* Table */
        <div className="card shadow-premium-sm overflow-hidden animate-slide-up stagger-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-rf-gray-light uppercase tracking-wider">Nombre</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-rf-gray-light uppercase tracking-wider hidden sm:table-cell">Contacto</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-rf-gray-light uppercase tracking-wider">Estado</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-rf-gray-light uppercase tracking-wider hidden md:table-cell">Origen</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-rf-gray-light uppercase tracking-wider hidden md:table-cell">Creado</th>
                  <th className="px-5 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => {
                  const cfg = statusConfig[client.status] || statusConfig.lead;
                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors duration-150 cursor-pointer group animate-fade-in stagger-${Math.min(i + 1, 9)}`}
                      onClick={() => openEdit(client)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-rf-green-800 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                            {getInitials(client.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-rf-dark group-hover:text-rf-green-800 transition-colors truncate">{client.full_name}</p>
                            {client.notes && <p className="text-[11px] text-rf-gray-light mt-0.5 line-clamp-1">{client.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          {client.email && (
                            <span className="text-xs text-rf-gray flex items-center gap-1.5">
                              <Mail size={12} className="text-rf-gray-light flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{client.email}</span>
                            </span>
                          )}
                          {client.phone && (
                            <span className="text-xs text-rf-gray flex items-center gap-1.5">
                              <Phone size={12} className="text-rf-gray-light flex-shrink-0" />
                              {client.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`badge ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-rf-gray capitalize hidden md:table-cell">{client.lead_source || '—'}</td>
                      <td className="px-5 py-3.5 text-sm text-rf-gray hidden md:table-cell">{client.created_at ? new Date(client.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                          {client.phone && (
                            <a
                              href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-rf-gray-light hover:text-emerald-600 hover:bg-emerald-50 transition-colors duration-150"
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}
                          {client.email && (
                            <a
                              href={`mailto:${client.email}`}
                              className="p-1.5 rounded-lg text-rf-gray-light hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150"
                              title="Enviar correo"
                            >
                              <Mail size={15} />
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-premium-xl animate-scale-in border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-rf-dark">{selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">{selectedClient ? 'Actualiza los datos del cliente' : 'Registra un nuevo cliente en el sistema'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-rf-gray-light hover:text-rf-dark hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Nombre completo *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input"
                  placeholder="Nombre del cliente"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Teléfono</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="input"
                    placeholder="+52 555 555 5555"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Estado</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input appearance-none cursor-pointer pr-8"
                  >
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder="Notas adicionales..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {selectedClient ? 'Guardar Cambios' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

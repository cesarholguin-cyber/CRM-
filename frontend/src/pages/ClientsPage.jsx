import { useState, useEffect } from 'react';
import { clientsApi, usersApi, projectsApi } from '../lib/api';
import { Users, Plus, Search, Phone, Mail, MessageCircle } from 'lucide-react';

const statusColors = {
  lead: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-100 text-blue-600',
  visit_scheduled: 'bg-purple-100 text-purple-600',
  visit_completed: 'bg-indigo-100 text-indigo-600',
  interested: 'bg-amber-100 text-amber-600',
  reservation: 'bg-orange-100 text-orange-600',
  sold: 'bg-rf-green-800 text-white',
  lost: 'bg-red-100 text-red-600',
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Clientes</h1>
          <p className="text-sm text-rf-gray-light mt-1">Gestiona leads, prospectos y compradores</p>
        </div>
        <button onClick={() => { setSelectedClient(null); setForm({ full_name: '', email: '', phone: '', notes: '', status: 'lead' }); setShowModal(true); }} className="bg-rf-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-rf-green-700 transition text-sm font-medium">
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl p-4 border border-rf-cream-dark mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rf-gray-light" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadClients()} placeholder="Buscar clientes..." className="w-full pl-9 pr-3 py-2 border border-rf-cream-dark rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-rf-cream-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rf-green-500">
          <option value="">Todos los estados</option>
          {Object.keys(statusColors).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-rf-green-600 border-t-transparent rounded-full" /></div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-rf-cream-dark text-center">
          <Users size={48} className="mx-auto text-rf-green-300 mb-4" />
          <h3 className="text-lg font-medium text-rf-dark mb-2">No hay clientes</h3>
          <p className="text-sm text-rf-gray-light">Registra tu primer cliente para empezar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-rf-cream-dark overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-rf-cream-dark bg-rf-cream">
                <th className="text-left px-4 py-3 text-xs font-medium text-rf-gray-light uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-rf-gray-light uppercase hidden sm:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-rf-gray-light uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-rf-gray-light uppercase hidden md:table-cell">Origen</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-rf-gray-light uppercase hidden md:table-cell">Creado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-rf-cream-dark hover:bg-rf-green-50/50 transition cursor-pointer" onClick={() => openEdit(client)}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-rf-dark">{client.full_name}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-col gap-1">
                      {client.email && <span className="text-xs text-rf-gray flex items-center gap-1"><Mail size={12} />{client.email}</span>}
                      {client.phone && <span className="text-xs text-rf-gray flex items-center gap-1"><Phone size={12} />{client.phone}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[client.status] || ''}`}>
                      {client.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-rf-gray hidden md:table-cell capitalize">{client.lead_source}</td>
                  <td className="px-4 py-3 text-sm text-rf-gray-light hidden md:table-cell">{new Date(client.created_at).toLocaleDateString('es-MX')}</td>
                  <td className="px-4 py-3 text-right">
                    <a href={`https://wa.me/${client.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-rf-green-600 hover:text-rf-green-800" onClick={(e) => e.stopPropagation()}>
                      <MessageCircle size={18} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-rf-dark mb-4">{selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Nombre completo *</label>
                <input value={form.full_name} onChange={(e) => setForm({...form, full_name: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Estado</label>
                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500">
                  {Object.keys(statusColors).map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} rows={3} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-rf-cream-dark rounded-lg text-rf-gray hover:bg-rf-cream transition text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-rf-green-800 text-white rounded-lg hover:bg-rf-green-700 transition text-sm font-medium">{selectedClient ? 'Guardar' : 'Crear Cliente'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

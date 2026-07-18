import { useState, useEffect } from 'react';
import { projectsApi } from '../lib/api';
import { Plus, ExternalLink, Map, Building2, Layers, DollarSign, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusStyles = {
  active: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/50 backdrop-blur-sm',
  completed: 'bg-blue-100/80 text-blue-700 border-blue-200/50 backdrop-blur-sm',
  paused: 'bg-amber-100/80 text-amber-700 border-amber-200/50 backdrop-blur-sm',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', price_per_sqm: 1000, total_lots: 0, city: '', state: '' });

  useEffect(() => {
    projectsApi.list()
      .then((res) => setProjects(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await projectsApi.create({
        ...form,
        price_per_sqm: parseFloat(form.price_per_sqm),
        total_lots: parseInt(form.total_lots),
      });
      setProjects([...projects, res.data]);
      setShowModal(false);
      setForm({ name: '', slug: '', price_per_sqm: 1000, total_lots: 0, city: '', state: '' });
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear proyecto');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-14 h-14 border-[3px] border-rf-green-100/50 border-t-rf-green-800 rounded-full animate-spin" />
          <div className="w-14 h-14 border-[3px] border-rf-green-200/30 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Proyectos</h1>
            <span className="px-2.5 py-0.5 bg-rf-green-100/80 backdrop-blur-sm text-rf-green-800 rounded-full text-xs font-medium border border-rf-green-200/50 shadow-sm">{projects.length} total</span>
          </div>
          <p className="text-base text-rf-gray-light mt-1">Gestiona tus desarrollos campestres</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="relative overflow-hidden group bg-gradient-to-r from-rf-green-800 via-rf-green-700 to-rf-green-800 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:from-rf-green-700 hover:via-rf-green-600 hover:to-rf-green-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-300 text-sm font-medium shadow-md"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Plus size={18} />
          Nuevo Proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-16 border border-dashed border-gray-200/80 text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center shadow-lg">
            <Map size={40} className="text-rf-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">No hay proyectos aún</h3>
          <p className="text-gray-400 mb-6">Crea tu primer proyecto para empezar a gestionar lotes y ventas</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white px-5 py-2.5 rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">
            <Plus size={18} /> Crear Primer Proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="group bg-white rounded-2xl border border-gray-100/80 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 overflow-hidden"
              style={{ animation: `slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms both` }}
            >
              {/* Cover */}
              <div className={`h-44 relative overflow-hidden ${project.cover_image_url ? '' : 'bg-gradient-to-br from-rf-green-800 via-rf-green-700 to-rf-green-900'}`}>
                {project.cover_image_url ? (
                  <img src={project.cover_image_url} alt={project.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Building2 size={48} className="text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border shadow-sm ${statusStyles[project.status] || 'bg-gray-100/80 text-gray-700'}`}>
                    {project.status === 'active' ? 'Activo' : project.status === 'completed' ? 'Completado' : project.status || project.status}
                  </span>
                </div>
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-lg font-bold text-white drop-shadow-lg">{project.name}</h3>
                  {project.city && (
                    <p className="text-sm text-white/80 drop-shadow">{project.city}{project.state ? `, ${project.state}` : ''}</p>
                  )}
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2.5 rounded-xl bg-gradient-to-b from-gray-50 to-white border border-gray-100/80 group-hover:border-gray-200/80 transition-colors">
                    <p className="text-xl font-bold text-rf-dark">{project.total_lots || 0}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Lotes</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-gradient-to-b from-emerald-50 to-white border border-emerald-100/80 group-hover:border-emerald-200/80 transition-colors">
                    <p className="text-xl font-bold text-emerald-600">{project.available_lots || 0}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Disponibles</p>
                  </div>
                  <div className="text-center p-2.5 rounded-xl bg-gradient-to-b from-rf-green-50 to-white border border-rf-green-100/80 group-hover:border-rf-green-200/80 transition-colors">
                    <p className="text-xl font-bold text-rf-green-800">{project.sold_lots || 0}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">Vendidos</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                  <DollarSign size={14} />
                  <span className="font-medium text-rf-dark">${(project.price_per_sqm || 0).toLocaleString('es-MX')}</span>
                  <span className="text-gray-400">/ m²</span>
                </div>

                <Link
                  to={`/lots?project_id=${project.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-rf-green-50 to-white border border-rf-green-200/80 text-rf-green-700 text-sm font-medium hover:from-rf-green-100 hover:to-rf-green-50 hover:border-rf-green-300 hover:shadow-md transition-all duration-300 group/link"
                >
                  <ExternalLink size={16} className="group-hover/link:translate-x-0.5 transition-transform" />
                  Ver lotes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-800 to-rf-green-700 flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rf-dark">Nuevo Proyecto</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">Completa los detalles del desarrollo</p>
              </div>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Nombre</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="Nombre del proyecto" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1.5">Slug (URL)</label>
                <input value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="nombre-del-proyecto" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Ciudad</label>
                  <input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="Ciudad" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Estado</label>
                  <input value={form.state} onChange={(e) => setForm({...form, state: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" placeholder="Estado" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">$/m²</label>
                  <input type="number" value={form.price_per_sqm} onChange={(e) => setForm({...form, price_per_sqm: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1.5">Total de lotes</label>
                  <input type="number" value={form.total_lots} onChange={(e) => setForm({...form, total_lots: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">Crear Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { projectsApi } from '../lib/api';
import { Plus, MapPin, Building2, Layers, DollarSign, FolderOpen, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusStyles = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50',
  completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
  paused: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',
};

const statusLabels = {
  active: 'Activo',
  completed: 'Completado',
  paused: 'Pausado',
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
        <div className="w-8 h-8 border-2 border-gray-200 border-t-rf-green-800 rounded-full animate-spin dark:border-gray-700/50" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-rf-green-800 to-rf-green-400 dark:from-rf-green-400 dark:to-rf-green-800" />
          <h1 className="text-2xl font-bold text-rf-dark dark:text-gray-100 tracking-tight">Proyectos</h1>
          <span className="px-2.5 py-0.5 bg-rf-green-50 text-rf-green-800 dark:bg-rf-green-900/30 dark:text-rf-green-300 rounded-full text-xs font-medium border border-rf-green-200 dark:border-rf-green-800/50">
            {projects.length}
          </span>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Nuevo Proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card p-16 text-center" style={{ animation: 'blur-in 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rf-green-50 dark:bg-rf-green-900/30 flex items-center justify-center">
            <FolderOpen size={32} className="text-rf-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-rf-dark dark:text-gray-100 mb-1.5">No hay proyectos</h3>
          <p className="text-sm text-rf-gray-light dark:text-gray-500 mb-6 max-w-sm mx-auto">Crea tu primer proyecto para empezar a gestionar lotes y ventas</p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Crear Proyecto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project, i) => (
            <div
              key={project.id}
              className="card-hover overflow-hidden relative"
              style={{ animation: 'fade-slide-up 0.5s cubic-bezier(0.16,1,0.3,1) both', animationDelay: `${0.08 * i}s` }}
            >
              <div className="h-40 relative overflow-hidden">
                {project.cover_image_url ? (
                  <>
                    <img src={project.cover_image_url} alt={project.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
                  </>
                ) : (
                  <div className={`flex items-center justify-center h-full ${project.cover_image_url ? '' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                    <Building2 size={36} className="text-gray-200 dark:text-gray-600" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusStyles[project.status] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-600/50'}`}>
                    {statusLabels[project.status] || project.status}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-rf-dark dark:text-gray-100 mb-0.5">{project.name}</h3>
                  {project.city && (
                    <p className="text-xs text-rf-gray-light dark:text-gray-500 flex items-center gap-1">
                      <MapPin size={12} />
                      {project.city}{project.state ? `, ${project.state}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center divide-x divide-gray-100 dark:divide-gray-700/50 mb-4 border border-gray-100 dark:border-gray-700/50 rounded-xl overflow-hidden border-t-2 border-t-rf-green-800/10 dark:border-t-rf-green-400/10">
                  <div className="flex-1 text-center py-2.5 px-2">
                    <p className="text-sm font-bold text-rf-dark dark:text-gray-100">{project.total_lots || 0}</p>
                    <p className="text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider">Lotes</p>
                  </div>
                  <div className="flex-1 text-center py-2.5 px-2">
                    <p className="text-sm font-bold text-emerald-600">{project.available_lots || 0}</p>
                    <p className="text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider">Disponibles</p>
                  </div>
                  <div className="flex-1 text-center py-2.5 px-2">
                    <p className="text-sm font-bold text-rf-green-800 dark:text-rf-green-300">{project.sold_lots || 0}</p>
                    <p className="text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider">Vendidos</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-sm mb-4">
                  <span className="font-semibold text-rf-dark dark:text-gray-100">${(project.price_per_sqm || 0).toLocaleString('es-MX')}</span>
                  <span className="text-rf-gray-light dark:text-gray-500 text-xs">/ m²</span>
                </div>

                <Link
                  to={`/lots?project_id=${project.id}`}
                  className="btn-secondary w-full flex items-center justify-center gap-2 text-center"
                >
                  Ver lotes
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-rf-green-800/20 to-transparent dark:via-rf-green-400/20" />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="card bg-white p-6 w-full max-w-lg shadow-premium-xl animate-scale-in relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rf-green-800 via-rf-green-600 to-rf-green-400" />
            <h2 className="text-lg font-bold text-rf-dark dark:text-gray-100 mb-1 mt-2">Nuevo Proyecto</h2>
            <p className="text-sm text-rf-gray-light dark:text-gray-500 mb-6">Completa los detalles del desarrollo</p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')})}
                  className="input"
                  placeholder="Nombre del proyecto"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">Slug (URL)</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({...form, slug: e.target.value})}
                  className="input"
                  placeholder="nombre-del-proyecto"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">Ciudad</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({...form, city: e.target.value})}
                    className="input"
                    placeholder="Ciudad"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">Estado</label>
                  <input
                    value={form.state}
                    onChange={(e) => setForm({...form, state: e.target.value})}
                    className="input"
                    placeholder="Estado"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">$/m²</label>
                  <input
                    type="number"
                    value={form.price_per_sqm}
                    onChange={(e) => setForm({...form, price_per_sqm: e.target.value})}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rf-gray dark:text-gray-400 mb-1.5 uppercase tracking-wider">Total de lotes</label>
                  <input
                    type="number"
                    value={form.total_lots}
                    onChange={(e) => setForm({...form, total_lots: e.target.value})}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Crear Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { projectsApi } from '../lib/api';
import { Plus, ExternalLink, Map } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-rf-green-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Proyectos</h1>
          <p className="text-sm text-rf-gray-light mt-1">Gestiona tus desarrollos campestres</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-rf-green-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-rf-green-700 transition text-sm font-medium"
        >
          <Plus size={18} />
          Nuevo Proyecto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-rf-cream-dark text-center">
          <Map size={48} className="mx-auto text-rf-green-300 mb-4" />
          <h3 className="text-lg font-medium text-rf-dark mb-2">No hay proyectos aún</h3>
          <p className="text-sm text-rf-gray-light">Crea tu primer proyecto para empezar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl border border-rf-cream-dark shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              {project.cover_image_url && (
                <img src={project.cover_image_url} alt={project.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-rf-dark">{project.name}</h3>
                    <p className="text-xs text-rf-gray-light">{project.city}, {project.state}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    project.status === 'active' ? 'bg-green-100 text-green-700' :
                    project.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {project.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-rf-dark">{project.total_lots}</p>
                    <p className="text-xs text-rf-gray-light">Lotes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{project.available_lots}</p>
                    <p className="text-xs text-rf-gray-light">Disp.</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-rf-green-800">{project.sold_lots}</p>
                    <p className="text-xs text-rf-gray-light">Vend.</p>
                  </div>
                </div>

                <div className="text-sm text-rf-gray mb-3">
                  $ {project.price_per_sqm.toLocaleString('es-MX')} / m²
                </div>

                <Link
                  to={`/lots?project_id=${project.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-rf-green-600 text-rf-green-600 text-sm font-medium hover:bg-rf-green-50 transition"
                >
                  <ExternalLink size={16} />
                  Ver lotes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-rf-dark mb-4">Nuevo Proyecto</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Nombre</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Slug (URL)</label>
                <input value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Ciudad</label>
                  <input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Estado</label>
                  <input value={form.state} onChange={(e) => setForm({...form, state: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">$/m²</label>
                  <input type="number" value={form.price_per_sqm} onChange={(e) => setForm({...form, price_per_sqm: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Total de lotes</label>
                  <input type="number" value={form.total_lots} onChange={(e) => setForm({...form, total_lots: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 border border-rf-cream-dark rounded-lg text-rf-gray hover:bg-rf-cream transition text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-rf-green-800 text-white rounded-lg hover:bg-rf-green-700 transition text-sm font-medium">Crear Proyecto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

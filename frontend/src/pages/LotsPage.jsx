import { useState, useEffect } from 'react';
import { lotsApi, projectsApi } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { Map, Filter, Download, Grid3X3, Layers, Sparkles } from 'lucide-react';

const statusConfig = {
  available: { label: 'Disponible', color: 'bg-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', hover: 'hover:border-emerald-400 hover:shadow-emerald-200/50' },
  reserved: { label: 'Apartado', color: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', hover: 'hover:border-amber-400 hover:shadow-amber-200/50' },
  sold: { label: 'Vendido', color: 'bg-rf-green-800', light: 'bg-rf-green-100', border: 'border-rf-green-800', text: 'text-rf-green-800', hover: 'hover:border-rf-green-900 hover:shadow-rf-green-200/50' },
  blocked: { label: 'Bloqueado', color: 'bg-red-500', light: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', hover: 'hover:border-red-400 hover:shadow-red-200/50' },
};

export default function LotsPage() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');

  useEffect(() => {
    projectsApi.list().then((res) => setProjects(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) { setLots([]); setLoading(false); return; }
    setLoading(true);
    const params = filter !== 'all' ? { status: filter } : {};
    lotsApi.list(selectedProject, params)
      .then((res) => setLots(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedProject, filter]);

  const handleBulkImport = async () => {
    try {
      const rows = importData.trim().split('\n').filter(Boolean);
      const lots = rows.map((row) => {
        const [lot_number, area_sqm, price_per_sqm, block] = row.split(',').map(s => s.trim());
        return { lot_number: parseInt(lot_number), area_sqm: parseFloat(area_sqm), price_per_sqm: parseFloat(price_per_sqm || selectedProjectData?.price_per_sqm || 1000), block: block || null };
      });
      await lotsApi.bulkCreate(selectedProject, { lots });
      setShowImport(false);
      setImportData('');
      const res = await lotsApi.list(selectedProject);
      setLots(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error importing');
    }
  };

  const handleStatusChange = async (lotId, newStatus) => {
    try {
      await lotsApi.update(selectedProject, lotId, { status: newStatus });
      setLots(lots.map(l => l.id === lotId ? { ...l, status: newStatus } : l));
    } catch (err) {
      alert(err.response?.data?.detail || 'Error');
    }
  };

  const selectedProjectData = projects.find((p) => p.id === parseInt(selectedProject));
  const filteredLots = filter === 'all' ? lots : lots.filter((l) => l.status === filter);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Inventario de Lotes</h1>
            {selectedProject && <span className="px-2.5 py-0.5 bg-rf-green-100/80 backdrop-blur-sm text-rf-green-800 rounded-full text-xs font-medium border border-rf-green-200/50 shadow-sm">{filteredLots.length} lotes</span>}
          </div>
          <p className="text-base text-rf-gray-light mt-1">Visualiza y gestiona el inventario de lotes</p>
        </div>
        <div className="flex gap-2">
          {selectedProject && (
            <button onClick={() => setShowImport(true)} className="relative overflow-hidden group bg-white border border-gray-200/80 text-gray-500 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 hover:shadow-md transition-all duration-300 text-sm font-medium shadow-sm">
              <Download size={16} />
              Importar
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-white/30 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-300" />
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border border-gray-200/80 rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm"
          >
            <option value="">Seleccionar proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {['all', 'available', 'reserved', 'sold', 'blocked'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                filter === f
                  ? 'bg-rf-green-800 text-white shadow-md'
                  : 'bg-gray-100/80 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'available' ? 'Disponibles' : f === 'reserved' ? 'Apartados' : f === 'sold' ? 'Vendidos' : 'Bloqueados'}
            </button>
          ))}
        </div>

        {selectedProject && selectedProjectData && (
          <div className="ml-auto text-sm text-gray-400 bg-gray-50/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-gray-100/50">
            <span className="font-semibold text-rf-dark">{filteredLots.length}</span> lotes · $ {(selectedProjectData.price_per_sqm || 0).toLocaleString('es-MX')}/m²
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-14 h-14 border-[3px] border-rf-green-100/50 border-t-rf-green-800 rounded-full animate-spin" />
            <div className="w-14 h-14 border-[3px] border-rf-green-200/30 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
        </div>
      ) : !selectedProject ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-16 border border-dashed border-white/50 text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center shadow-lg">
            <Grid3X3 size={40} className="text-rf-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">Selecciona un proyecto</h3>
          <p className="text-gray-400">Elige un proyecto para ver su inventario de lotes</p>
        </div>
      ) : lots.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-16 border border-dashed border-white/50 text-center animate-scale-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center shadow-lg">
            <Layers size={40} className="text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-rf-dark mb-2">No hay lotes en este proyecto</h3>
          <p className="text-gray-400 mb-6">Importa desde CSV o crea lotes manualmente</p>
          <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white px-5 py-2.5 rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all text-sm font-medium shadow-md">
            <Download size={16} /> Importar Lotes
          </button>
        </div>
      ) : (
        <>
          {/* Leyenda */}
          <div className="flex gap-4 mb-4 text-xs text-gray-400 flex-wrap">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.color}`} />
                {cfg.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {lots.map((lot, i) => {
              const cfg = statusConfig[lot.status] || statusConfig.available;
              return (
                <div
                  key={lot.id}
                  className={`group bg-white rounded-xl border-2 p-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${cfg.border} ${cfg.hover} ${cfg.light}`}
                  style={{ animation: `scale-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${i * 30}ms both` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-rf-dark">#{lot.lot_number}</span>
                    {lot.block && <span className="text-[10px] text-gray-400 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-gray-200">MZ {lot.block}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{lot.area_sqm} m²</p>
                  <p className="text-sm font-bold text-rf-dark mb-2.5">${(lot.total_price || lot.area_sqm * (lot.price_per_sqm || 0)).toLocaleString('es-MX')}</p>
                  <select
                    value={lot.status}
                    onChange={(e) => handleStatusChange(lot.id, e.target.value)}
                    className={`w-full text-xs rounded-lg px-2 py-1.5 border font-medium transition-all ${lot.status === 'available' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : lot.status === 'reserved' ? 'bg-amber-50 border-amber-200 text-amber-700' : lot.status === 'sold' ? 'bg-rf-green-100 border-rf-green-600 text-rf-green-800' : 'bg-red-50 border-red-200 text-red-700'} focus:outline-none focus:ring-2 focus:ring-rf-green-500/30`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="available">Disponible</option>
                    <option value="reserved">Apartado</option>
                    <option value="sold">Vendido</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-800 to-rf-green-700 flex items-center justify-center shadow-lg">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rf-dark">Importar Lotes</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">Pega los datos en formato CSV</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">Formato: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">número, área_m², precio_m², manzana</code></p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-40 bg-white border border-gray-200 rounded-xl p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all resize-none shadow-sm"
              placeholder={`1,200,1000,A\n2,200,1000,A\n3,200,1000,B\n...`}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowImport(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium">Cancelar</button>
              <button onClick={handleBulkImport} className="flex-1 py-2.5 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white rounded-xl hover:from-rf-green-700 hover:to-rf-green-600 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

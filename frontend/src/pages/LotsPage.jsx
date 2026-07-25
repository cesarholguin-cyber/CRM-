import { useState, useEffect } from 'react';
import { lotsApi, projectsApi } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { Download, Grid3X3, Upload, Layers } from 'lucide-react';

const statusConfig = {
  available: { label: 'Disponible', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reserved: { label: 'Apartado', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  sold: { label: 'Vendido', dot: 'bg-rf-green-800', chip: 'bg-rf-green-50 text-rf-green-800 border-rf-green-200' },
  blocked: { label: 'Bloqueado', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200' },
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
      const parsedLots = rows.map((row) => {
        const [lot_number, area_sqm, price_per_sqm, block] = row.split(',').map(s => s.trim());
        return { lot_number: parseInt(lot_number), area_sqm: parseFloat(area_sqm), price_per_sqm: parseFloat(price_per_sqm || selectedProjectData?.price_per_sqm || 1000), block: block || null };
      });
      await lotsApi.bulkCreate(selectedProject, { lots: parsedLots });
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

  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'available', label: 'Disponibles' },
    { key: 'reserved', label: 'Apartados' },
    { key: 'sold', label: 'Vendidos' },
    { key: 'blocked', label: 'Bloqueados' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-rf-dark tracking-tight">Inventario de Lotes</h1>
          {selectedProject && (
            <span className="px-2.5 py-0.5 bg-rf-green-50 text-rf-green-800 rounded-full text-xs font-medium border border-rf-green-200">
              {filteredLots.length} lotes
            </span>
          )}
        </div>
        {selectedProject && (
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
            <Download size={15} />
            Importar
          </button>
        )}
      </div>

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="input w-auto min-w-[200px]"
          >
            <option value="">Seleccionar proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex gap-1.5 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 ${
                  filter === f.key
                    ? 'bg-rf-green-800 text-white border-rf-green-800'
                    : 'bg-white text-rf-gray border-gray-200 hover:border-gray-300 hover:text-rf-dark'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {selectedProject && selectedProjectData && (
            <div className="ml-auto text-xs text-rf-gray-light">
              <span className="font-semibold text-rf-dark">{filteredLots.length}</span> lotes &middot; ${' '}
              {(selectedProjectData.price_per_sqm || 0).toLocaleString('es-MX')}/m²
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-rf-green-800 rounded-full animate-spin" />
        </div>
      ) : !selectedProject ? (
        <div className="card p-16 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gray-50 flex items-center justify-center">
            <Grid3X3 size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-semibold text-rf-dark mb-1.5">Selecciona un proyecto</h3>
          <p className="text-sm text-rf-gray-light">Elige un proyecto para ver su inventario de lotes</p>
        </div>
      ) : lots.length === 0 ? (
        <div className="card p-16 text-center animate-scale-in">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Layers size={32} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-rf-dark mb-1.5">No hay lotes en este proyecto</h3>
          <p className="text-sm text-rf-gray-light mb-6">Importa desde CSV o crea lotes manualmente</p>
          <button onClick={() => setShowImport(true)} className="btn-primary inline-flex items-center gap-2">
            <Download size={15} />
            Importar Lotes
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-4 text-xs text-rf-gray-light flex-wrap">
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
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
                  className={`card p-3.5 animate-slide-up stagger-${Math.min(Math.floor(i / 6) + 1, 9)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-rf-dark">#{lot.lot_number}</span>
                    {lot.block && (
                      <span className="text-[10px] text-rf-gray-light bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                        MZ {lot.block}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-rf-gray-light mb-1">{lot.area_sqm} m²</p>
                  <p className="text-sm font-bold text-rf-dark mb-3">
                    ${(lot.total_price || lot.area_sqm * (lot.price_per_sqm || 0)).toLocaleString('es-MX')}
                  </p>
                  <select
                    value={lot.status}
                    onChange={(e) => handleStatusChange(lot.id, e.target.value)}
                    className={`w-full text-xs rounded-lg px-2.5 py-1.5 border font-medium transition-all focus:outline-none focus:ring-2 focus:ring-rf-green-500/20 ${cfg.chip}`}
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

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowImport(false)}>
          <div className="card bg-white p-6 w-full max-w-lg shadow-premium-xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-rf-dark mb-1">Importar Lotes</h2>
            <p className="text-sm text-rf-gray-light mb-5">Pega los datos en formato CSV</p>
            <p className="text-xs text-rf-gray mb-3">
              Formato: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[11px]">número, área_m², precio_m², manzana</code>
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="input h-40 font-mono text-xs resize-none"
              placeholder={"1,200,1000,A\n2,200,1000,A\n3,200,1000,B\n..."}
            />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleBulkImport} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <Upload size={15} />
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

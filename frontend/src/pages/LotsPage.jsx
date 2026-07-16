import { useState, useEffect } from 'react';
import { lotsApi, projectsApi } from '../lib/api';
import { useSearchParams } from 'react-router-dom';
import { Map, Filter, Download, RotateCcw } from 'lucide-react';

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

  const getStatusColor = (status) => {
    const colors = {
      available: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      reserved: 'bg-amber-100 text-amber-700 border-amber-300',
      sold: 'bg-rf-green-800 text-white border-rf-green-800',
      blocked: 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

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
      // Refresh
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Inventario de Lotes</h1>
          <p className="text-sm text-rf-gray-light mt-1">Visualiza y gestiona el inventario de lotes</p>
        </div>
        <div className="flex gap-2">
          {selectedProject && (
            <button onClick={() => setShowImport(true)} className="bg-white border border-rf-cream-dark text-rf-gray px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-rf-cream transition text-sm">
              <Download size={16} />
              Importar
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 border border-rf-cream-dark mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-rf-gray-light" />
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border border-rf-cream-dark rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rf-green-500"
          >
            <option value="">Seleccionar proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {['all', 'available', 'reserved', 'sold', 'blocked'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f ? 'bg-rf-green-800 text-white' : 'bg-rf-cream text-rf-gray hover:bg-rf-cream-dark'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'available' ? 'Disponibles' : f === 'reserved' ? 'Apartados' : f === 'sold' ? 'Vendidos' : 'Bloqueados'}
            </button>
          ))}
        </div>

        {selectedProject && selectedProjectData && (
          <div className="ml-auto text-sm text-rf-gray-light">
            <span className="font-medium text-rf-dark">{lots.length}</span> lotes · $ {selectedProjectData.price_per_sqm.toLocaleString('es-MX')}/m²
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 mb-4 text-xs text-rf-gray">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Disponible</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Apartado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rf-green-800 inline-block"></span> Vendido</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> Bloqueado</span>
      </div>

      {/* Grid de lotes */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-rf-green-600 border-t-transparent rounded-full" /></div>
      ) : !selectedProject ? (
        <div className="bg-white rounded-xl p-12 border border-rf-cream-dark text-center">
          <Map size={48} className="mx-auto text-rf-green-300 mb-4" />
          <h3 className="text-lg font-medium text-rf-dark mb-2">Selecciona un proyecto</h3>
          <p className="text-sm text-rf-gray-light">Elige un proyecto para ver su inventario de lotes</p>
        </div>
      ) : lots.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-rf-cream-dark text-center">
          <p className="text-rf-gray-light">No hay lotes en este proyecto. Importa desde Excel o crea lotes manualmente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {lots.map((lot) => (
            <div key={lot.id} className={`bg-white rounded-lg border-2 p-3 transition-all hover:shadow-md ${getStatusColor(lot.status).includes('sold') ? 'border-rf-green-800' : lot.status === 'available' ? 'border-emerald-300' : lot.status === 'reserved' ? 'border-amber-300' : 'border-red-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rf-dark">{lot.lot_number}</span>
                {lot.block && <span className="text-xs text-rf-gray-light">Mz {lot.block}</span>}
              </div>
              <p className="text-xs text-rf-gray mb-1">{lot.area_sqm} m²</p>
              <p className="text-xs font-medium text-rf-dark">${(lot.total_price || lot.area_sqm * lot.price_per_sqm).toLocaleString('es-MX')}</p>
              <select
                value={lot.status}
                onChange={(e) => handleStatusChange(lot.id, e.target.value)}
                className={`mt-2 text-xs w-full rounded px-1 py-0.5 border ${getStatusColor(lot.status)}`}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="available">Disponible</option>
                <option value="reserved">Apartado</option>
                <option value="sold">Vendido</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-rf-dark mb-2">Importar Lotes</h2>
            <p className="text-sm text-rf-gray-light mb-4">Pega los datos en formato CSV: <code>número, área_m², precio_m², manzana</code></p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              className="w-full h-40 border border-rf-cream-dark rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rf-green-500"
              placeholder={`1,200,1000,A\n2,200,1000,A\n3,200,1000,B\n...`}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowImport(false)} className="flex-1 py-2 border border-rf-cream-dark rounded-lg text-rf-gray hover:bg-rf-cream transition text-sm">Cancelar</button>
              <button onClick={handleBulkImport} className="flex-1 py-2 bg-rf-green-800 text-white rounded-lg hover:bg-rf-green-700 transition text-sm font-medium">Importar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

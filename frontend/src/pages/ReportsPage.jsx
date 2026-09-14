import { useState, useEffect } from 'react';
import { dashboardApi, salesApi } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, PieChartIcon, LayoutGrid } from 'lucide-react';

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const total = payload.reduce((sum, p) => sum + (p.payload?.value || 0), 0);
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
  return (
    <div className="bg-white/95 dark:bg-[#161824]/95 backdrop-blur-xl border border-gray-200/60 dark:border-gray-700/40 rounded-xl px-4 py-3 shadow-premium-lg">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.payload.fill }} />
        <span className="text-sm font-semibold text-rf-dark dark:text-gray-100">{d.name}</span>
      </div>
      <div className="flex items-baseline gap-3 text-xs">
        <span className="text-rf-gray dark:text-gray-400">Cantidad: <strong className="text-rf-dark dark:text-gray-100">{d.value}</strong></span>
        <span className="text-rf-gray dark:text-gray-400">Porcentaje: <strong className="text-rf-dark dark:text-gray-100">{pct}%</strong></span>
      </div>
    </div>
  );
}

function DonutLegend({ data, total }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
      {data.map((entry) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
        return (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
            <span className="text-rf-gray dark:text-gray-400">{entry.name}</span>
            <span className="font-semibold text-rf-dark dark:text-gray-200">{pct}%</span>
            <span className="text-rf-gray-light dark:text-gray-500">({entry.value})</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutCenterLabel({ total }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ paddingBottom: 24 }}>
      <div className="text-center">
        <p className="text-2xl font-bold text-rf-dark dark:text-gray-100 leading-none">{total}</p>
        <p className="text-[10px] text-rf-gray-light dark:text-gray-500 font-medium mt-1">registros</p>
      </div>
    </div>
  );
}

const PIPELINE_LABELS = {
  reserved: 'Apartado',
  option_signed: 'Opción Firmada',
  contract_signed: 'Contrato Firmado',
  financing: 'Financiamiento',
  paid: 'Pagado',
  cancelled: 'Cancelado',
  reversed: 'Reversado',
};

const PIPELINE_COLORS = {
  reserved: '#f59e0b',
  option_signed: '#3b82f6',
  contract_signed: '#6366f1',
  financing: '#8b5cf6',
  paid: '#10b981',
  cancelled: '#ef4444',
  reversed: '#6b7280',
};

const GRADIENT_BAR_COLORS = {
  'bg-emerald-500': 'from-emerald-400 to-emerald-600',
  'bg-amber-500': 'from-amber-400 to-amber-600',
  'bg-rf-green-800': 'from-rf-green-600 to-rf-green-900',
};

export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [pipeline, setPipeline] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.stats(),
      dashboardApi.pipeline(),
      salesApi.list(),
    ])
      .then(([statsRes, pipelineRes, salesRes]) => {
        setStats(statsRes.data);
        setPipeline(pipelineRes.data);
        setSales(salesRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-rf-green-100 dark:border-rf-green-900/40" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-rf-green-700 border-r-rf-green-500 animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-[2px] border-transparent border-b-rf-green-400 border-l-rf-green-300 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
      </div>
    );
  }

  const pipelineData = pipeline
    .filter((s) => s.stage !== 'cancelled' && s.stage !== 'reversed')
    .map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const pipelineAll = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const statusCounts = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, value: s.count, fill: PIPELINE_COLORS[s.stage] }));

  const summaryCards = [
    { label: 'Ingresos Totales', value: `$${(stats?.total_revenue || 0).toLocaleString('es-MX')}`, badge: 'Facturado' },
    { label: 'Ventas Totales', value: stats?.total_sales || 0, badge: 'Completadas' },
    { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, badge: 'Este mes' },
    { label: 'Ingresos del Mes', value: `$${(stats?.revenue_this_month || 0).toLocaleString('es-MX')}`, badge: 'Este mes' },
  ];

  const lotStatuses = [
    { label: 'Disponibles', value: stats?.available_lots || 0, color: 'from-emerald-400 to-emerald-600', trackColor: 'from-emerald-200 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/10', pct: Math.round(((stats?.available_lots || 0) / (stats?.total_lots || 1)) * 100) },
    { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'from-amber-400 to-amber-600', trackColor: 'from-amber-200 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/10', pct: Math.round(((stats?.reserved_lots || 0) / (stats?.total_lots || 1)) * 100) },
    { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'from-rf-green-600 to-rf-green-900', trackColor: 'from-rf-green-200 to-rf-green-100 dark:from-rf-green-900/20 dark:to-rf-green-800/10', pct: Math.round(((stats?.sold_lots || 0) / (stats?.total_lots || 1)) * 100) },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 stagger-1 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-700 to-rf-green-900 flex items-center justify-center shadow-premium-sm">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-rf-green-800 to-rf-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark dark:text-gray-100">Reportes</h1>
          <p className="text-sm text-rf-gray-light dark:text-gray-500 mt-1">Análisis detallado de ventas y rendimiento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {summaryCards.map((item, i) => (
          <div key={item.label} className="card p-6 animate-slide-up hover:shadow-premium-md transition-shadow duration-300" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-rf-gray-light dark:text-gray-500">{item.label}</p>
              <span className="text-[10px] text-rf-green-700 dark:text-rf-green-400 font-semibold uppercase tracking-wider bg-gradient-to-r from-rf-green-50 to-emerald-50 dark:from-rf-green-900/20 dark:to-emerald-900/20 px-2.5 py-1 rounded-lg border border-rf-green-100 dark:border-rf-green-800/30">{item.badge}</span>
            </div>
            <p className="text-3xl font-bold text-rf-dark dark:text-gray-100 mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6 stagger-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100 to-emerald-50 dark:from-rf-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Pipeline de Ventas</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(229, 221, 211, 0.5)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }} />
              <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="#1a3c2a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6 stagger-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100 to-emerald-50 dark:from-rf-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
              <PieChartIcon size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Distribución por Estatus</h2>
          </div>
          <div className="relative">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {statusCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <DonutCenterLabel total={statusCounts.reduce((s, e) => s + e.value, 0)} />
          </div>
          <DonutLegend data={statusCounts} total={statusCounts.reduce((s, e) => s + e.value, 0)} />
        </div>

        <div className="card p-6 stagger-7 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100 to-emerald-50 dark:from-rf-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
              <DollarSign size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Valor por Etapa</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineAll}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString('es-MX')}`} contentStyle={{ borderRadius: 12, border: '1px solid rgba(229, 221, 211, 0.5)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }} />
              <Bar dataKey="value" name="Valor" radius={[6, 6, 0, 0]}>
                {pipelineAll.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6 stagger-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100 to-emerald-50 dark:from-rf-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
              <LayoutGrid size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Estado de Lotes</h2>
          </div>
          <div className="space-y-5">
            {lotStatuses.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-rf-gray dark:text-gray-400">{item.label}</span>
                  <span className="font-medium text-rf-dark dark:text-gray-100">{item.value} — {item.pct}%</span>
                </div>
                <div className={`w-full bg-gradient-to-r ${item.trackColor} rounded-full h-3 overflow-hidden shadow-inner`}>
                  <div
                    className={`bg-gradient-to-r ${item.color} h-3 rounded-full transition-all duration-700 shadow-sm`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-0 stagger-9 animate-fade-in overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-rf-green-600 via-emerald-400 to-rf-green-600" />
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100 to-emerald-50 dark:from-rf-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Ventas Recientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-rf-green-100 dark:border-rf-green-800/30">
                  <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">#</th>
                  <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Cliente ID</th>
                  <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Lote ID</th>
                  <th className="text-right py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Precio</th>
                  <th className="text-center py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Estatus</th>
                  <th className="text-right py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 10).map((sale, i) => (
                  <tr key={sale.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gradient-to-r hover:from-rf-green-50/40 hover:to-transparent dark:hover:from-rf-green-900/10 transition-all duration-200" style={{ animationDelay: `${i * 40}ms` }}>
                    <td className="py-3 px-3 font-medium text-rf-dark dark:text-gray-100">{sale.id}</td>
                    <td className="py-3 px-3 text-rf-gray dark:text-gray-400">{sale.client_id}</td>
                    <td className="py-3 px-3 text-rf-gray dark:text-gray-400">{sale.lot_id}</td>
                    <td className="py-3 px-3 text-right font-medium text-rf-dark dark:text-gray-100">${(sale.sale_price || 0).toLocaleString('es-MX')}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${sale.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : sale.status === 'cancelled' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                        {(PIPELINE_LABELS[sale.status] || sale.status)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-rf-gray-light dark:text-gray-500 text-xs">
                      {new Date(sale.created_at).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-rf-gray-light dark:text-gray-500">No hay ventas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

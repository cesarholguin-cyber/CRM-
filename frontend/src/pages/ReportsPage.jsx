import { useState, useEffect } from 'react';
import { dashboardApi, salesApi } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, PieChartIcon, LayoutGrid } from 'lucide-react';

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
        <div className="w-12 h-12 border-3 border-rf-green-200 border-t-rf-green-800 rounded-full animate-spin" />
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

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 stagger-1 animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-rf-green-800 flex items-center justify-center shadow-premium-sm">
          <TrendingUp size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark dark:text-gray-100">Reportes</h1>
          <p className="text-sm text-rf-gray-light dark:text-gray-500 mt-1">Análisis detallado de ventas y rendimiento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {summaryCards.map((item, i) => (
          <div key={item.label} className={`card p-6 stagger-${i + 1} animate-slide-up`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-rf-gray-light dark:text-gray-500">{item.label}</p>
              <span className="text-[10px] text-rf-gray-light dark:text-gray-500 font-medium uppercase tracking-wider bg-rf-cream dark:bg-gray-800 px-2 py-1 rounded-lg">{item.badge}</span>
            </div>
            <p className="text-3xl font-bold text-rf-dark dark:text-gray-100 mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6 stagger-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-rf-cream dark:bg-gray-800 flex items-center justify-center">
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
            <div className="w-8 h-8 rounded-lg bg-rf-cream dark:bg-gray-800 flex items-center justify-center">
              <PieChartIcon size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Distribución por Estatus</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusCounts.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(229, 221, 211, 0.5)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6 stagger-7 animate-fade-in">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-rf-cream dark:bg-gray-800 flex items-center justify-center">
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
            <div className="w-8 h-8 rounded-lg bg-rf-cream dark:bg-gray-800 flex items-center justify-center">
              <LayoutGrid size={16} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Estado de Lotes</h2>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500', pct: Math.round(((stats?.available_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500', pct: Math.round(((stats?.reserved_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800', pct: Math.round(((stats?.sold_lots || 0) / (stats?.total_lots || 1)) * 100) },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-rf-gray dark:text-gray-400">{item.label}</span>
                  <span className="font-medium text-rf-dark dark:text-gray-100">{item.value} — {item.pct}%</span>
                </div>
                <div className="w-full bg-rf-cream dark:bg-gray-700/50 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${item.color} h-3 rounded-full transition-all duration-700`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6 stagger-9 animate-fade-in">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-rf-cream dark:bg-gray-800 flex items-center justify-center">
            <TrendingUp size={16} className="text-rf-green-700 dark:text-rf-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Ventas Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600/50">
                <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">#</th>
                <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Cliente ID</th>
                <th className="text-left py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Lote ID</th>
                <th className="text-right py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Precio</th>
                <th className="text-center py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Estatus</th>
                <th className="text-right py-3 px-3 text-rf-gray-light dark:text-gray-500 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
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
  );
}

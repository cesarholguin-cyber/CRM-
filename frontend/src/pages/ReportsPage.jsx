import { useState, useEffect } from 'react';
import { dashboardApi, salesApi } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, PieChartIcon, Sparkles } from 'lucide-react';

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
        <div className="relative">
          <div className="w-14 h-14 border-[3px] border-rf-green-100/50 border-t-rf-green-800 rounded-full animate-spin" />
          <div className="w-14 h-14 border-[3px] border-rf-green-200/30 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
      </div>
    );
  }

  const pipelineData = pipeline
    .filter((s) => s.stage !== 'cancelled' && s.stage !== 'reversed')
    .map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const pipelineAll = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const statusCounts = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, value: s.count, fill: PIPELINE_COLORS[s.stage] }));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-700 to-rf-green-900 flex items-center justify-center shadow-lg">
          <TrendingUp size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Reportes</h1>
          <p className="text-sm text-rf-gray-light mt-1">Análisis detallado de ventas y rendimiento</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Ingresos Totales', value: (stats?.total_revenue || 0).toLocaleString('es-MX'), gradient: 'from-rf-green-800 to-rf-green-700', badge: 'Facturado' },
          { label: 'Ventas Totales', value: stats?.total_sales || 0, gradient: 'from-blue-600 to-blue-500', badge: 'Completadas' },
          { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, gradient: 'from-indigo-600 to-indigo-500', badge: 'Este mes' },
          { label: 'Ingresos del Mes', value: (stats?.revenue_this_month || 0).toLocaleString('es-MX'), gradient: 'from-rf-gold to-rf-gold-dark', badge: 'Este mes' },
        ].map((item, i) => (
          <div key={item.label} className="group bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-gray-400 group-hover:text-gray-500 transition-colors">{item.label}</p>
              <span className="text-[10px] text-gray-400/60 font-medium uppercase tracking-wider bg-gray-50/50 px-2 py-1 rounded-lg">{item.badge}</span>
            </div>
            <p className={`text-3xl font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent mt-1.5`}>${item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pipeline bar chart */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-green-100/80 to-rf-green-50/80 flex items-center justify-center">
              <TrendingUp size={16} className="text-rf-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark">Pipeline de Ventas</h2>
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

        {/* Pipeline pie chart */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100/80 to-purple-50/80 flex items-center justify-center">
              <PieChartIcon size={16} className="text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark">Distribución por Estatus</h2>
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

        {/* Pipeline by value */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100/80 to-amber-50/80 flex items-center justify-center">
              <DollarSign size={16} className="text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark">Valor por Etapa</h2>
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

        {/* Lot status */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100/80 to-emerald-50/80 flex items-center justify-center">
              <Sparkles size={16} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-rf-dark">Estado de Lotes</h2>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500', pct: Math.round(((stats?.available_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500', pct: Math.round(((stats?.reserved_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800', pct: Math.round(((stats?.sold_lots || 0) / (stats?.total_lots || 1)) * 100) },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-rf-gray">{item.label}</span>
                  <span className="font-medium text-rf-dark">{item.value} — {item.pct}%</span>
                </div>
                <div className="w-full bg-rf-cream/80 rounded-full h-3 overflow-hidden shadow-inner">
                  <div className={`${item.color} h-3 rounded-full transition-all duration-700 relative`}
                    style={{ width: `${item.pct}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sales table */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100/80 to-blue-50/80 flex items-center justify-center">
            <TrendingUp size={16} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-rf-dark">Ventas Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200/50">
                <th className="text-left py-3 px-2 text-rf-gray-light font-medium">#</th>
                <th className="text-left py-3 px-2 text-rf-gray-light font-medium">Cliente ID</th>
                <th className="text-left py-3 px-2 text-rf-gray-light font-medium">Lote ID</th>
                <th className="text-right py-3 px-2 text-rf-gray-light font-medium">Precio</th>
                <th className="text-center py-3 px-2 text-rf-gray-light font-medium">Estatus</th>
                <th className="text-right py-3 px-2 text-rf-gray-light font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 10).map((sale) => (
                <tr key={sale.id} className="border-b border-rf-cream/30 hover:bg-rf-cream/20 transition">
                  <td className="py-3 px-2 font-medium text-rf-dark">{sale.id}</td>
                  <td className="py-3 px-2 text-rf-gray">{sale.client_id}</td>
                  <td className="py-3 px-2 text-rf-gray">{sale.lot_id}</td>
                  <td className="py-3 px-2 text-right font-medium text-rf-dark">${(sale.sale_price || 0).toLocaleString('es-MX')}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${sale.status === 'paid' ? 'bg-emerald-100/80 text-emerald-700' : sale.status === 'cancelled' ? 'bg-red-100/80 text-red-700' : 'bg-blue-100/80 text-blue-700'}`}>
                      {(PIPELINE_LABELS[sale.status] || sale.status)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right text-rf-gray-light text-xs">
                    {new Date(sale.created_at).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-rf-gray-light">No hay ventas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { dashboardApi, salesApi } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';
import { TrendingUp, DollarSign, PieChartIcon } from 'lucide-react';

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
        <div className="animate-spin w-8 h-8 border-4 border-rf-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const pipelineData = pipeline
    .filter((s) => s.stage !== 'cancelled' && s.stage !== 'reversed')
    .map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const pipelineAll = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, count: s.count, value: s.value, fill: PIPELINE_COLORS[s.stage] }));

  const statusCounts = pipeline.map((s) => ({ name: PIPELINE_LABELS[s.stage] || s.stage, value: s.count, fill: PIPELINE_COLORS[s.stage] }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp size={24} className="text-rf-green-600" />
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Reportes</h1>
          <p className="text-sm text-rf-gray-light mt-1">Análisis detallado de ventas y rendimiento</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-rf-cream-dark shadow-sm">
          <p className="text-sm text-rf-gray-light">Ingresos Totales</p>
          <p className="text-2xl font-bold text-rf-green-800 mt-1">${(stats?.total_revenue || 0).toLocaleString('es-MX')}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-rf-cream-dark shadow-sm">
          <p className="text-sm text-rf-gray-light">Ventas Totales</p>
          <p className="text-2xl font-bold text-rf-dark mt-1">{stats?.total_sales || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-rf-cream-dark shadow-sm">
          <p className="text-sm text-rf-gray-light">Ventas del Mes</p>
          <p className="text-2xl font-bold text-rf-dark mt-1">{stats?.sales_this_month || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-rf-cream-dark shadow-sm">
          <p className="text-sm text-rf-gray-light">Ingresos del Mes</p>
          <p className="text-2xl font-bold text-rf-gold mt-1">${(stats?.revenue_this_month || 0).toLocaleString('es-MX')}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pipeline bar chart */}
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4 flex items-center gap-2">
            <TrendingUp size={18} /> Pipeline de Ventas
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5ddd3' }} />
              <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="#1a3c2a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline pie chart */}
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4 flex items-center gap-2">
            <PieChartIcon size={18} /> Distribución por Estatus
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {statusCounts.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5ddd3' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline by value */}
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4 flex items-center gap-2">
            <DollarSign size={18} /> Valor por Etapa
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineAll}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString('es-MX')}`} contentStyle={{ borderRadius: 8, border: '1px solid #e5ddd3' }} />
              <Bar dataKey="value" name="Valor" radius={[4, 4, 0, 0]}>
                {pipelineAll.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lot status */}
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4">Estado de Lotes</h2>
          <div className="space-y-4">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500', pct: Math.round(((stats?.available_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500', pct: Math.round(((stats?.reserved_lots || 0) / (stats?.total_lots || 1)) * 100) },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800', pct: Math.round(((stats?.sold_lots || 0) / (stats?.total_lots || 1)) * 100) },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-rf-gray">{item.label}</span>
                  <span className="font-medium text-rf-dark">{item.value} — {item.pct}%</span>
                </div>
                <div className="w-full bg-rf-cream rounded-full h-3">
                  <div className={`${item.color} h-3 rounded-full transition-all duration-700`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent sales table */}
      <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
        <h2 className="text-lg font-semibold text-rf-dark mb-4">Ventas Recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rf-cream-dark">
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
                <tr key={sale.id} className="border-b border-rf-cream/50 hover:bg-rf-cream/30 transition">
                  <td className="py-3 px-2 font-medium text-rf-dark">{sale.id}</td>
                  <td className="py-3 px-2 text-rf-gray">{sale.client_id}</td>
                  <td className="py-3 px-2 text-rf-gray">{sale.lot_id}</td>
                  <td className="py-3 px-2 text-right font-medium text-rf-dark">${(sale.sale_price || 0).toLocaleString('es-MX')}</td>
                  <td className="py-3 px-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${sale.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : sale.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
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

import { useState, useEffect } from 'react';
import { dashboardApi } from '../lib/api';
import { Building2, Map, Users, ShoppingCart, TrendingUp, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.stats()
      .then((res) => setStats(res.data))
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

  const cards = [
    { label: 'Proyectos', value: stats?.total_projects || 0, icon: Building2, color: 'bg-blue-50 text-blue-600' },
    { label: 'Lotes Totales', value: stats?.total_lots || 0, icon: Map, color: 'bg-green-50 text-green-600' },
    { label: 'Lotes Disponibles', value: stats?.available_lots || 0, icon: Map, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Clientes', value: stats?.total_clients || 0, icon: Users, color: 'bg-purple-50 text-purple-600' },
    { label: 'Ventas Totales', value: stats?.total_sales || 0, icon: ShoppingCart, color: 'bg-orange-50 text-orange-600' },
    { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Ingresos Totales', value: `$${(stats?.total_revenue || 0).toLocaleString('es-MX')}`, icon: DollarSign, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Ingresos del Mes', value: `$${(stats?.revenue_this_month || 0).toLocaleString('es-MX')}`, icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { label: 'Agentes', value: stats?.agents_count || 0, icon: Users, color: 'bg-teal-50 text-teal-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Dashboard</h1>
          <p className="text-sm text-rf-gray-light mt-1">Resumen general de tu operación</p>
        </div>
        <div className="hidden sm:block w-12 h-12 rounded-full bg-rf-green-100 flex items-center justify-center">
          <Building2 size={24} className="text-rf-green-600" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border border-rf-cream-dark shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-rf-gray-light">{card.label}</p>
                <p className="text-2xl font-bold text-rf-dark mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lotes status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4">Estado de Lotes</h2>
          <div className="space-y-3">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500' },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500' },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800' },
            ].map((item) => {
              const total = stats?.total_lots || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-rf-gray">{item.label}</span>
                    <span className="font-medium text-rf-dark">{item.value} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-rf-cream rounded-full h-2.5">
                    <div className={`${item.color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark shadow-sm">
          <h2 className="text-lg font-semibold text-rf-dark mb-4">Pipeline de Ventas</h2>
          <div className="space-y-3">
            {[
              { label: 'Leads activos', value: stats?.active_leads || 0, color: 'bg-blue-500' },
              { label: 'Ventas activas', value: stats?.active_sales || 0, color: 'bg-purple-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-rf-cream rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-rf-gray">{item.label}</span>
                </div>
                <span className="font-bold text-rf-dark">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
        <div className="w-10 h-10 border-4 border-rf-green-200 border-t-rf-green-800 rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: 'Proyectos', value: stats?.total_projects || 0, icon: Building2, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Lotes Totales', value: stats?.total_lots || 0, icon: Map, gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Lotes Disponibles', value: stats?.available_lots || 0, icon: Map, gradient: 'from-green-500 to-green-600' },
    { label: 'Clientes', value: stats?.total_clients || 0, icon: Users, gradient: 'from-violet-500 to-violet-600' },
    { label: 'Ventas Totales', value: stats?.total_sales || 0, icon: ShoppingCart, gradient: 'from-orange-500 to-orange-600' },
    { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, icon: TrendingUp, gradient: 'from-indigo-500 to-indigo-600' },
    { label: 'Ingresos Totales', value: `$${(stats?.total_revenue || 0).toLocaleString('es-MX')}`, icon: DollarSign, gradient: 'from-amber-500 to-amber-600' },
    { label: 'Ingresos del Mes', value: `$${(stats?.revenue_this_month || 0).toLocaleString('es-MX')}`, icon: DollarSign, gradient: 'from-yellow-500 to-yellow-600' },
    { label: 'Agentes', value: stats?.agents_count || 0, icon: Users, gradient: 'from-teal-500 to-teal-600' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-rf-dark">Dashboard</h1>
          <p className="text-base text-rf-gray-light mt-1">Resumen general de tu operación</p>
        </div>
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rf-green-100 to-rf-green-50 flex items-center justify-center shadow-md">
          <Building2 size={28} className="text-rf-green-600" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, i) => (
          <div
            key={card.label}
            className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            style={{ animation: `slide-up 0.5s ease-out ${i * 50}ms both` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400 group-hover:text-gray-500 transition-colors">{card.label}</p>
                <p className="text-3xl font-bold text-rf-dark mt-1.5 group-hover:text-rf-green-800 transition-colors">{card.value}</p>
              </div>
              <div className={`p-3.5 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                <card.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <h2 className="text-xl font-semibold text-rf-dark mb-4">Estado de Lotes</h2>
          <div className="space-y-4">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500' },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500' },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800' },
            ].map((item, i) => {
              const total = stats?.total_lots || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label} className="animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-rf-gray font-medium">{item.label}</span>
                    <span className="font-semibold text-rf-dark">{item.value} — {pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <h2 className="text-xl font-semibold text-rf-dark mb-4">Pipeline de Ventas</h2>
          <div className="space-y-4">
            {[
              { label: 'Leads activos', value: stats?.active_leads || 0, color: 'bg-blue-500' },
              { label: 'Ventas activas', value: stats?.active_sales || 0, color: 'bg-purple-500' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${item.color} shadow-sm`} />
                  <span className="text-sm text-rf-gray font-medium">{item.label}</span>
                </div>
                <span className="font-bold text-rf-dark text-lg">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

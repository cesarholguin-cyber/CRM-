import { useState, useEffect } from 'react';
import { dashboardApi } from '../lib/api';
import { Building2, Map, Users, ShoppingCart, TrendingUp, DollarSign, Layers, Target, Bookmark, ArrowUpRight } from 'lucide-react';

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
        <div className="relative">
          <div className="w-14 h-14 border-[3px] border-rf-green-100/50 border-t-rf-green-800 rounded-full animate-spin" />
          <div className="w-14 h-14 border-[3px] border-rf-green-200/30 border-t-rf-green-600 rounded-full animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Proyectos', value: stats?.total_projects || 0, icon: Building2, gradient: 'from-emerald-600 to-teal-600', badge: 'Activos' },
    { label: 'Lotes Totales', value: stats?.total_lots || 0, icon: Layers, gradient: 'from-blue-600 to-indigo-600', badge: 'Inventario' },
    { label: 'Lotes Disponibles', value: stats?.available_lots || 0, icon: Map, gradient: 'from-green-500 to-emerald-600', badge: 'En venta' },
    { label: 'Reservas', value: stats?.reserved_lots || 0, icon: Bookmark, gradient: 'from-amber-500 to-orange-600', badge: 'Apartados' },
    { label: 'Clientes', value: stats?.total_clients || 0, icon: Users, gradient: 'from-violet-600 to-purple-600', badge: 'Registrados' },
    { label: 'Ventas', value: stats?.total_sales || 0, icon: ShoppingCart, gradient: 'from-orange-500 to-red-600', badge: 'Pagadas' },
    { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, icon: TrendingUp, gradient: 'from-indigo-500 to-blue-600', badge: 'Este mes' },
    { label: 'Ingresos Totales', value: `$${(stats?.total_revenue || 0).toLocaleString('es-MX')}`, icon: DollarSign, gradient: 'from-rf-gold to-rf-gold-dark', badge: 'Facturado' },
    { label: 'Agentes', value: stats?.agents_count || 0, icon: Users, gradient: 'from-teal-500 to-cyan-600', badge: 'Team' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-rf-dark">Dashboard</h1>
            <span className="px-2.5 py-0.5 bg-emerald-100/80 backdrop-blur-sm text-emerald-700 rounded-full text-xs font-medium border border-emerald-200/50 shadow-sm">En vivo</span>
          </div>
          <p className="text-base text-rf-gray-light">Resumen general de tu operación</p>
        </div>
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rf-green-700 to-rf-green-900 flex items-center justify-center shadow-xl animate-float">
            <Building2 size={28} className="text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-lg" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, i) => (
          <div
            key={card.label}
            className="group relative bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm hover:shadow-xl hover:border-gray-200/80 transition-all duration-500 hover:-translate-y-1.5 overflow-hidden"
            style={{ animation: `slide-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${i * 60}ms both` }}
          >
            {/* Elegant hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rf-green-50/50 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-500`}>
                  <card.icon size={22} />
                </div>
                <span className="text-[10px] text-rf-gray-light/60 font-medium uppercase tracking-wider bg-gray-50/50 px-2 py-1 rounded-lg">{card.badge}</span>
              </div>
              <p className="text-sm text-gray-400 font-medium group-hover:text-gray-500 transition-colors mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-rf-dark group-hover:text-rf-green-800 transition-colors duration-300 tracking-tight">{card.value}</p>
            </div>
            
            {/* Subtle decorative glow */}
            <div className={`absolute -bottom-2 -right-2 w-24 h-24 bg-gradient-to-br ${card.gradient} opacity-[0.03] rounded-full blur-xl group-hover:opacity-[0.08] transition-opacity duration-500`} />
          </div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lot Status */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/80 shadow-sm hover:shadow-md hover:border-gray-200/80 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark">Estado de Lotes</h2>
              <p className="text-xs text-rf-gray-light">Distribución del inventario</p>
            </div>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500', light: 'bg-emerald-100' },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500', light: 'bg-amber-100' },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800', light: 'bg-rf-green-100' },
            ].map((item, i) => {
              const total = stats?.total_lots || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label} className="animate-slide-up" style={{ animationDelay: `${i * 120}ms`, animationDuration: '0.5s' }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      {item.label}
                    </span>
                    <span className="font-semibold text-rf-dark">{item.value} <span className="text-gray-400 font-normal">— {pct}%</span></span>
                  </div>
                  <div className="w-full bg-gray-100/80 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out relative`}
                      style={{ width: `${pct}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full animate-pulse-soft" style={{ animationDuration: '2s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Pipeline */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-100/80 shadow-sm hover:shadow-md hover:border-gray-200/80 transition-all duration-300 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark">Pipeline de Ventas</h2>
              <p className="text-xs text-rf-gray-light">Seguimiento de oportunidades</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Leads activos', value: stats?.active_leads || 0, gradient: 'from-blue-500 to-blue-600', light: 'bg-blue-100', icon: Users },
              { label: 'Ventas activas', value: stats?.active_sales || 0, gradient: 'from-purple-500 to-indigo-600', light: 'bg-purple-100', icon: ShoppingCart },
            ].map((item, i) => (
              <div key={item.label} className="group/item flex items-center justify-between p-4 bg-gradient-to-r from-gray-50/80 to-white/80 rounded-xl border border-gray-100/80 hover:border-gray-200 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${item.light} group-hover/item:scale-110 transition-transform duration-300 shadow-sm`}>
                    <item.icon size={18} className={item.gradient.replace('from-', 'text-').replace('-500 to-', '-').replace('-600', '').split(' ')[0]} />
                  </div>
                  <span className="text-sm text-gray-500 font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-rf-dark">{item.value}</span>
                  <ArrowUpRight size={16} className="text-emerald-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

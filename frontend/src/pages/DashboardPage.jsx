import { useState, useEffect } from 'react';
import { dashboardApi } from '../lib/api';
import { Building2, Map, Users, ShoppingCart, TrendingUp, DollarSign, Layers, Target, Bookmark } from 'lucide-react';

const ICON_COLORS = [
  { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 ring-1 ring-emerald-200/30', text: 'text-emerald-700 dark:text-emerald-300', accent: 'from-emerald-500 to-emerald-400' },
  { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 ring-1 ring-blue-200/30', text: 'text-blue-700 dark:text-blue-300', accent: 'from-blue-500 to-blue-400' },
  { bg: 'bg-gradient-to-br from-green-50 to-green-100/50 ring-1 ring-green-200/30', text: 'text-green-700 dark:text-green-300', accent: 'from-green-500 to-green-400' },
  { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50 ring-1 ring-amber-200/30', text: 'text-amber-700 dark:text-amber-300', accent: 'from-amber-500 to-amber-400' },
  { bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50 ring-1 ring-violet-200/30', text: 'text-violet-700 dark:text-violet-300', accent: 'from-violet-500 to-violet-400' },
  { bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50 ring-1 ring-orange-200/30', text: 'text-orange-700 dark:text-orange-300', accent: 'from-orange-500 to-orange-400' },
  { bg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 ring-1 ring-indigo-200/30', text: 'text-indigo-700 dark:text-indigo-300', accent: 'from-indigo-500 to-indigo-400' },
  { bg: 'bg-gradient-to-br from-rf-gold/10 to-rf-gold/20 ring-1 ring-rf-gold/20', text: 'text-rf-gold-dark dark:text-rf-gold-light', accent: 'from-rf-gold to-rf-gold-light' },
  { bg: 'bg-gradient-to-br from-teal-50 to-teal-100/50 ring-1 ring-teal-200/30', text: 'text-teal-700 dark:text-teal-300', accent: 'from-teal-500 to-teal-400' },
];

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
        <div className="relative w-11 h-11">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rf-green-800 to-rf-green-600 opacity-20 blur-sm" />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-gray-200/60 dark:border-gray-600/30" />
          <div className="absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-rf-green-800 dark:border-t-rf-green-400 animate-spin" />
          <div className="absolute inset-[3px] rounded-full border-[1.5px] border-transparent border-b-rf-green-600/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.8s' }} />
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Proyectos', value: stats?.total_projects || 0, icon: Building2, badge: 'Activos' },
    { label: 'Lotes Totales', value: stats?.total_lots || 0, icon: Layers, badge: 'Inventario' },
    { label: 'Lotes Disponibles', value: stats?.available_lots || 0, icon: Map, badge: 'En venta' },
    { label: 'Reservas', value: stats?.reserved_lots || 0, icon: Bookmark, badge: 'Apartados' },
    { label: 'Clientes', value: stats?.total_clients || 0, icon: Users, badge: 'Registrados' },
    { label: 'Ventas', value: stats?.total_sales || 0, icon: ShoppingCart, badge: 'Pagadas' },
    { label: 'Ventas del Mes', value: stats?.sales_this_month || 0, icon: TrendingUp, badge: 'Este mes' },
    { label: 'Ingresos Totales', value: `$${(stats?.total_revenue || 0).toLocaleString('es-MX')}`, icon: DollarSign, badge: 'Facturado' },
    { label: 'Agentes', value: stats?.agents_count || 0, icon: Users, badge: 'Team' },
  ];

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="w-1 h-8 rounded-full bg-gradient-to-b from-rf-green-800 to-rf-green-400 dark:from-rf-green-400 dark:to-rf-green-700 opacity-80" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-rf-dark dark:text-gray-100 tracking-tight">Dashboard</h1>
            <p className="text-sm text-rf-gray-light dark:text-gray-500 mt-0.5">Resumen general de tu operación</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, i) => {
          const color = ICON_COLORS[i % ICON_COLORS.length];
          return (
            <div
              key={card.label}
              className={`stagger-${i + 1} animate-fade-slide-up card overflow-hidden hover:shadow-premium-md hover:border-gray-200 dark:hover:border-gray-600/50 transition-all duration-300`}
            >
              <div className={`h-[2px] bg-gradient-to-r ${color.accent} opacity-60`} />
              <div className="p-5 pt-4">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center`}>
                    <card.icon size={18} className={color.text} />
                  </div>
                  <span className="text-[10px] text-rf-gray-light dark:text-gray-500 font-medium uppercase tracking-wider">{card.badge}</span>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-rf-gray-light dark:text-gray-500 font-medium mb-1">{card.label}</p>
                  <p className="text-2xl font-semibold text-rf-dark dark:text-gray-100 tracking-tight">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lot Status */}
        <div className="card p-6 animate-blur-in" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 ring-1 ring-emerald-200/30 dark:ring-emerald-700/20 flex items-center justify-center">
              <Layers size={18} className="text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-rf-dark dark:text-gray-100">Estado de Lotes</h2>
              <p className="text-xs text-rf-gray-light dark:text-gray-500">Distribución del inventario</p>
            </div>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-gradient-to-r from-emerald-400 to-emerald-500', dot: 'bg-emerald-500' },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-gradient-to-r from-amber-400 to-amber-500', dot: 'bg-amber-500' },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-gradient-to-r from-rf-green-700 to-rf-green-800', dot: 'bg-rf-green-800' },
            ].map((item, i) => {
              const total = stats?.total_lots || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-rf-gray dark:text-gray-400 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                    <span className="font-medium text-rf-dark dark:text-gray-100">{item.value} <span className="text-rf-gray-light dark:text-gray-500 font-normal">— {pct}%</span></span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out shadow-sm`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Pipeline */}
        <div className="card p-6 animate-blur-in" style={{ animationDelay: '0.42s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/30 dark:to-violet-800/20 ring-1 ring-violet-200/30 dark:ring-violet-700/20 flex items-center justify-center">
              <Target size={18} className="text-violet-700 dark:text-violet-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-rf-dark dark:text-gray-100">Pipeline de Ventas</h2>
              <p className="text-xs text-rf-gray-light dark:text-gray-500">Seguimiento de oportunidades</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Leads activos', value: stats?.active_leads || 0, bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-200/30 dark:ring-blue-700/20', icon: Users },
              { label: 'Ventas activas', value: stats?.active_sales || 0, bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-900/30 dark:to-violet-800/20', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-200/30 dark:ring-violet-700/20', icon: ShoppingCart },
            ].map((item, i) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-4 bg-gray-50/60 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600/50 hover:shadow-premium-sm hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-all duration-300 animate-fade-slide-up"
                style={{ animationDelay: `${0.5 + i * 0.08}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} ring-1 ${item.ring} flex items-center justify-center`}>
                    <item.icon size={16} className={item.text} />
                  </div>
                  <span className="text-sm text-rf-gray dark:text-gray-400 font-medium">{item.label}</span>
                </div>
                <span className="text-xl font-semibold text-rf-dark dark:text-gray-100">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

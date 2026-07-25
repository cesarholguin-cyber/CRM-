import { useState, useEffect } from 'react';
import { dashboardApi } from '../lib/api';
import { Building2, Map, Users, ShoppingCart, TrendingUp, DollarSign, Layers, Target, Bookmark } from 'lucide-react';

const ICON_COLORS = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { bg: 'bg-blue-50', text: 'text-blue-700' },
  { bg: 'bg-green-50', text: 'text-green-700' },
  { bg: 'bg-amber-50', text: 'text-amber-700' },
  { bg: 'bg-violet-50', text: 'text-violet-700' },
  { bg: 'bg-orange-50', text: 'text-orange-700' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  { bg: 'bg-rf-gold/10', text: 'text-rf-gold-dark' },
  { bg: 'bg-teal-50', text: 'text-teal-700' },
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
        <div className="w-10 h-10 border-[2.5px] border-gray-200 border-t-rf-green-800 rounded-full animate-spin" />
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
        <h1 className="text-2xl font-bold text-rf-dark tracking-tight">Dashboard</h1>
        <p className="text-sm text-rf-gray-light mt-1">Resumen general de tu operación</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-8">
        {cards.map((card, i) => {
          const color = ICON_COLORS[i % ICON_COLORS.length];
          return (
            <div
              key={card.label}
              className="card p-5 hover:shadow-premium-md hover:border-gray-200 transition-all duration-300 animate-slide-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${color.bg} flex items-center justify-center`}>
                  <card.icon size={18} className={color.text} />
                </div>
                <span className="text-[10px] text-rf-gray-light font-medium uppercase tracking-wider">{card.badge}</span>
              </div>
              <p className="text-xs text-rf-gray-light font-medium mb-1">{card.label}</p>
              <p className="text-2xl font-semibold text-rf-dark tracking-tight">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lot Status */}
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Layers size={18} className="text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-rf-dark">Estado de Lotes</h2>
              <p className="text-xs text-rf-gray-light">Distribución del inventario</p>
            </div>
          </div>
          <div className="space-y-5">
            {[
              { label: 'Disponibles', value: stats?.available_lots || 0, color: 'bg-emerald-500', dot: 'bg-emerald-500' },
              { label: 'Apartados', value: stats?.reserved_lots || 0, color: 'bg-amber-500', dot: 'bg-amber-500' },
              { label: 'Vendidos', value: stats?.sold_lots || 0, color: 'bg-rf-green-800', dot: 'bg-rf-green-800' },
            ].map((item, i) => {
              const total = stats?.total_lots || 1;
              const pct = Math.round((item.value / total) * 100);
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-rf-gray font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                    <span className="font-medium text-rf-dark">{item.value} <span className="text-rf-gray-light font-normal">— {pct}%</span></span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Pipeline */}
        <div className="card p-6 animate-slide-up" style={{ animationDelay: '0.48s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <Target size={18} className="text-violet-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-rf-dark">Pipeline de Ventas</h2>
              <p className="text-xs text-rf-gray-light">Seguimiento de oportunidades</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Leads activos', value: stats?.active_leads || 0, bg: 'bg-blue-50', text: 'text-blue-700', icon: Users },
              { label: 'Ventas activas', value: stats?.active_sales || 0, bg: 'bg-violet-50', text: 'text-violet-700', icon: ShoppingCart },
            ].map((item, i) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-4 bg-gray-50/60 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-premium-sm transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${0.56 + i * 0.08}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                    <item.icon size={16} className={item.text} />
                  </div>
                  <span className="text-sm text-rf-gray font-medium">{item.label}</span>
                </div>
                <span className="text-xl font-semibold text-rf-dark">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

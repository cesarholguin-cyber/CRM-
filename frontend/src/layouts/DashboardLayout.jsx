import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  LayoutDashboard, Users, Building2, Map, ShoppingCart,
  BarChart3, Settings, LogOut, ChevronLeft, Menu, X,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Building2, label: 'Proyectos', path: '/projects' },
  { icon: Map, label: 'Inventario de Lotes', path: '/lots' },
  { icon: Users, label: 'Clientes', path: '/clients' },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales' },
  { icon: BarChart3, label: 'Reportes', path: '/reports' },
  { icon: Settings, label: 'Configuración', path: '/settings' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    setPageKey((k) => k + 1);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentPage = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-rf-green-50/30">
      {/* Animated background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-rf-green-200/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rf-green-300/20 rounded-full blur-3xl animate-pulse-soft" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-rf-gold/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDuration: '5s' }} />
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-gradient-to-b from-rf-green-900 via-rf-green-800 to-rf-green-900
          text-white transition-all duration-500 ease-out flex flex-col shadow-2xl
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center p-2.5 flex-shrink-0 ring-2 ring-white/20 shadow-lg transition-all duration-500 hover:rotate-6 hover:scale-110 hover:ring-rf-gold-light/50">
            <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full brightness-0 invert drop-shadow-lg" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-lg font-bold leading-tight text-white tracking-wide">R&F</h1>
              <p className="text-[10px] text-rf-green-200/60 uppercase tracking-widest">Desarrollos Campestres</p>
            </div>
          )}
        </div>

        <button onClick={() => setMobileOpen(false)} className="md:hidden absolute top-4 right-4 text-white/60 hover:text-white">
          <X size={20} />
        </button>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto px-2">
          {navItems.map((item, i) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-300 group relative overflow-hidden
                  ${isActive
                    ? 'bg-white/15 text-white font-medium shadow-lg backdrop-blur-sm'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-fade-in" />
                )}
                <div className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <item.icon size={20} />
                </div>
                {!collapsed && (
                  <span className="relative z-10 text-sm font-medium">{item.label}</span>
                )}
                {isActive && !collapsed && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-rf-gold-light animate-pulse-soft" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-white/10 p-4 space-y-3">
          {!collapsed && user && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rf-gold-light to-rf-gold text-white flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0">
                {user.full_name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-all duration-300 w-full group py-1">
            <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex items-center justify-center py-3 border-t border-white/5 text-white/30 hover:text-white/60 transition-all duration-300">
          <ChevronLeft size={16} className={`transition-all duration-500 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="bg-white/70 backdrop-blur-xl border-b border-white/20 px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-rf-green-900 hover:text-rf-green-600 transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
            <span className="text-xs text-rf-gray-light font-medium uppercase tracking-wider">
              {currentPage?.label || 'Dashboard'}
            </span>
          </div>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-3 animate-fade-in bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20 shadow-sm">
              <span className="text-sm text-rf-gray font-medium hidden sm:block">{user.full_name}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-700 to-rf-green-900 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white/50">
                {user.full_name?.charAt(0)}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div key={pageKey} className="animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

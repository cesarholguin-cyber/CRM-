import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  LayoutDashboard, Users, Building2, Map, ShoppingCart,
  Bookmark, BarChart3, Settings, LogOut, ChevronLeft, Menu, X,
} from 'lucide-react';

const allNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin'] },
  { icon: Building2, label: 'Proyectos', path: '/projects', roles: ['admin', 'supervisor', 'employee'] },
  { icon: Map, label: 'Inventario de Lotes', path: '/lots', roles: ['admin', 'supervisor', 'employee'] },
  { icon: Users, label: 'Clientes', path: '/clients', roles: ['admin', 'supervisor', 'employee'] },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales', roles: ['admin', 'supervisor', 'employee'] },
  { icon: Bookmark, label: 'Apartados', path: '/apartados', roles: ['admin', 'supervisor', 'employee'] },
  { icon: BarChart3, label: 'Reportes', path: '/reports', roles: ['admin', 'supervisor', 'employee'] },
  { icon: Settings, label: 'Configuración', path: '/settings', roles: ['admin', 'supervisor', 'employee'] },
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

  const navItems = allNavItems.filter((item) => item.roles.includes(user?.role));
  const currentPage = navItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'));

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-rf-green-50/30">
      {/* Animated background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="bg-orb w-[600px] h-[600px] bg-rf-green-200/15 -top-48 -right-48 animate-drift" />
        <div className="bg-orb w-[400px] h-[400px] bg-rf-gold/8 -bottom-32 -left-32 animate-drift" style={{ animationDelay: '-4s' }} />
        <div className="bg-orb w-[300px] h-[300px] bg-rf-green-300/10 top-1/2 left-1/3 animate-drift" style={{ animationDelay: '-2s' }} />
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-premium-dark
          text-white transition-all duration-500 ease-out flex flex-col shadow-2xl
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className={`relative flex-shrink-0 transition-all duration-500 ${collapsed ? 'w-12 h-12' : 'w-11 h-11'}`}>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-rf-gold/20 to-transparent animate-pulse-soft" />
            <div className="relative w-full h-full rounded-xl bg-white/5 backdrop-blur-md flex items-center justify-center p-2 ring-1 ring-white/10 shadow-lg">
              <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full brightness-0 invert drop-shadow-lg" />
            </div>
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-lg font-bold leading-tight text-white tracking-wide">R&F</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Desarrollos Campestres</p>
            </div>
          )}
        </div>

        <button onClick={() => setMobileOpen(false)} className="md:hidden absolute top-4 right-4 text-white/60 hover:text-white">
          <X size={20} />
        </button>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto px-3">
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
                    ? 'text-white font-medium'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
                style={{ animation: `fade-in 0.4s ease-out ${i * 50}ms both` }}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent rounded-xl animate-fade-in" />
                )}
                <div className={`relative z-10 transition-all duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                  <item.icon size={20} />
                </div>
                {!collapsed && (
                  <span className="relative z-10 text-sm font-medium">{item.label}</span>
                )}
                {isActive && !collapsed && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-rf-gold-light animate-pulse-soft shadow-lg shadow-rf-gold-light/50" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-white/5 p-4 space-y-3">
          {!collapsed && user && (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rf-gold-light to-rf-gold text-white flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0">
                  {user.full_name?.charAt(0)}
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-rf-green-900" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{user.full_name}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{user.role === 'admin' ? 'Admin' : user.role === 'supervisor' ? 'Supervisor' : 'Empleado'}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-white/30 hover:text-white/70 transition-all duration-300 w-full group py-1 px-1 rounded-lg hover:bg-white/5">
            <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex items-center justify-center py-3 border-t border-white/5 text-white/20 hover:text-white/50 transition-all duration-300">
          <ChevronLeft size={16} className={`transition-all duration-500 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="glass-card rounded-none md:rounded-b-2xl px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-rf-green-900 hover:text-rf-green-600 transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft shadow-lg shadow-emerald-500/30" />
            <span className="text-xs text-rf-gray-light font-medium uppercase tracking-wider">
              {currentPage?.label || 'Dashboard'}
            </span>
          </div>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-3 animate-fade-in glass-premium rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-sm text-rf-gray font-medium hidden sm:block">{user.full_name}</span>
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-700 to-rf-green-900 text-white flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white/50">
                  {user.full_name?.charAt(0)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
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

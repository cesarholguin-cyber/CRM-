import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import {
  LayoutDashboard, Users, Building2, Map, ShoppingCart,
  Bookmark, BarChart3, Settings, LogOut, ChevronLeft, Menu, X,
  Sun, Moon,
} from 'lucide-react';

const allNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['ADMIN'] },
  { icon: Building2, label: 'Proyectos', path: '/projects', roles: ['ADMIN', 'PROMOTOR'] },
  { icon: Map, label: 'Inventario de Lotes', path: '/lots', roles: ['ADMIN', 'PROMOTOR'] },
  { icon: Users, label: 'Clientes', path: '/clients', roles: ['ADMIN', 'PROMOTOR'] },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales', roles: ['ADMIN', 'PROMOTOR'] },
  { icon: Bookmark, label: 'Apartados', path: '/apartados', roles: ['ADMIN', 'PROMOTOR'] },
  { icon: BarChart3, label: 'Reportes', path: '/reports', roles: ['ADMIN'] },
  { icon: Settings, label: 'Configuración', path: '/settings', roles: ['ADMIN', 'PROMOTOR'] },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setPageKey((k) => k + 1);
  }, [location.pathname]);

  useEffect(() => {
    const el = document.getElementById('main-scroll-area');
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 2);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = allNavItems.filter((item) => item.roles.includes(user?.role));
  const currentPage = navItems.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/'),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-rf-green-50/30 dark:from-[#0a0c14] dark:via-[#0d0f18] dark:to-[#0a1010]">

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 flex flex-col
          bg-premium-dark text-white
          transition-[width] duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)]
          shadow-premium-xl
          ${collapsed ? 'w-[72px]' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Subtle gradient overlay on sidebar */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] via-transparent to-black/[0.15] pointer-events-none" />

        {/* Logo */}
        <div className={`relative flex items-center gap-3 px-4 h-16 flex-shrink-0 border-b border-white/[0.06] ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center p-1.5 ring-1 ring-white/[0.08] flex-shrink-0 transition-transform duration-300 hover:scale-105">
            <img
              src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png"
              alt="R&F"
              className="w-full brightness-0 invert opacity-90"
            />
          </div>
          {!collapsed && (
            <div className="overflow-hidden animate-fade-in">
              <h1 className="text-sm font-semibold leading-tight text-white/90 tracking-wide">R&F</h1>
              <p className="text-[9px] text-white/25 uppercase tracking-[0.18em]">Desarrollos Campestres</p>
            </div>
          )}
        </div>

        {/* Mobile close */}
        <button onClick={() => setMobileOpen(false)} className="md:hidden absolute top-4 right-3 text-white/40 hover:text-white/70 transition-colors duration-200">
          <X size={18} />
        </button>

        {/* Nav */}
        <nav className="relative flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item, i) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`
                  relative flex items-center gap-3 rounded-xl
                  transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]
                  group
                  ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
                  ${isActive
                    ? 'bg-white/[0.08] text-white/95 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'text-white/35 hover:text-white/75 hover:bg-white/[0.04]'
                  }
                `}
                style={{ animationDelay: `${i * 50}ms`, animation: 'fade-slide-up 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
              >
                {/* Active left accent */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-rf-gold-light/90 to-rf-gold/60" />
                )}
                <item.icon size={19} strokeWidth={1.8} className={`flex-shrink-0 transition-all duration-[250ms] ${isActive ? 'text-white/90' : 'group-hover:scale-105 group-hover:text-white/60'}`} />
                {!collapsed && (
                  <span className="text-[13px] truncate transition-colors duration-200">{item.label}</span>
                )}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-rf-green-900/95 text-white text-xs font-medium
                    opacity-0 scale-95 blur-[2px] pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:blur-0
                    transition-all duration-250 whitespace-nowrap z-[60] shadow-premium-lg border border-white/[0.06]">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="relative px-3 pb-3 space-y-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 text-white/25 hover:text-white/60 transition-all duration-300 w-full py-2 px-3 rounded-xl hover:bg-white/[0.04] group"
          >
            <LogOut size={16} className="flex-shrink-0 transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:text-red-400/70" />
            {!collapsed && <span className="text-[13px]">Cerrar sesión</span>}
          </button>

          {!collapsed && user && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.05] animate-fade-in transition-all duration-300 hover:bg-white/[0.06]">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-gold-light/70 to-rf-gold-dark/60 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 ring-1 ring-white/[0.08]">
                {user.full_name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white/80 truncate">{user.full_name}</p>
                <p className="text-[9px] text-white/25 uppercase tracking-wider">{user.role === 'ADMIN' ? 'Admin' : 'Promotor'}</p>
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="flex justify-center py-1">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rf-gold-light/70 to-rf-gold-dark/60 text-white flex items-center justify-center text-xs font-bold ring-1 ring-white/[0.08] transition-transform duration-300 hover:scale-105">
                  {user.full_name?.charAt(0)}
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-[1.5px] border-rf-green-900 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
              </div>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="relative hidden md:flex items-center justify-center h-10 border-t border-white/[0.06] text-white/15 hover:text-white/40 transition-all duration-300 hover:bg-white/[0.02]"
        >
          <ChevronLeft size={15} className={`transition-transform duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* ── Mobile backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <header
          className={`
            sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6
            transition-all duration-300
            ${scrolled
              ? 'glass-elevated shadow-premium-sm'
              : 'glass-card'
            }
          `}
        >
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-rf-gray dark:text-gray-400 hover:text-rf-dark dark:hover:text-gray-200 transition-colors duration-200">
            <Menu size={20} />
          </button>

          {/* Breadcrumb-style page indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-rf-gray-light/70 dark:text-gray-500 font-medium uppercase tracking-wider">R&F</span>
            <span className="text-rf-gray-light/20 dark:text-gray-700 text-[10px]">/</span>
            <span className="text-[12px] text-rf-gray dark:text-gray-300 font-medium">
              {currentPage?.label || 'Dashboard'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-rf-gray-light dark:text-gray-400 hover:text-rf-dark dark:hover:text-gray-200 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all duration-300 active:scale-95"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user && (
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] text-rf-gray dark:text-gray-400 hidden sm:block">{user.full_name}</span>
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-700 to-rf-green-900 text-white flex items-center justify-center text-xs font-bold ring-2 ring-white/50 dark:ring-white/10 shadow-premium-xs transition-transform duration-300 hover:scale-105">
                  {user.full_name?.charAt(0)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-[1.5px] border-white dark:border-[#12141e] shadow-[0_0_6px_rgba(16,185,129,0.3)]" />
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main id="main-scroll-area" className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6 lg:py-8">
            {/* Faint dot pattern background */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.012] dark:opacity-[0.025]"
              style={{
                backgroundImage: 'radial-gradient(circle, #1a3c2a 0.5px, transparent 0.5px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div key={pageKey} className="relative z-10" style={{ animation: 'reveal-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

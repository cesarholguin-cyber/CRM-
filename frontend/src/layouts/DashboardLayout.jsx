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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-rf-green-800 text-white
          transition-all duration-300 flex flex-col shadow-xl
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-rf-green-700/50">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center p-2.5 flex-shrink-0 ring-2 ring-white/20 transition-transform hover:scale-105 duration-300">
            <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full brightness-0 invert" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-base font-bold leading-tight text-white">R&F</h1>
              <p className="text-xs text-rf-green-200/80">Desarrollos Campestres</p>
            </div>
          )}
        </div>

        <button onClick={() => setMobileOpen(false)} className="md:hidden absolute top-4 right-4 text-white">
          <X size={20} />
        </button>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 mx-2 rounded-lg
                  transition-all duration-200
                  ${isActive
                    ? 'bg-white text-rf-green-900 font-medium shadow-md scale-[1.02]'
                    : 'text-rf-green-200/80 hover:bg-white/10 hover:text-white'
                  }
                  ${collapsed ? 'justify-center mx-2' : ''}
                `}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <item.icon size={20} className={isActive ? 'text-rf-green-800' : ''} />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-rf-green-700/50 p-4">
          {!collapsed && user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white">{user.full_name}</p>
              <p className="text-xs text-rf-green-200/60 capitalize">{user.role}</p>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-rf-green-200/70 hover:text-white transition-colors w-full group">
            <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:flex items-center justify-center py-3 border-t border-rf-green-700/50 text-rf-green-300/60 hover:text-white transition-colors">
          <ChevronLeft size={18} className={`transition-all duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-fade-in" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-4 shadow-sm sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-rf-green-800 hover:text-rf-green-600 transition-colors">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-3 animate-fade-in">
              <span className="text-sm text-rf-gray hidden sm:block">{user.full_name}</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-600 to-rf-green-800 text-white flex items-center justify-center text-xs font-bold shadow-md">
                {user.full_name?.charAt(0)}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div key={pageKey} className="animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

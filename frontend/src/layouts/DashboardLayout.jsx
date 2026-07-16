import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  LayoutDashboard, Users, Building2, Map, ShoppingCart,
  BarChart3, Settings, LogOut, ChevronLeft, Menu, X,
  Home,
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
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-rf-cream">
      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          bg-rf-green-800 text-white
          transition-all duration-300 flex flex-col
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-rf-green-700">
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold leading-tight text-white">R&F</h1>
              <p className="text-xs text-rf-green-200">Desarrollos Campestres</p>
            </div>
          )}
        </div>

        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute top-4 right-4 text-white"
        >
          <X size={20} />
        </button>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-rf-gold-light text-rf-green-900 font-medium'
                    : 'text-rf-green-200 hover:bg-rf-green-700 hover:text-white'
                  }
                  ${collapsed ? 'justify-center mx-2' : ''}
                `}
              >
                <item.icon size={20} />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-rf-green-700 p-4">
          {!collapsed && user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white">{user.full_name}</p>
              <p className="text-xs text-rf-green-300 capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-rf-green-200 hover:text-white transition-colors w-full"
          >
            <LogOut size={18} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center py-3 border-t border-rf-green-700 text-rf-green-300 hover:text-white"
        >
          <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-rf-cream-dark px-4 py-3 flex items-center gap-4 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-rf-green-800">
            <Menu size={24} />
          </button>
          <div className="flex-1" />
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-rf-gray hidden sm:block">{user.full_name}</span>
              <div className="w-8 h-8 rounded-full bg-rf-green-600 text-white flex items-center justify-center text-xs font-bold">
                {user.full_name?.charAt(0)}
              </div>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

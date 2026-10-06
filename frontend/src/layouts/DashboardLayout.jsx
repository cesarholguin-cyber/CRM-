import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import {
  LayoutDashboard, Users, Building2, Map, ShoppingCart, Bookmark,
  BarChart3, Settings, LogOut, PanelLeftClose, PanelLeftOpen, Menu, X,
  Sun, Moon, Search, ArrowUpRight, ChevronRight, Leaf,
} from 'lucide-react';

const allNavItems = [
  { icon: LayoutDashboard, label: 'Resumen', path: '/dashboard', roles: ['ADMIN'], description: 'Indicadores y panorama de tu operación' },
  { icon: Building2, label: 'Proyectos', path: '/projects', roles: ['ADMIN', 'PROMOTOR'], description: 'Desarrollos y sus terrenos' },
  { icon: Map, label: 'Inventario de lotes', path: '/lots', roles: ['ADMIN', 'PROMOTOR'], description: 'Disponibilidad, precios y estados' },
  { icon: Users, label: 'Clientes', path: '/clients', roles: ['ADMIN', 'PROMOTOR'], description: 'Contactos y oportunidades' },
  { icon: ShoppingCart, label: 'Ventas', path: '/sales', roles: ['ADMIN', 'PROMOTOR'], description: 'Operaciones y seguimiento comercial' },
  { icon: Bookmark, label: 'Apartados', path: '/apartados', roles: ['ADMIN', 'PROMOTOR'], description: 'Reservas, citas y consultas de la web' },
  { icon: BarChart3, label: 'Reportes', path: '/reports', roles: ['ADMIN'], description: 'Resultados de tus desarrollos' },
  { icon: Settings, label: 'Configuración', path: '/settings', roles: ['ADMIN', 'PROMOTOR'], description: 'Tu cuenta y preferencias' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchDialog = useRef(null);
  const searchInput = useRef(null);
  const mobileDialog = useRef(null);
  const content = useRef(null);
  const ambient = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navItems = allNavItems.filter(item => item.roles.includes(user?.role));
  const currentPage = navItems.find(item => location.pathname === item.path) || navItems[0];
  const matches = navItems.filter(item => `${item.label} ${item.description}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));

  function openSearch() { setQuery(''); searchDialog.current?.showModal(); searchInput.current?.focus(); }
  function closeMobile() { mobileDialog.current?.close(); setMobileOpen(false); }
  function go(path) { searchDialog.current?.close(); closeMobile(); navigate(path); }
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchDialog.current?.open) searchDialog.current.close(); else openSearch();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: no-preference) and (pointer: fine)');
    let frame = 0;
    const move = e => {
      if (!media.matches || frame) return;
      frame = requestAnimationFrame(() => {
        ambient.current?.style.setProperty('--ambient-x', `${(e.clientX / window.innerWidth - .5) * 60}px`);
        ambient.current?.style.setProperty('--ambient-y', `${(e.clientY / window.innerHeight - .5) * 40}px`);
        frame = 0;
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, []);

  const navigation = compact => <>
    <Link to={user?.role === 'ADMIN' ? '/dashboard' : '/projects'} className="crm-brand" onClick={closeMobile} aria-label="R&F, inicio">
      <span className="crm-monogram">R<span>&</span>F</span>
      {!compact && <span><strong>R&F Campestre</strong><small>ESPACIO DE TRABAJO</small></span>}
    </Link>
    <nav className="crm-navigation" aria-label="Navegación principal">
      {!compact && <p className="crm-nav-label">GESTIÓN COMERCIAL</p>}
      {navItems.map(item => <Link key={item.path} to={item.path} onClick={closeMobile} className="crm-nav-link" title={compact ? item.label : undefined} aria-label={compact ? item.label : undefined} aria-current={location.pathname === item.path ? 'page' : undefined}>
        <item.icon size={19} strokeWidth={1.7}/>{!compact && <><span>{item.label}</span>{location.pathname === item.path && <ChevronRight size={14}/>}</>}
      </Link>)}
    </nav>
    {!compact && <div className="crm-sidebar-note"><Leaf size={19}/><p>Grandes proyectos.<br/><strong>Relaciones que crecen.</strong></p></div>}
    <div className="crm-sidebar-footer">
      <Link to="/settings" className="crm-profile" onClick={closeMobile} aria-label="Mi perfil" title={compact ? user?.full_name : undefined}>
        <span className="crm-avatar">{user?.full_name?.charAt(0)}</span>
        {!compact && <span><strong>{user?.full_name}</strong><small>{user?.role === 'ADMIN' ? 'Administrador' : 'Promotor'}</small></span>}
      </Link>
      <button className="crm-logout" onClick={() => { logout(); navigate('/login'); }} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17}/>{!compact && <span>Cerrar sesión</span>}</button>
    </div>
  </>;

  return <div className={`crm-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <a className="crm-skip" href="#main-scroll-area">Saltar al contenido</a>
    <div ref={ambient} className="crm-ambient" aria-hidden="true"><i/><i/><i/></div>
    <aside className="crm-sidebar">{navigation(collapsed)}<button className="crm-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={17}/> : <><PanelLeftClose size={17}/><span>Contraer menú</span></>}</button></aside>
    <dialog ref={mobileDialog} className="crm-mobile-dialog" aria-label="Menú de navegación" onClose={() => setMobileOpen(false)} onClick={e => { if (e.target === mobileDialog.current) closeMobile(); }}>
      <div className="crm-mobile-panel"><button className="crm-mobile-close" onClick={closeMobile} aria-label="Cerrar menú"><X size={20}/></button>{navigation(false)}</div>
    </dialog>
    <div className="crm-workspace">
      <header className="crm-topbar">
        <button className="crm-icon-button crm-menu-toggle" onClick={() => { mobileDialog.current?.showModal(); setMobileOpen(true); }} aria-label="Abrir menú" aria-expanded={mobileOpen}><Menu size={21}/></button>
        <div className="crm-breadcrumb"><span>Mi espacio</span><ChevronRight size={13}/><strong>{currentPage?.label}</strong></div>
        <div className="crm-header-actions">
          <button className="crm-search-trigger" onClick={openSearch} aria-label="Buscar sección" title="Buscar sección (Ctrl o ⌘ K)"><Search size={17}/><span>Ir a una sección</span><kbd>⌘ K</kbd></button>
          <button className="crm-icon-button" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button>
          <Link to="/settings" className="crm-header-avatar" aria-label="Abrir mi perfil">{user?.full_name?.charAt(0)}</Link>
        </div>
      </header>
      <main id="main-scroll-area" ref={content} tabIndex="-1" className="crm-main">
        <div className="crm-page" key={location.pathname}><Outlet/></div>
        <footer className="crm-workspace-footer"><span>R&F · Desarrollos Campestres</span><span>Tu operación, en un solo lugar.</span></footer>
      </main>
    </div>
    <dialog ref={searchDialog} className="crm-command" aria-labelledby="command-title" onClick={e => { if(e.target === searchDialog.current) searchDialog.current.close(); }}>
      <div className="crm-command-inner">
        <div className="crm-command-heading"><h2 id="command-title">¿A dónde quieres ir?</h2><button className="crm-icon-button" onClick={() => searchDialog.current.close()} aria-label="Cerrar búsqueda"><X size={19}/></button></div>
        <form onSubmit={e => { e.preventDefault(); if(matches[0]) go(matches[0].path); }}><label className="crm-command-input"><Search size={20}/><input ref={searchInput} aria-label="Buscar sección" placeholder="Busca lotes, apartados, clientes…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>ESC</kbd></label></form>
        <div className="crm-command-results">{matches.map(item => <button key={item.path} onClick={() => go(item.path)}><span className="crm-command-icon"><item.icon size={20}/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowUpRight size={17}/></button>)}{!matches.length && <p className="crm-command-empty">No encontramos esa sección. Intenta con «lotes» o «clientes».</p>}</div>
        <p className="crm-command-hint">Enter para abrir la primera coincidencia · Tab para recorrer</p>
      </div>
    </dialog>
  </div>;
}

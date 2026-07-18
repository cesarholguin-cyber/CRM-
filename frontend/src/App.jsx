import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { salesApi } from './lib/api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import LotsPage from './pages/LotsPage';
import ClientsPage from './pages/ClientsPage';
import SalesPage from './pages/SalesPage';
import ApartadosPage from './pages/ApartadosPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import DashboardLayout from './layouts/DashboardLayout';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

function useApartadosPolling() {
  const notifiedIds = useRef(new Set());
  const isFirstRun = useRef(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const res = await salesApi.list({ status: 'reserved' });
        const reserved = res.data || [];
        const currentIds = new Set(reserved.map((s) => s.id));

        if (isFirstRun.current) {
          isFirstRun.current = false;
          currentIds.forEach((id) => notifiedIds.current.add(id));
          return;
        }

        for (const sale of reserved) {
          if (!notifiedIds.current.has(sale.id)) {
            notifiedIds.current.add(sale.id);
            playNotificationSound();
          }
        }

        // Clean removed IDs
        for (const id of notifiedIds.current) {
          if (!currentIds.has(id)) {
            notifiedIds.current.delete(id);
          }
        }
      } catch {}
    };

    const timer = setTimeout(check, 3000);
    const interval = setInterval(check, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user]);
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-rf-cream"><div className="animate-spin w-10 h-10 border-4 border-rf-green-600 border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  useApartadosPolling();
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><DashboardPage /></ProtectedRoute>} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="lots" element={<LotsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="apartados" element={<ApartadosPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

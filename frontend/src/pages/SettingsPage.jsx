import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { authApi } from '../lib/api';
import { Settings, User, Shield, Key, Smartphone } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return setErr('Las contraseñas no coinciden');
    }
    try {
      await authApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setMsg('Contraseña actualizada exitosamente');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setErr(err.response?.data?.detail || 'Error');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Seguridad', icon: Shield },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings size={24} className="text-rf-green-600" />
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Configuración</h1>
          <p className="text-sm text-rf-gray-light mt-1">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === t.id ? 'bg-rf-green-800 text-white' : 'bg-white text-rf-gray border border-rf-cream-dark hover:bg-rf-cream'
          }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl p-6 border border-rf-cream-dark max-w-lg">
          <h2 className="text-lg font-semibold text-rf-dark mb-4">Información del Perfil</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-rf-gray-light uppercase mb-1">Nombre</label>
              <p className="text-rf-dark font-medium">{user?.full_name}</p>
            </div>
            <div>
              <label className="block text-xs text-rf-gray-light uppercase mb-1">Email</label>
              <p className="text-rf-dark">{user?.email}</p>
            </div>
            <div>
              <label className="block text-xs text-rf-gray-light uppercase mb-1">Usuario</label>
              <p className="text-rf-dark">{user?.username}</p>
            </div>
            <div>
              <label className="block text-xs text-rf-gray-light uppercase mb-1">Rol</label>
              <p className="text-rf-dark capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-6 max-w-lg">
          {/* Change password */}
          <div className="bg-white rounded-xl p-6 border border-rf-cream-dark">
            <h2 className="text-lg font-semibold text-rf-dark mb-4 flex items-center gap-2">
              <Key size={18} /> Cambiar Contraseña
            </h2>
            {msg && <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm mb-4">{msg}</div>}
            {err && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{err}</div>}
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Contraseña actual</label>
                <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Nueva contraseña</label>
                <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required minLength={8} />
                <p className="text-xs text-rf-gray-light mt-1">Mínimo 8 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Confirmar nueva contraseña</label>
                <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})} className="w-full px-3 py-2 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500" required />
              </div>
              <button type="submit" className="bg-rf-green-800 text-white px-4 py-2 rounded-lg hover:bg-rf-green-700 transition text-sm font-medium">Actualizar Contraseña</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

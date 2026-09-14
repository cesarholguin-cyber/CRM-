import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { authApi, usersApi } from '../lib/api';
import { Settings, User, Shield, Key, Users, Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [userList, setUserList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', username: '', password: '', full_name: '', phone: '', role: 'PROMOTOR' });

  const canManageUsers = user?.role === 'ADMIN';

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

  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await usersApi.list();
      setUserList(res.data);
    } catch (err) {
      setErr(err.response?.data?.detail || 'Error al cargar usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (canManageUsers && tab === 'users') loadUsers();
  }, [tab]);

  const [createErr, setCreateErr] = useState('');

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateErr('');
    try {
      const payload = { ...createForm };
      if (!payload.phone) delete payload.phone;
      await usersApi.create(payload);
      setShowCreate(false);
      setCreateForm({ email: '', username: '', password: '', full_name: '', phone: '', role: 'PROMOTOR' });
      setMsg('Usuario creado exitosamente');
      await loadUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setCreateErr(detail.map(d => d.msg).join(', '));
      } else {
        setCreateErr(detail || 'Error al crear usuario');
      }
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await usersApi.delete(id);
      await loadUsers();
    } catch (err) {
      setErr(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'security', label: 'Seguridad', icon: Shield },
    ...(canManageUsers ? [{ id: 'users', label: 'Usuarios', icon: Users }] : []),
  ];

  const roleBadge = (role) => {
    const styles = {
      ADMIN: 'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50',
      PROMOTOR: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
    };
    return styles[role] || 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700/50 dark:text-gray-400 dark:border-gray-600/50';
  };

  const roleLabel = (role) => {
    const labels = { ADMIN: 'Admin', PROMOTOR: 'Promotor' };
    return labels[role] || role;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 stagger-1 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-800 to-rf-green-600 flex items-center justify-center shadow-premium-sm ring-1 ring-rf-green-700/20">
            <Settings size={20} className="text-white" />
          </div>
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-rf-green-800 to-rf-green-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark dark:text-gray-100 tracking-tight">Configuración</h1>
          <p className="text-sm text-rf-gray-light dark:text-gray-500 mt-1">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap stagger-2 animate-fade-in">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white shadow-lg shadow-rf-green-800/20 ring-1 ring-rf-green-600/30'
                : 'bg-white/60 dark:bg-gray-800/60 text-rf-gray dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-rf-dark dark:hover:text-gray-200 ring-1 ring-gray-200/60 dark:ring-gray-700/40'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card p-6 max-w-lg" style={{ animation: 'staggerProfile 0.5s ease-out both' }}>
          <style>{`
            @keyframes staggerProfile {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-700/15 to-rf-green-500/10 dark:from-rf-green-400/15 dark:to-rf-green-300/10 flex items-center justify-center ring-1 ring-rf-green-700/10 dark:ring-rf-green-400/10">
              <User size={18} className="text-rf-green-700 dark:text-rf-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Información del Perfil</h2>
              <p className="text-xs text-rf-gray-light dark:text-gray-500 mt-0.5">Tus datos personales registrados</p>
            </div>
          </div>
          <div>
            {[
              { label: 'Nombre', value: user?.full_name },
              { label: 'Email', value: user?.email },
              { label: 'Usuario', value: user?.username },
              { label: 'Rol', value: roleLabel(user?.role), isLast: true },
            ].map((row, i) => (
              <div
                key={row.label}
                className={`px-4 py-3.5 ${!row.isLast ? 'border-b border-gray-100 dark:border-gray-700/40' : ''}`}
                style={{ animation: `staggerProfile 0.4s ease-out ${0.05 + i * 0.06}s both` }}
              >
                <label className="block text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider mb-1 font-medium">{row.label}</label>
                <p className={`text-rf-dark dark:text-gray-100 ${i === 0 ? 'font-semibold text-[15px]' : ''}`}>{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-6 max-w-lg">
          <div className="card p-6" style={{ animation: 'staggerProfile 0.5s ease-out both' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-400/10 dark:from-amber-400/15 dark:to-orange-300/10 flex items-center justify-center ring-1 ring-amber-500/10 dark:ring-amber-400/10">
                <Key size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-rf-dark dark:text-gray-100">Cambiar Contraseña</h2>
                <p className="text-xs text-rf-gray-light dark:text-gray-500 mt-0.5">Actualiza tu contraseña de acceso</p>
              </div>
            </div>
            {msg && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-emerald-50/50 text-emerald-700 border border-emerald-200/80 dark:from-emerald-900/20 dark:to-emerald-900/10 dark:text-emerald-300 dark:border-emerald-800/40 px-4 py-3 rounded-xl text-sm mb-4 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {msg}
              </div>
            )}
            {err && (
              <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-50/50 text-red-700 border border-red-200/80 dark:from-red-900/20 dark:to-red-900/10 dark:text-red-300 dark:border-red-800/40 px-4 py-3 rounded-xl text-sm mb-4 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {err}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Contraseña actual</label>
                <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Nueva contraseña</label>
                <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} className="input" required minLength={8} />
                <p className="text-xs text-rf-gray-light dark:text-gray-500 mt-1.5">Mínimo 8 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray dark:text-gray-400 mb-1.5">Confirmar nueva contraseña</label>
                <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})} className="input" required />
              </div>
              <button type="submit" className="btn-primary">
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div style={{ animation: 'staggerProfile 0.5s ease-out both' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-rf-dark dark:text-gray-100 tracking-tight">Gestión de Usuarios</h2>
              <p className="text-sm text-rf-gray-light dark:text-gray-500 mt-0.5">Administra los usuarios del sistema</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>

          {err && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-50/50 text-red-700 border border-red-200/80 dark:from-red-900/20 dark:to-red-900/10 dark:text-red-300 dark:border-red-800/40 px-4 py-3 rounded-xl text-sm mb-4 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {err}
            </div>
          )}

          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
              <div className="card shadow-premium-xl max-w-md w-full animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="h-1 bg-gradient-to-r from-rf-green-800 to-rf-green-400" />
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-rf-dark dark:text-gray-100 mb-4">Nuevo Usuario</h3>
                  {createErr && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-red-50 to-red-50/50 text-red-700 border border-red-200/80 dark:from-red-900/20 dark:to-red-900/10 dark:text-red-300 dark:border-red-800/40 px-4 py-3 rounded-xl text-sm mb-4 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      {createErr}
                    </div>
                  )}
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <input placeholder="Nombre completo" value={createForm.full_name} onChange={(e) => setCreateForm({...createForm, full_name: e.target.value})} className="input" required />
                    <input placeholder="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({...createForm, email: e.target.value})} className="input" required />
                    <input placeholder="Usuario" value={createForm.username} onChange={(e) => setCreateForm({...createForm, username: e.target.value})} className="input" required />
                    <input placeholder="Contraseña" type="password" value={createForm.password} onChange={(e) => setCreateForm({...createForm, password: e.target.value})} className="input" required minLength={8} />
                    <input placeholder="Teléfono (opcional)" value={createForm.phone} onChange={(e) => setCreateForm({...createForm, phone: e.target.value})} className="input" />
                    <select value={createForm.role} onChange={(e) => setCreateForm({...createForm, role: e.target.value})} className="input">
                      <option value="PROMOTOR">Promotor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="submit" className="btn-primary flex-1">Crear</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-rf-green-800 via-rf-green-600 to-rf-green-400" />
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600/50 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider font-semibold">Nombre</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider font-semibold">Email</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider font-semibold">Rol</th>
                    <th className="text-right px-4 py-3.5 text-[10px] text-rf-gray-light dark:text-gray-500 uppercase tracking-wider font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u, i) => (
                    <tr
                      key={u.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gradient-to-r hover:from-rf-green-50/40 hover:to-transparent dark:hover:from-rf-green-900/10 dark:hover:to-transparent transition-all duration-200 group"
                      style={{ animation: `staggerProfile 0.35s ease-out ${0.04 + i * 0.04}s both` }}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-700 to-rf-green-500 text-white flex items-center justify-center text-xs font-bold shadow-premium-xs ring-2 ring-white dark:ring-gray-900 group-hover:shadow-md transition-shadow">
                            {u.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-rf-dark dark:text-gray-100 group-hover:text-rf-green-800 dark:group-hover:text-rf-green-300 transition-colors">{u.full_name}</p>
                            <p className="text-[10px] text-rf-gray-light dark:text-gray-500">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-rf-gray dark:text-gray-400">{u.email}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {u.id !== user?.id && (
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="btn-danger !px-2 !py-1.5 !rounded-lg text-xs flex items-center gap-1 inline-flex">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

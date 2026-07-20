import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { authApi, usersApi } from '../lib/api';
import { Settings, User, Shield, Key, Sparkles, Users, Plus, Trash2, Pencil } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // User management
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    try {
      console.log('Creating user with payload:', JSON.stringify(createForm));
      await usersApi.create(createForm);
      setShowCreate(false);
      setCreateForm({ email: '', username: '', password: '', full_name: '', phone: '', role: 'PROMOTOR' });
      setMsg('Usuario creado exitosamente');
      await loadUsers();
    } catch (err) {
      setErr(err.response?.data?.detail || 'Error al crear usuario');
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
      ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
      PROMOTOR: 'bg-blue-100 text-blue-700 border-blue-200',
    };
    return styles[role] || 'bg-gray-100 text-gray-600';
  };

  const roleLabel = (role) => {
    const labels = { ADMIN: 'Admin', PROMOTOR: 'Promotor' };
    return labels[role] || role;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-700 to-rf-green-900 flex items-center justify-center shadow-lg">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Configuración</h1>
          <p className="text-sm text-rf-gray-light mt-1">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white shadow-md'
                : 'bg-white/80 backdrop-blur-sm text-rf-gray border border-gray-200/80 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm max-w-lg animate-scale-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-100/80 to-rf-green-50/80 flex items-center justify-center">
              <User size={18} className="text-rf-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark">Información del Perfil</h2>
              <p className="text-xs text-rf-gray-light mt-0.5">Tus datos personales registrados</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl p-4 border border-gray-100/50">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Nombre</label>
              <p className="text-rf-dark font-medium">{user?.full_name}</p>
            </div>
            <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl p-4 border border-gray-100/50">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Email</label>
              <p className="text-rf-dark">{user?.email}</p>
            </div>
            <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl p-4 border border-gray-100/50">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Usuario</label>
              <p className="text-rf-dark">{user?.username}</p>
            </div>
            <div className="bg-gray-50/50 backdrop-blur-sm rounded-xl p-4 border border-gray-100/50">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Rol</label>
              <p className="text-rf-dark capitalize">{roleLabel(user?.role)}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-sm animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100/80 to-amber-50/80 flex items-center justify-center">
                <Key size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-rf-dark">Cambiar Contraseña</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">Actualiza tu contraseña de acceso</p>
              </div>
            </div>
            {msg && <div className="bg-emerald-50/80 backdrop-blur-sm text-emerald-600 px-4 py-3 rounded-xl text-sm mb-4 border border-emerald-200/50 animate-slide-down">{msg}</div>}
            {err && <div className="bg-red-50/80 backdrop-blur-sm text-red-600 px-4 py-3 rounded-xl text-sm mb-4 border border-red-200/50 animate-slide-down">{err}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Contraseña actual</label>
                <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Nueva contraseña</label>
                <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" required minLength={8} />
                <p className="text-xs text-rf-gray-light mt-1.5">Mínimo 8 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Confirmar nueva contraseña</label>
                <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all shadow-sm hover:shadow-md" required />
              </div>
              <button type="submit" className="relative overflow-hidden group bg-gradient-to-r from-rf-green-800 via-rf-green-700 to-rf-green-800 text-white px-6 py-2.5 rounded-xl hover:from-rf-green-700 hover:via-rf-green-600 hover:to-rf-green-700 hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="animate-scale-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-rf-dark">Gestión de Usuarios</h2>
              <p className="text-sm text-rf-gray-light mt-0.5">Administra los usuarios del sistema</p>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white px-4 py-2.5 rounded-xl hover:shadow-lg transition-all duration-300 text-sm font-medium shadow-md">
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>

          {err && <div className="bg-red-50/80 backdrop-blur-sm text-red-600 px-4 py-3 rounded-xl text-sm mb-4 border border-red-200/50">{err}</div>}

          {/* Create user modal */}
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-2xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-rf-dark mb-4">Nuevo Usuario</h3>
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <input placeholder="Nombre completo" value={createForm.full_name} onChange={(e) => setCreateForm({...createForm, full_name: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all" required />
                  <input placeholder="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({...createForm, email: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all" required />
                  <input placeholder="Usuario" value={createForm.username} onChange={(e) => setCreateForm({...createForm, username: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all" required />
                  <input placeholder="Contraseña" type="password" value={createForm.password} onChange={(e) => setCreateForm({...createForm, password: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all" required minLength={8} />
                  <input placeholder="Teléfono (opcional)" value={createForm.phone} onChange={(e) => setCreateForm({...createForm, phone: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all" />
                  <select value={createForm.role} onChange={(e) => setCreateForm({...createForm, role: e.target.value})} className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/30 focus:border-rf-green-500 transition-all">
                    <option value="PROMOTOR">Promotor</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-rf-gray hover:bg-gray-50 transition-all text-sm font-medium">Cancelar</button>
                    <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white hover:shadow-lg transition-all text-sm font-medium shadow-md">Crear</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/30 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200/50">
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Nombre</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Email</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Rol</th>
                    <th className="text-right px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100/50 hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rf-green-700 to-rf-green-900 text-white flex items-center justify-center text-xs font-bold shadow-md">
                            {u.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-rf-dark">{u.full_name}</p>
                            <p className="text-[10px] text-rf-gray-light">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-rf-gray">{u.email}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${roleBadge(u.role)}`}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {u.id !== user?.id && (
                          <button onClick={() => handleDeleteUser(u.id)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                            <Trash2 size={15} />
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

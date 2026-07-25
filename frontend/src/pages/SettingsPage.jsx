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
      ADMIN: 'bg-purple-100 text-purple-700 border border-purple-200',
      PROMOTOR: 'bg-blue-100 text-blue-700 border border-blue-200',
    };
    return styles[role] || 'bg-gray-100 text-gray-600 border border-gray-200';
  };

  const roleLabel = (role) => {
    const labels = { ADMIN: 'Admin', PROMOTOR: 'Promotor' };
    return labels[role] || role;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-6 stagger-1 animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-rf-green-800 flex items-center justify-center shadow-premium-sm">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-rf-dark">Configuración</h1>
          <p className="text-sm text-rf-gray-light mt-1">Administra tu cuenta y preferencias</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap stagger-2 animate-fade-in">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? 'btn-primary'
                : 'btn-secondary'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card p-6 max-w-lg stagger-3 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-rf-cream flex items-center justify-center">
              <User size={18} className="text-rf-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark">Información del Perfil</h2>
              <p className="text-xs text-rf-gray-light mt-0.5">Tus datos personales registrados</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Nombre</label>
              <p className="text-rf-dark font-medium">{user?.full_name}</p>
            </div>
            <div className="card p-4">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Email</label>
              <p className="text-rf-dark">{user?.email}</p>
            </div>
            <div className="card p-4">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Usuario</label>
              <p className="text-rf-dark">{user?.username}</p>
            </div>
            <div className="card p-4">
              <label className="block text-[10px] text-rf-gray-light uppercase tracking-wider mb-1">Rol</label>
              <p className="text-rf-dark capitalize">{roleLabel(user?.role)}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="space-y-6 max-w-lg">
          <div className="card p-6 stagger-3 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-rf-cream flex items-center justify-center">
                <Key size={18} className="text-rf-green-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-rf-dark">Cambiar Contraseña</h2>
                <p className="text-xs text-rf-gray-light mt-0.5">Actualiza tu contraseña de acceso</p>
              </div>
            </div>
            {msg && <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl text-sm mb-4">{msg}</div>}
            {err && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm mb-4">{err}</div>}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Contraseña actual</label>
                <input type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Nueva contraseña</label>
                <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})} className="input" required minLength={8} />
                <p className="text-xs text-rf-gray-light mt-1.5">Mínimo 8 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Confirmar nueva contraseña</label>
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
        <div className="stagger-3 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-rf-dark">Gestión de Usuarios</h2>
              <p className="text-sm text-rf-gray-light mt-0.5">Administra los usuarios del sistema</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>

          {err && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm mb-4">{err}</div>}

          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowCreate(false)}>
              <div className="card p-6 shadow-premium-xl max-w-md w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-rf-dark mb-4">Nuevo Usuario</h3>
                {createErr && <div className="bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-xl text-sm mb-4">{createErr}</div>}
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
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Nombre</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Email</th>
                    <th className="text-left px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Rol</th>
                    <th className="text-right px-4 py-3.5 text-[10px] text-rf-gray-light uppercase tracking-wider font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rf-green-800 text-white flex items-center justify-center text-xs font-bold shadow-premium-xs">
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

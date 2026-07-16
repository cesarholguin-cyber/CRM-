import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, totpCode || undefined);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 428) {
        setRequires2FA(true);
      } else {
        setError(err.response?.data?.detail || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-rf-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="w-56 h-56 mx-auto mb-6 rounded-full bg-gradient-to-br from-rf-green-800 to-rf-green-600 flex items-center justify-center p-8 shadow-2xl ring-4 ring-white/20 transition-transform hover:scale-105 duration-500">
            <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F Desarrollos Campestres" className="w-full drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-bold text-rf-green-800">R&F Desarrollos Campestres</h1>
          <p className="text-rf-gray mt-1">CRM de Ventas</p>
        </div>

        {/* Login card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-gray-100 animate-scale-in">
          <h2 className="text-xl font-semibold text-rf-dark mb-6 text-center">
            {requires2FA ? 'Verificación en dos pasos' : 'Iniciar sesión'}
          </h2>

          {error && (
            <div className="bg-red-50/80 backdrop-blur-sm text-red-600 px-4 py-3 rounded-xl text-sm mb-4 border border-red-200 animate-slide-down">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/50 focus:border-rf-green-500 transition-all placeholder:text-gray-300 shadow-sm"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
                <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-10 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/50 focus:border-rf-green-500 transition-all placeholder:text-gray-300 shadow-sm"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light hover:text-rf-gray transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="animate-scale-in">
                <label className="block text-sm font-medium text-rf-gray mb-1.5">Código de verificación</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/50 focus:border-rf-green-500 transition-all text-center text-lg tracking-[0.5em] placeholder:text-gray-300 shadow-sm"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-rf-gray-light mt-2 text-center">
                  Ingresa el código de 6 dígitos de tu app de autenticación
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-rf-green-800 to-rf-green-700 text-white py-3 rounded-xl font-medium hover:from-rf-green-700 hover:to-rf-green-600 transition-all duration-300 disabled:opacity-50 mt-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : requires2FA ? 'Verificar' : 'Ingresar'}
            </button>
          </form>

          {requires2FA && (
            <button onClick={() => setRequires2FA(false)} className="block mx-auto mt-4 text-sm text-rf-gold hover:text-rf-gold-dark transition-colors">
              ← Volver al inicio de sesión
            </button>
          )}
        </div>

        <p className="text-center text-xs text-rf-gray-light mt-8 animate-fade-in">
          &copy; 2026 R&F Desarrollos Campestres. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Home, Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-screen bg-rf-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-rf-green-800 flex items-center justify-center p-4 shadow-lg">
            <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F Desarrollos Campestres" className="w-full" />
          </div>
          <h1 className="text-2xl font-bold text-rf-green-800">R&F Desarrollos Campestres</h1>
          <p className="text-rf-gray mt-1">CRM de Ventas</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-rf-cream-dark">
          <h2 className="text-xl font-semibold text-rf-dark mb-6 text-center">
            {requires2FA ? 'Verificación en dos pasos' : 'Iniciar sesión'}
          </h2>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500 focus:border-transparent transition"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-rf-gray mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500 focus:border-transparent transition"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-rf-gray-light hover:text-rf-gray"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-rf-gray mb-1">Código de verificación</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full px-4 py-2.5 border border-rf-cream-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-rf-green-500 focus:border-transparent transition text-center text-lg tracking-widest"
                  placeholder="000 000"
                  maxLength={6}
                  required
                />
                <p className="text-xs text-rf-gray-light mt-1 text-center">
                  Ingresa el código de 6 dígitos de tu app de autenticación
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-rf-green-800 text-white py-2.5 rounded-lg font-medium hover:bg-rf-green-700 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Ingresando...' : requires2FA ? 'Verificar' : 'Ingresar'}
            </button>
          </form>

          {requires2FA && (
            <button
              onClick={() => setRequires2FA(false)}
              className="block mx-auto mt-4 text-sm text-rf-gold hover:text-rf-gold-dark transition"
            >
              ← Volver al inicio de sesión
            </button>
          )}
        </div>

        <p className="text-center text-xs text-rf-gray-light mt-6">
          &copy; 2026 R&F Desarrollos Campestres. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

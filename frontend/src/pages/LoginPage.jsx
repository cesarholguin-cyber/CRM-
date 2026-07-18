import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

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
    <div className="relative min-h-screen bg-premium-dark overflow-hidden flex items-center justify-center p-4">
      {/* Animated background orbs */}
      <div className="bg-orb w-[500px] h-[500px] bg-rf-gold/10 -top-48 -right-48 animate-drift" />
      <div className="bg-orb w-[400px] h-[400px] bg-rf-green-400/10 -bottom-32 -left-32 animate-drift" style={{ animationDelay: '-3s' }} />
      <div className="bg-orb w-[300px] h-[300px] bg-rf-gold-light/8 top-1/3 left-1/2 animate-drift" style={{ animationDelay: '-1.5s' }} />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="relative w-full max-w-md">
        {/* Logo section */}
        <div className={`text-center mb-10 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative w-48 h-48 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rf-gold/30 via-rf-gold-light/20 to-transparent animate-spin-slow" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-rf-gold/20 via-transparent to-rf-green-400/20 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '12s' }} />
            <div className="absolute inset-4 rounded-full bg-premium-dark flex items-center justify-center p-6 ring-1 ring-white/10 shadow-2xl">
              <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full drop-shadow-xl brightness-0 invert" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">R&F Desarrollos Campestres</h1>
          <p className="text-white/40 mt-2 text-sm tracking-wide">CRM de Ventas</p>
        </div>

        {/* Login card */}
        <div className={`glass-card rounded-3xl p-8 shadow-2xl transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-800 to-rf-green-700 flex items-center justify-center shadow-lg">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-rf-dark">
                {requires2FA ? 'Verificación en dos pasos' : 'Acceso seguro'}
              </h2>
              <p className="text-xs text-rf-gray-light mt-0.5">
                {requires2FA ? 'Ingresa el código de tu app de autenticación' : 'Ingresa tus credenciales para continuar'}
              </p>
            </div>
          </div>

          {error && (
            <div className="relative overflow-hidden bg-red-50/80 backdrop-blur-sm text-red-600 px-4 py-3 rounded-xl text-sm mb-5 border border-red-200/50 animate-slide-down">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent" />
              <span className="relative">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!requires2FA ? (
              <>
                <div className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/40 focus:border-rf-green-500 transition-all placeholder:text-gray-300 shadow-sm hover:shadow-md hover:border-gray-300"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                </div>
                <div className={`transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                  <label className="block text-sm font-medium text-rf-gray mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-11 bg-white/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/40 focus:border-rf-green-500 transition-all placeholder:text-gray-300 shadow-sm hover:shadow-md hover:border-gray-300"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rf-gray-light hover:text-rf-gray transition-colors"
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
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rf-green-500/40 focus:border-rf-green-500 transition-all text-center text-lg tracking-[0.5em] placeholder:text-gray-300 shadow-sm hover:shadow-md"
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
              className={`relative overflow-hidden group w-full py-3.5 rounded-xl font-medium text-white transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl active:scale-[0.98] bg-gradient-to-r from-rf-green-800 via-rf-green-700 to-rf-green-800 hover:from-rf-green-700 hover:via-rf-green-600 hover:to-rf-green-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: '500ms' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {requires2FA ? 'Verificar' : 'Ingresar'}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>

          {requires2FA && (
            <button onClick={() => setRequires2FA(false)} className="block mx-auto mt-5 text-sm text-rf-gold hover:text-rf-gold-dark transition-colors group">
              <span className="flex items-center gap-1">
                <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                Volver al inicio de sesión
              </span>
            </button>
          )}
        </div>

        <p className={`text-center text-xs text-white/20 mt-8 transition-all duration-1000 delay-600 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          &copy; 2026 R&F Desarrollos Campestres. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

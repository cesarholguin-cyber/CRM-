import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';
import portada from '../assets/portada.png';

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
    <div className="relative min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="relative w-full lg:w-1/2 flex flex-col items-center justify-center bg-gradient-to-br from-rf-green-900 via-rf-green-800 to-rf-green-900 p-6 sm:p-8 lg:p-12 overflow-hidden">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />

        {/* Animated background orbs */}
        <div className="absolute w-[400px] h-[400px] bg-rf-gold/8 -top-32 -right-32 rounded-full blur-3xl animate-drift" />
        <div className="absolute w-[300px] h-[300px] bg-rf-green-400/10 -bottom-24 -left-24 rounded-full blur-3xl animate-drift" style={{ animationDelay: '-3s' }} />

        {/* Login content */}
        <div className={`relative z-10 w-full max-w-md transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rf-gold/30 via-rf-gold-light/20 to-transparent animate-spin-slow" />
              <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-rf-gold/20 via-transparent to-rf-green-400/20 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '12s' }} />
              <div className="absolute inset-3 rounded-full bg-rf-green-900 flex items-center justify-center p-4 ring-1 ring-white/10 shadow-2xl">
                <img src="https://rfdesarrolloscampestres.com/wp-content/uploads/2021/08/Logo-RF-Blanco-1.png" alt="R&F" className="w-full drop-shadow-xl brightness-0 invert" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">R&F Desarrollos Campestres</h1>
            <p className="text-white/40 mt-1.5 text-sm tracking-wide">CRM de Ventas</p>
          </div>

          {/* Login card */}
          <div className={`bg-white/[0.07] backdrop-blur-xl rounded-2xl p-7 sm:p-8 shadow-2xl border border-white/[0.08] transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rf-green-700 to-rf-green-600 flex items-center justify-center shadow-lg shadow-rf-green-900/30">
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  {requires2FA ? 'Verificación en dos pasos' : 'Iniciar sesión'}
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  {requires2FA ? 'Ingresa el código de tu app de autenticación' : 'Ingresa tus credenciales para continuar'}
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="relative overflow-hidden bg-red-500/10 backdrop-blur-sm text-red-300 px-4 py-3 rounded-xl text-sm mb-5 border border-red-500/20 animate-slide-down">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent" />
                <span className="relative">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!requires2FA ? (
                <>
                  <div className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Correo electrónico</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-rf-gold/40 focus:border-rf-gold/50 transition-all hover:bg-white/[0.08] hover:border-white/[0.15]"
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>
                  <div className={`transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-11 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-rf-gold/40 focus:border-rf-gold/50 transition-all hover:bg-white/[0.08] hover:border-white/[0.15]"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="animate-scale-in">
                  <label className="block text-sm font-medium text-white/60 mb-1.5">Código de verificación</label>
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-4 py-3 bg-white/[0.06] border border-white/[0.1] rounded-xl text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-rf-gold/40 focus:border-rf-gold/50 transition-all text-center text-lg tracking-[0.5em] hover:bg-white/[0.08] hover:border-white/[0.15]"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-white/30 mt-2.5 text-center">
                    Ingresa el código de 6 dígitos de tu app de autenticación
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`relative overflow-hidden group w-full py-3 rounded-xl font-medium text-white transition-all duration-300 disabled:opacity-50 shadow-lg shadow-rf-green-900/40 hover:shadow-xl hover:shadow-rf-green-900/50 active:scale-[0.98] bg-gradient-to-r from-rf-gold-dark via-rf-gold to-rf-gold-dark hover:from-rf-gold hover:via-rf-gold-light hover:to-rf-gold ${mounted ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: '500ms' }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
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

            {/* 2FA back button */}
            {requires2FA && (
              <button onClick={() => setRequires2FA(false)} className="block mx-auto mt-4 text-sm text-rf-gold-light/70 hover:text-rf-gold-light transition-colors group">
                <span className="flex items-center gap-1">
                  <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                  Volver al inicio de sesión
                </span>
              </button>
            )}
          </div>

          {/* Footer */}
          <p className={`text-center text-xs text-white/15 mt-8 transition-all duration-1000 delay-600 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            &copy; 2026 R&F Desarrollos Campestres. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Right side - Cover Image */}
      <div className="hidden lg:block relative w-1/2">
        {/* Image */}
        <img
          src={portada}
          alt="Portada"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Green overlay - gradient covering ~25% from bottom-left, blurred and subtle */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(
                135deg,
                rgba(15, 43, 29, 0.75) 0%,
                rgba(26, 60, 42, 0.55) 15%,
                rgba(45, 90, 62, 0.3) 30%,
                rgba(74, 124, 89, 0.08) 45%,
                transparent 60%
              )
            `,
          }}
        />

        {/* Soft blur layer for extra smoothness */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 0% 100%, rgba(15, 43, 29, 0.5) 0%, rgba(26, 60, 42, 0.2) 35%, transparent 65%)`,
            backdropFilter: 'blur(1px)',
          }}
        />

        {/* Branding text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-10">
          <div className="bg-white/[0.08] backdrop-blur-md rounded-xl p-6 border border-white/[0.1]">
            <h3 className="text-xl font-bold text-white mb-2">Gestiona tus proyectos</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              Administra ventas, clientes y apartados desde una sola plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

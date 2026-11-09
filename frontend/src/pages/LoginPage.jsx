import React, { useState } from 'react';
import { ZunoLogo } from '../components/ZunoLogo';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, ShieldCheck, Waves } from 'lucide-react';

export function LoginPage({ onNavigateToRegister }) {
  const { login, isLoading, authError, setAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formErrors, setFormErrors] = useState({});

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await login(email.trim(), password);
    } catch (_) {
      // Handled in AuthContext
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#050814] relative overflow-hidden select-none">
      {/* Background Cyber-Aquatic Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#00F2FE_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03]" />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-navy-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <ZunoLogo size="xl" showTagline={true} showVersion={true} className="mb-2" />
            <h2 className="text-lg font-bold text-white mt-4 tracking-wide">
              Hatchery Command Center
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Sign in with your aquaculture operator credentials to access real-time 3D telemetry and physical controls.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-6 p-3.5 rounded-xl bg-status-critical/15 border border-status-critical/40 text-status-critical text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-email">
                Operator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors({ ...formErrors, email: null });
                  }}
                  placeholder="operator@zunotwin.ai"
                  className={`w-full pl-10 pr-4 py-2.5 bg-navy-950/90 rounded-xl border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-neon/40 transition-all ${
                    formErrors.email ? 'border-status-critical' : 'border-navy-700 focus:border-cyan-neon'
                  }`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-status-critical mt-1 font-medium">{formErrors.email}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300" htmlFor="login-password">
                  Security Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formErrors.password) setFormErrors({ ...formErrors, password: null });
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 bg-navy-950/90 rounded-xl border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-neon/40 transition-all ${
                    formErrors.password ? 'border-status-critical' : 'border-navy-700 focus:border-cyan-neon'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[11px] text-status-critical mt-1 font-medium">{formErrors.password}</p>
              )}
            </div>

            {/* Remember Me & Note */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-navy-900 border-navy-700 text-cyan-neon focus:ring-cyan-neon/30 focus:ring-offset-0"
                />
                <span>Remember session</span>
              </label>

              <span className="text-[11px] text-slate-400 font-mono">JWT Bearer 24h</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-neon via-[#00D2FF] to-aquablue text-navy-950 hover:shadow-neon-cyan active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Operator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Tip */}
          <div className="mt-6 p-3 rounded-xl bg-navy-900/60 border border-navy-800 text-[11px] text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-neon shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-300 font-semibold">Standard Operator Access:</span>
              <p className="font-mono text-cyan-neon/90 mt-0.5">operator@zunotwin.ai / Password@123</p>
            </div>
          </div>

          {/* Switch to Registration */}
          <div className="mt-6 text-center text-xs text-slate-400">
            <span>New technician or operator station? </span>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-cyan-neon hover:underline font-semibold transition-colors focus:outline-none"
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Security Footer Notice */}
        <p className="text-[11px] text-center text-slate-400 mt-6 font-mono">
          ZUNO TWIN Encrypted Cyber-Physical Telemetry Platform • v2.0
        </p>
      </div>
    </div>
  );
}

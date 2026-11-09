import React, { useState } from 'react';
import { ZunoLogo } from '../components/ZunoLogo';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Shield } from 'lucide-react';

export function RegisterPage({ onNavigateToLogin }) {
  const { register, isLoading, authError, setAuthError } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Compute password strength metrics
  const getPasswordStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { label: 'Weak', color: 'bg-status-critical', width: '25%' };
    if (score <= 3) return { label: 'Fair', color: 'bg-status-warning', width: '50%' };
    if (score === 4) return { label: 'Good', color: 'bg-cyan-neon', width: '75%' };
    return { label: 'Strong', color: 'bg-status-normal', width: '100%' };
  };

  const strength = getPasswordStrength(password);

  const validate = () => {
    const errors = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await register(fullName.trim(), email.trim(), password, confirmPassword);
    } catch (_) {
      // Handled in AuthContext
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#050814] relative overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[130px] animate-pulse-slow" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#00F2FE_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-navy-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <ZunoLogo size="lg" showTagline={false} showVersion={true} className="mb-2" />
            <h2 className="text-lg font-bold text-white mt-3 tracking-wide">
              Operator Station Onboarding
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Register a licensed hatchery account for hardware telemetry synchronization.
            </p>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-status-critical/15 border border-status-critical/40 text-status-critical text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="reg-fullname">
                Operator Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="reg-fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formErrors.fullName) setFormErrors({ ...formErrors, fullName: null });
                  }}
                  placeholder="Dr. Alex Rivera"
                  className={`w-full pl-10 pr-4 py-2.5 bg-navy-950/90 rounded-xl border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-neon/40 transition-all ${
                    formErrors.fullName ? 'border-status-critical' : 'border-navy-700 focus:border-cyan-neon'
                  }`}
                />
              </div>
              {formErrors.fullName && (
                <p className="text-[11px] text-status-critical mt-1 font-medium">{formErrors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="reg-email">
                Institutional Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (formErrors.email) setFormErrors({ ...formErrors, email: null });
                  }}
                  placeholder="alex.rivera@hatchery.org"
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
              <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="reg-password">
                Password (Min 8 Characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-400">Strength:</span>
                    <span className="text-white font-semibold">{strength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-navy-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                </div>
              )}

              {formErrors.password && (
                <p className="text-[11px] text-status-critical mt-1 font-medium">{formErrors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="reg-confirm">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (formErrors.confirmPassword) setFormErrors({ ...formErrors, confirmPassword: null });
                  }}
                  placeholder="••••••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 bg-navy-950/90 rounded-xl border text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-neon/40 transition-all ${
                    formErrors.confirmPassword ? 'border-status-critical' : 'border-navy-700 focus:border-cyan-neon'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formErrors.confirmPassword && (
                <p className="text-[11px] text-status-critical mt-1 font-medium">{formErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-neon via-[#00D2FF] to-aquablue text-navy-950 hover:shadow-neon-cyan active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                  <span>Registering Station...</span>
                </>
              ) : (
                <>
                  <span>Create Operator Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <span>Already have credentials?</span>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-cyan-neon hover:underline font-semibold transition-colors focus:outline-none inline-flex items-center gap-1"
            >
              <span>Sign In</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-400 mt-6 font-mono">
          Complies with Aquaculture Cyber-Physical Data Standards
        </p>
      </div>
    </div>
  );
}

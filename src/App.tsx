import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from './lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

type ModalType = 'privacy' | 'terms' | 'security' | 'about' | 'contacts' | 'support' | 'help' | 'forgot' | null;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Restore current active session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
      setIsLoggingIn(false);
      setIsSubmittingEmail(false);
    });

    // 3. Inspect URL for legal modals and OAuth error hash fragments
    const checkHashAndPath = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      if (hash === '#privacy' || path === '/privacy') {
        setModalType('privacy');
      } else if (hash === '#terms' || path === '/terms') {
        setModalType('terms');
      } else if (hash === '#security') {
        setModalType('security');
      } else if (hash === '#about') {
        setModalType('about');
      } else if (hash === '#contacts') {
        setModalType('contacts');
      } else if (hash === '#support' || hash === '#help' || hash === '#signin') {
        setModalType('help');
      }

      if (hash && hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const errorDescription = params.get('error_description') || params.get('error');
        if (errorDescription) {
          setError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        }
      }
    };

    checkHashAndPath();
    window.addEventListener('hashchange', checkHashAndPath);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', checkHashAndPath);
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setError(null);
      setInfoMessage(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setError(error.message);
        setIsLoggingIn(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during sign-in.');
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email/username and password.');
      return;
    }

    try {
      setIsSubmittingEmail(true);
      setError(null);
      setInfoMessage(null);

      // Attempt sign in with password
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        // If login failed, check if user should sign up or check credentials
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid credentials. If this is your first time, please use Single-Click Google Sign In.');
        } else {
          setError(signInError.message);
        }
        setIsSubmittingEmail(false);
        return;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during email login.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const closeModal = () => {
    setModalType(null);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Initial loader matching 16-bit retro aesthetic
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#080511] text-slate-200 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="font-pixel text-2xl md:text-3xl font-bold tracking-wider text-white uppercase">
            Coral_AI
          </div>
          <div className="text-xs tracking-[0.3em] uppercase text-purple-400 font-mono" style={{ fontFamily: 'Silkscreen, monospace' }}>
            BY CORAL_CLOUD
          </div>
          <p className="font-mono text-xs text-purple-400/80 tracking-widest uppercase animate-pulse mt-4">
            INITIALIZING WORKSPACE...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#080511] text-slate-100 min-h-screen flex flex-col justify-between font-sans selection:bg-purple-600 selection:text-white relative overflow-x-hidden antialiased">
      {/* Animated Dynamic Background Layer with Coral_AI Pattern */}
      <div className="fixed inset-0 pointer-events-none -z-20 overflow-hidden bg-[#080511]">
        <div className="animated-coral-bg absolute inset-0 w-full h-full opacity-35 mix-blend-screen scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080511]/85 via-[#080511]/60 to-[#080511]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#080511_85%)]" />
      </div>

      {/* Ambient Glow Lighting */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[650px] h-[650px] bg-purple-900/30 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-1/4 w-[750px] h-[750px] bg-fuchsia-950/40 rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-indigo-950/30 rounded-full blur-[150px]" />
      </div>

      {/* Modern Retro Header */}
      <header className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between z-30" data-purpose="modern-header">
        <a className="flex items-center space-x-3 group" href="#">
          <span className="text-lg font-pixel tracking-wider text-white group-hover:text-purple-300 transition-colors uppercase">
            Coral_AI
          </span>
        </a>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
          <a
            className="hover:text-white transition-colors duration-200"
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              setModalType('about');
            }}
          >
            About
          </a>
          <a className="hover:text-white transition-colors duration-200" href="#">
            Home
          </a>
          <a
            className="hover:text-white transition-colors duration-200"
            href="#contacts"
            onClick={(e) => {
              e.preventDefault();
              setModalType('contacts');
            }}
          >
            Contacts
          </a>
          <a
            className="hover:text-white transition-colors duration-200"
            href="#support"
            onClick={(e) => {
              e.preventDefault();
              setModalType('support');
            }}
          >
            Support
          </a>
        </nav>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/20 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] tracking-wider uppercase text-purple-300/80">
              CLOUDFLARE PAGES LIVE
            </span>
          </div>

          <a
            className="text-sm font-medium text-purple-300 hover:text-white transition-colors hidden sm:inline-block"
            href="#help"
            onClick={(e) => {
              e.preventDefault();
              setModalType('help');
            }}
          >
            Help Center
          </a>

          {user && (
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="px-3.5 py-1.5 rounded-full bg-purple-950/60 hover:bg-purple-900/80 border border-purple-400/30 text-xs font-mono tracking-wider uppercase text-purple-200 hover:text-white transition-all duration-200"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-grow flex items-center justify-center px-6 lg:px-12 py-4 max-w-7xl mx-auto w-full relative z-20">
        <div className="flex items-center justify-center w-full">
          {!user ? (
            /* Unauthenticated State: Retro Login Terminal Card */
            <section className="flex flex-col justify-center w-full mx-auto" data-purpose="auth-terminal" style={{ maxWidth: '530px' }}>
              <div className="glass-card rounded-3xl p-8 md:p-10 shadow-glass relative overflow-hidden" style={{ padding: '2.75rem 2.5rem' }}>
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
                
                <div className="mb-7">
                  <h1 className="text-xl md:text-2xl font-pixel text-white tracking-wider uppercase leading-snug">
                    Sign up account
                  </h1>
                  <p className="text-xs text-purple-300/80 mt-3 font-mono leading-relaxed tracking-wider uppercase" style={{ fontFamily: 'Silkscreen, "Press Start 2P", monospace' }}>
                    Enter your personal data to continue your account session
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed text-center font-mono">
                    {error}
                  </div>
                )}

                {/* Info Banner */}
                {infoMessage && (
                  <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed text-center font-mono">
                    {infoMessage}
                  </div>
                )}

                {/* 16-Bit Retro Google Auth Button */}
                <div className="mb-7" data-purpose="retro-google-anchor">
                  <div className="relative group">
                    <div className="retro-aura absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 rounded-sm pointer-events-none opacity-40" />
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingIn}
                      className="retro-google-btn relative w-full border-4 border-white p-3.5 flex items-center justify-center space-x-3 cursor-pointer overflow-hidden select-none disabled:opacity-75"
                      style={{ padding: '1rem 1.25rem' }}
                    >
                      <div className="pixel-shimmer-beam absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none" />
                      <svg className="w-6 h-6 shrink-0 relative z-10" fill="none" style={{ imageRendering: 'pixelated' }} viewBox="0 0 24 24">
                        <rect fill="#EA4335" height="3" width="14" x="5" y="4" />
                        <rect fill="#EA4335" height="10" width="3" x="3" y="6" />
                        <rect fill="#FBBC05" height="6" width="3" x="3" y="12" />
                        <rect fill="#34A853" height="3" width="14" x="5" y="17" />
                        <rect fill="#34A853" height="3" width="4" x="15" y="15" />
                        <rect fill="#4285F4" height="3" width="10" x="10" y="11" />
                        <rect fill="#4285F4" height="7" width="3" x="17" y="11" />
                      </svg>
                      <span className="text-black font-pixel text-xs tracking-wider font-bold relative z-10">
                        {isLoggingIn ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="relative flex items-center justify-center mb-6">
                  <div className="border-t border-purple-500/20 w-full" />
                  <span className="bg-[#120824] px-4 text-xs font-inter text-slate-400 uppercase tracking-widest absolute">
                    or email
                  </span>
                </div>

                {/* Form Fields */}
                <form className="space-y-4" data-purpose="credential-form" onSubmit={handleEmailLogin}>
                  <div>
                    <label
                      className="block text-xs font-mono text-purple-300 mb-1.5 ml-1 uppercase tracking-wider"
                      htmlFor="email-input"
                      style={{ fontFamily: 'Silkscreen, monospace' }}
                    >
                      Email or Username
                    </label>
                    <div className="relative">
                      <input
                        id="email-input"
                        type="text"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email or username"
                        className="w-full bg-purple-950/30 border border-purple-500/25 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono tracking-wider"
                        style={{ fontFamily: 'VT323, monospace', fontSize: '18px', paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
                      />
                      <span className="material-symbols-outlined absolute right-3.5 top-3 text-slate-400 text-lg pointer-events-none select-none" style={{ top: '14px' }}>
                        mail
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5 ml-1">
                      <label
                        className="text-xs font-mono text-purple-300 uppercase tracking-wider"
                        htmlFor="password-input"
                        style={{ fontFamily: 'Silkscreen, monospace' }}
                      >
                        Password
                      </label>
                      <a
                        href="#forgot"
                        onClick={(e) => {
                          e.preventDefault();
                          setModalType('forgot');
                        }}
                        className="text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-wider"
                        style={{ fontFamily: 'Silkscreen, monospace', fontSize: '10px' }}
                      >
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <input
                        id="password-input"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-purple-950/30 border border-purple-500/25 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono tracking-widest"
                        style={{ fontFamily: 'VT323, monospace', fontSize: '19px', paddingTop: '0.9rem', paddingBottom: '0.9rem' }}
                      />
                      <span className="material-symbols-outlined absolute right-3.5 top-3 text-slate-400 text-lg pointer-events-none select-none" style={{ top: '14px' }}>
                        lock
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded-md bg-purple-950/50 border-purple-500/40 text-purple-600 focus:ring-purple-500/30 focus:ring-offset-0 focus:ring-1 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300 font-mono tracking-wider uppercase" style={{ fontFamily: 'Silkscreen, monospace', fontSize: '10px' }}>
                        Remember this device
                      </span>
                    </label>
                    <span className="text-xs text-purple-400 font-mono tracking-widest uppercase" style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px' }}>
                      SSL Secure
                    </span>
                  </div>

                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={isSubmittingEmail}
                      className="btn-pixel-submit group w-full bg-white hover:bg-slate-50 text-slate-900 font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-white/10 hover:shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                      style={{ paddingTop: '1rem', paddingBottom: '1rem' }}
                    >
                      <span className="font-pixel text-xs tracking-wider inline-flex items-center leading-none">
                        {isSubmittingEmail ? 'Signing In...' : 'Sign In'}
                      </span>
                      <span className="material-symbols-outlined pixel-arrow text-base font-bold leading-none inline-flex items-center select-none">
                        arrow_forward
                      </span>
                    </button>

                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-400 font-inter">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          className="text-purple-300 hover:text-white font-medium ml-1 underline decoration-purple-500/50 underline-offset-4 cursor-pointer"
                        >
                          Log in
                        </button>
                      </p>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          ) : (
            /* Authenticated State: Retro AI Studio Canvas */
            <section className="flex flex-col justify-center w-full mx-auto" style={{ maxWidth: '530px' }}>
              <div className="glass-card rounded-3xl p-8 md:p-10 shadow-glass relative overflow-hidden space-y-6">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />
                
                <div className="flex items-center justify-between pb-5 border-b border-purple-500/20">
                  <div className="space-y-1">
                    <span className="text-[10px] tracking-[0.25em] uppercase text-purple-400 font-mono" style={{ fontFamily: 'Silkscreen, monospace' }}>
                      ACTIVE SESSION
                    </span>
                    <h2 className="text-lg md:text-xl font-pixel text-white uppercase tracking-wider">
                      Coral_AI Studio
                    </h2>
                  </div>
                  <span className="text-[9px] font-pixel tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                    VERIFIED
                  </span>
                </div>

                {/* User Identity Box */}
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata.full_name || 'User Avatar'}
                      className="w-14 h-14 rounded-2xl object-cover border border-purple-400/30"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-indigo-600 flex items-center justify-center text-white font-pixel font-bold text-xl border border-purple-400/30">
                      {user.email?.[0]?.toUpperCase() || 'C'}
                    </div>
                  )}
                  
                  <div className="space-y-1 overflow-hidden">
                    <div className="font-pixel text-xs text-white truncate">
                      {user.user_metadata?.full_name || 'Authenticated User'}
                    </div>
                    <div className="font-mono text-xs text-purple-300/80 tracking-wide truncate">
                      {user.email}
                    </div>
                  </div>
                </div>

                {/* System Specs Matrix */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1">
                    <div className="text-[9px] tracking-wider uppercase text-purple-400/70" style={{ fontFamily: 'Silkscreen, monospace' }}>
                      AUTH
                    </div>
                    <div className="font-mono text-purple-200 text-xs truncate">
                      {user.app_metadata?.provider ? String(user.app_metadata.provider).toUpperCase() : 'GOOGLE'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1">
                    <div className="text-[9px] tracking-wider uppercase text-purple-400/70" style={{ fontFamily: 'Silkscreen, monospace' }}>
                      HOST
                    </div>
                    <div className="font-mono text-purple-200 text-xs truncate">
                      Cloudflare
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1">
                    <div className="text-[9px] tracking-wider uppercase text-purple-400/70" style={{ fontFamily: 'Silkscreen, monospace' }}>
                      STATE
                    </div>
                    <div className="font-mono text-emerald-400 text-xs truncate">
                      {session ? 'Active' : 'Connected'}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setInfoMessage('Welcome to Coral_AI Studio. Workspace features are active.');
                    }}
                    className="btn-pixel-submit flex-1 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-pixel text-xs font-semibold shadow-lg shadow-white/10 hover:shadow-purple-500/20 transition-all text-center flex items-center justify-center gap-2"
                  >
                    <span>Enter Workspace</span>
                    <span className="material-symbols-outlined pixel-arrow text-sm font-bold">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="py-3 px-5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-75"
                    style={{ fontFamily: 'Silkscreen, monospace' }}
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Modern Retro Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 lg:px-12 py-6 border-t border-purple-500/10 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4 z-20" data-purpose="modern-footer">
        <div className="flex items-center space-x-2 text-slate-400 font-mono text-xs" style={{ fontFamily: 'Silkscreen, monospace' }}>
          <span className="text-purple-300 font-pixel text-[10px]">CORAL_AI</span>
          <span>•</span>
          <span>BY CORAL_CLOUD</span>
        </div>

        <div className="flex items-center space-x-6 text-slate-400">
          <button
            onClick={() => setModalType('privacy')}
            className="hover:text-purple-300 transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setModalType('terms')}
            className="hover:text-purple-300 transition-colors cursor-pointer"
          >
            Terms of Service
          </button>
          <button
            onClick={() => setModalType('security')}
            className="hover:text-purple-300 transition-colors cursor-pointer"
          >
            Security
          </button>
          <a
            href="https://github.com/Nikhil2024me/Coral_AI"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-purple-300 transition-colors font-mono text-xs uppercase tracking-wider"
          >
            GitHub
          </a>
        </div>
      </footer>

      {/* Modal Dialogs */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="glass-card relative w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between pb-4 border-b border-purple-500/20">
              <div>
                <span className="text-[10px] tracking-[0.25em] uppercase text-purple-400 font-mono" style={{ fontFamily: 'Silkscreen, monospace' }}>
                  {modalType === 'privacy'
                    ? 'LEGAL & PRIVACY'
                    : modalType === 'terms'
                    ? 'TERMS OF SERVICE'
                    : modalType === 'security'
                    ? 'SECURITY ARCHITECTURE'
                    : modalType === 'about'
                    ? 'ABOUT CORAL_AI'
                    : modalType === 'contacts'
                    ? 'CONTACTS & NETWORK'
                    : modalType === 'forgot'
                    ? 'PASSWORD RECOVERY'
                    : 'HELP CENTER'}
                </span>
                <h3 className="font-pixel text-lg md:text-xl font-bold text-white mt-1">
                  {modalType === 'privacy' && 'Privacy Policy'}
                  {modalType === 'terms' && 'Terms of Service'}
                  {modalType === 'security' && 'Security & Data Protection'}
                  {modalType === 'about' && 'About Coral_AI'}
                  {modalType === 'contacts' && 'Contact Support'}
                  {modalType === 'forgot' && 'Reset Password'}
                  {modalType === 'help' && 'Coral_AI Help Center'}
                  {modalType === 'support' && 'Developer Support'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="px-3 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/70 border border-purple-400/30 text-xs font-mono tracking-wider uppercase text-purple-200 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-4 font-sans">
              {modalType === 'privacy' && (
                <>
                  <p>
                    <strong className="text-white font-pixel text-[10px]">Effective Date:</strong> October 2026
                  </p>
                  <p>
                    Coral_AI by Coral_Cloud respects user privacy and enforces minimal data collection boundaries.
                  </p>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">1. Information We Receive</p>
                    <p>
                      When signing in with Google OAuth, we only receive your public profile identifier, verified email address, and avatar image. We do not access contacts, emails, or personal drive files.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">2. Purpose of Processing</p>
                    <p>
                      Your account details are used exclusively to create and authenticate your active session inside Coral_AI. We never sell, lease, or monetize user data.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">3. Security & Storage</p>
                    <p>
                      Identity tokens and access privileges are managed via Supabase encrypted session storage. You can revoke access or sign out at any time.
                    </p>
                  </div>
                </>
              )}

              {modalType === 'terms' && (
                <>
                  <p>
                    <strong className="text-white font-pixel text-[10px]">Effective Date:</strong> October 2026
                  </p>
                  <p>
                    By accessing or using Coral_AI by Coral_Cloud, you agree to the following terms:
                  </p>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">1. Prototype & AI Studio Usage</p>
                    <p>
                      Coral_AI is provided on an &quot;as-is&quot; basis for intelligent exploration, experimentation, and productivity. No warranties of constant availability are implied.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">2. Acceptable Conduct</p>
                    <p>
                      Users agree to use Coral_AI lawfully and avoid any attempts to circumvent security mechanisms, conduct denial-of-service attempts, or reverse-engineer backend APIs.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">3. Limitation of Liability</p>
                    <p>
                      Coral_Cloud and its maintainers assume no liability for indirect, incidental, or consequential damages resulting from the use of this service.
                    </p>
                  </div>
                </>
              )}

              {modalType === 'security' && (
                <>
                  <p>
                    Coral_AI is engineered with modern cybersecurity best practices:
                  </p>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">TLS / SSL 256-bit Encryption</p>
                    <p>All network traffic is encrypted in transit using industry-standard HTTPS and Cloudflare global edge protection.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">OAuth 2.0 PKCE Protection</p>
                    <p>Google authentication runs with cryptographic PKCE verification to safeguard against authorization code interception.</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">Stateless Token Security</p>
                    <p>Session tokens are signed with JWT and verified against Supabase Auth policies without storing plain-text secrets.</p>
                  </div>
                </>
              )}

              {modalType === 'about' && (
                <>
                  <p>
                    <strong>Coral_AI</strong> is an intelligent cognitive assistant and creative AI studio designed and powered by <strong>Coral_Cloud</strong>.
                  </p>
                  <p>
                    Hosted on Cloudflare Pages global high-speed edge network with Supabase authentication and real-time backend infrastructure.
                  </p>
                </>
              )}

              {modalType === 'contacts' && (
                <>
                  <p>Need support or have questions regarding Coral_AI?</p>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">GitHub Repository</p>
                    <p>
                      <a href="https://github.com/Nikhil2024me/Coral_AI" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline">
                        github.com/Nikhil2024me/Coral_AI
                      </a>
                    </p>
                  </div>
                </>
              )}

              {modalType === 'forgot' && (
                <>
                  <p>To reset your password, please sign in with your connected Google account, or reach out to the project administrator.</p>
                  <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                    <p className="font-semibold text-purple-300 font-pixel text-[10px]">Recommended Login</p>
                    <p>Use the &quot;SIGN IN WITH GOOGLE&quot; option for instant, passwordless access.</p>
                  </div>
                </>
              )}

              {(modalType === 'help' || modalType === 'support') && (
                <>
                  <p>
                    Welcome to the <strong>Coral_AI Help Center</strong>.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li>Use <strong>Sign in with Google</strong> for instant access.</li>
                    <li>Ensure cookies and popups are allowed for OAuth authentication.</li>
                    <li>If encountering authentication delays, verify your internet connection or reload the page.</li>
                  </ul>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-purple-500/20 flex justify-end">
              <button
                onClick={closeModal}
                className="btn-pixel-submit px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-pixel text-xs font-semibold transition-all cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

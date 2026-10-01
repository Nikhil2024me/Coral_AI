import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'privacy' | 'terms' | null>(null);

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
    });

    // 3. Inspect URL for legal modals and OAuth error hash fragments
    const checkHashAndPath = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      if (hash === '#privacy' || path === '/privacy') {
        setModalType('privacy');
      } else if (hash === '#terms' || path === '/terms') {
        setModalType('terms');
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

  // Initial loader
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#07090e] text-slate-200 flex flex-col items-center justify-center font-sans">
        <div className="text-center space-y-3">
          <div className="font-display text-3xl font-bold tracking-tight text-white">
            Coral_AI
          </div>
          <div className="font-sub text-xs tracking-[0.3em] uppercase text-rose-400">
            BY CORAL_CLOUD
          </div>
          <p className="font-sub text-[11px] text-slate-500 tracking-wider uppercase mt-4 animate-pulse">
            INITIALIZING WORKSPACE
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-rose-500/30 selection:text-rose-200 font-sans">
      {/* Dynamic Ambient Aurora Glow Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Aurora Orb 1: Vibrant Coral */}
        <div className="absolute -top-32 -left-32 w-[340px] h-[340px] sm:w-[560px] sm:h-[560px] rounded-full bg-gradient-to-tr from-rose-600/30 via-rose-500/20 to-orange-500/15 blur-[120px] animate-aurora-1" />
        
        {/* Aurora Orb 2: Warm Amber & Sunset */}
        <div className="absolute -bottom-40 -right-24 w-[340px] h-[340px] sm:w-[580px] sm:h-[580px] rounded-full bg-gradient-to-br from-amber-600/20 via-rose-600/25 to-indigo-900/20 blur-[130px] animate-aurora-2" />
        
        {/* Aurora Orb 3: Central Ambient Light Breath */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] rounded-full bg-rose-500/10 blur-[110px] animate-pulse-subtle" />

        {/* High-Craft Micro Dot Texture */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.9) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-display text-xl font-bold tracking-tight text-white hover:text-rose-300 transition-colors cursor-default">
            Coral_AI
          </span>
          <span className="font-sub text-[10px] tracking-[0.28em] uppercase text-rose-400/90 font-medium">
            BY CORAL_CLOUD
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-sub text-[10px] tracking-wider uppercase text-slate-400">
              CLOUDFLARE PAGES LIVE
            </span>
          </div>
          {user && (
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800/80 border border-white/10 text-xs font-sub tracking-wider uppercase text-slate-300 hover:text-white transition-all duration-200"
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </button>
          )}
        </div>
      </header>

      {/* Main Authentication & Studio Canvas */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        {!user ? (
          /* Unauthenticated State: Sleek Modern AI Login Card */
          <div className="w-full max-w-md mx-auto">
            <div className="relative rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-white/[0.08] p-8 sm:p-10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] hover:border-white/[0.14] transition-all duration-300">
              
              {/* Brand Typography */}
              <div className="text-center space-y-2">
                <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white">
                  Coral_AI
                </h1>
                <p className="font-sub text-xs sm:text-sm tracking-[0.3em] uppercase text-rose-400 font-semibold">
                  BY CORAL_CLOUD
                </p>
                <p className="text-xs sm:text-sm text-slate-400 pt-2 font-normal leading-relaxed">
                  Next-generation cognitive intelligence and creative studio
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed text-center font-sans">
                  {error}
                </div>
              )}

              {/* Hairline Divider */}
              <div className="my-8 h-px w-full bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

              {/* Single-Click Google Authentication */}
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full group relative flex items-center justify-center gap-3.5 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-sans text-sm font-semibold shadow-[0_4px_20px_rgba(255,255,255,0.08)] hover:shadow-[0_4px_30px_rgba(244,63,94,0.3)] active:scale-[0.985] transition-all duration-200 disabled:opacity-75"
                >
                  {/* Official Google 4-Color Mark */}
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>
                    {isLoggingIn ? 'Connecting to Google...' : 'Continue with Google'}
                  </span>
                </button>

                <p className="text-center font-sub text-[11px] text-slate-500 tracking-wider uppercase">
                  Single-Click Secure Sign In
                </p>
              </div>

              {/* Informational Subtext */}
              <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  By continuing, you agree to Coral_AI's{' '}
                  <button
                    onClick={() => setModalType('terms')}
                    className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    onClick={() => setModalType('privacy')}
                    className="text-slate-300 hover:text-white underline underline-offset-2 transition-colors"
                  >
                    Privacy Policy
                  </button>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated State: Clean Studio Profile & Workspace Gateway */
          <div className="w-full max-w-lg mx-auto">
            <div className="rounded-3xl bg-slate-900/40 backdrop-blur-2xl border border-white/[0.08] p-8 sm:p-10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] space-y-6">
              
              <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
                <div className="space-y-1">
                  <span className="font-sub text-[10px] tracking-[0.25em] uppercase text-rose-400 font-semibold">
                    ACTIVE SESSION
                  </span>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Welcome to Coral_AI
                  </h2>
                </div>
                <span className="font-sub text-[10px] tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                  VERIFIED ACCOUNT
                </span>
              </div>

              {/* User Identity Details */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || 'User Avatar'}
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-display font-bold text-xl">
                    {user.email?.[0]?.toUpperCase() || 'C'}
                  </div>
                )}
                
                <div className="space-y-1 overflow-hidden">
                  <div className="font-display text-lg font-semibold text-white truncate">
                    {user.user_metadata?.full_name || 'Authenticated User'}
                  </div>
                  <div className="font-sub text-xs text-slate-400 tracking-wide truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* System Metadata Panel */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="font-sub text-[9px] tracking-wider uppercase text-slate-500">
                    PROVIDER
                  </div>
                  <div className="font-mono text-slate-300 text-[11px] font-medium truncate">
                    Google OAuth
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="font-sub text-[9px] tracking-wider uppercase text-slate-500">
                    STACK
                  </div>
                  <div className="font-mono text-slate-300 text-[11px] font-medium truncate">
                    Supabase + CF
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                  <div className="font-sub text-[9px] tracking-wider uppercase text-slate-500">
                    STATUS
                  </div>
                  <div className="font-mono text-emerald-400 text-[11px] font-medium truncate">
                    {session ? 'Active' : 'Unset'}
                  </div>
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-sans text-sm font-semibold shadow-[0_4px_25px_rgba(244,63,94,0.35)] transition-all duration-200 text-center"
                >
                  Enter Coral Workspace
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="py-3.5 px-6 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-300 hover:text-white font-sub text-xs uppercase tracking-wider transition-colors"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.05] text-xs text-slate-500">
        <div className="flex items-center gap-2 font-sub text-[11px] tracking-wider uppercase">
          <span className="text-slate-400 font-semibold">CORAL_AI</span>
          <span>•</span>
          <span>BY CORAL_CLOUD</span>
        </div>

        <div className="flex items-center gap-6 font-sans">
          <button
            onClick={() => setModalType('privacy')}
            className="hover:text-slate-300 transition-colors"
          >
            Privacy Policy
          </button>
          <button
            onClick={() => setModalType('terms')}
            className="hover:text-slate-300 transition-colors"
          >
            Terms of Service
          </button>
          <a
            href="https://github.com/Nikhil2024me/Coral_AI"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 transition-colors font-sub text-[11px] tracking-wider uppercase"
          >
            GitHub
          </a>
        </div>
      </footer>

      {/* Modal: Terms of Service & Privacy Policy */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-white/10 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <span className="font-sub text-[10px] tracking-[0.25em] uppercase text-rose-400 font-semibold">
                  LEGAL DOCUMENTATION
                </span>
                <h3 className="font-display text-xl font-bold text-white mt-1">
                  {modalType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                </h3>
              </div>
              <button
                onClick={closeModal}
                className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-sub tracking-wider uppercase text-slate-300 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-4 font-sans">
              {modalType === 'privacy' ? (
                <>
                  <p>
                    <strong className="text-white">Effective Date:</strong> October 2026
                  </p>
                  <p>
                    Coral_AI by Coral_Cloud respects user privacy and enforces minimal data collection boundaries.
                  </p>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-rose-300 font-display">1. Information We Receive</p>
                    <p>
                      When signing in with Google OAuth, we only receive your public profile identifier, verified email address, and avatar image. We do not access contacts, emails, or personal drive files.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-rose-300 font-display">2. Purpose of Processing</p>
                    <p>
                      Your account details are used exclusively to create and authenticate your active session inside Coral_AI. We never sell, lease, or monetize user data.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-rose-300 font-display">3. Security & Storage</p>
                    <p>
                      Identity tokens and access privileges are managed via Supabase encrypted session storage. You can revoke access or sign out at any time.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    <strong className="text-white">Effective Date:</strong> October 2026
                  </p>
                  <p>
                    By accessing or using Coral_AI by Coral_Cloud, you agree to the following terms:
                  </p>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-amber-300 font-display">1. Prototype & AI Studio Usage</p>
                    <p>
                      Coral_AI is provided on an &quot;as-is&quot; basis for intelligent exploration, experimentation, and productivity. No warranties of constant availability are implied.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-amber-300 font-display">2. Acceptable Conduct</p>
                    <p>
                      Users agree to use Coral_AI lawfully and avoid any attempts to circumvent security mechanisms, conduct denial-of-service attempts, or reverse-engineer backend APIs.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <p className="font-semibold text-amber-300 font-display">3. Limitation of Liability</p>
                    <p>
                      Coral_Cloud and its maintainers assume no liability for indirect, incidental, or consequential damages resulting from the use of this service.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-200 text-slate-900 font-sans text-xs font-semibold transition-all duration-200"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

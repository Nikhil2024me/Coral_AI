import { useEffect, useState } from 'react';
import { supabase, PROJECT_DETAILS } from './lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Database, 
  User as UserIcon, 
  Mail, 
  ShieldCheck, 
  Code2, 
  ExternalLink,
  Sparkles,
  Loader2,
  FileText,
  Lock,
  X
} from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  
  // Modals for Google OAuth Verification & Legal Protection
  const [modalType, setModalType] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setError(error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // 3. Inspect URL for modal routes / OAuth callback error hash
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
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate Google sign-in.';
      setError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setUser(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign out.';
      setError(message);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <p className="text-sm font-medium text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 p-4 sm:p-6 md:p-8">
      {/* Top Header & Status */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Coral AI
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Google Login
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Project: {PROJECT_DETAILS.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Supabase:</span>
            <span className="font-mono text-emerald-400">{PROJECT_DETAILS.ref}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md w-full mx-auto my-auto py-10">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-sm flex items-start gap-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300">Authentication Error</p>
              <p className="text-xs text-red-300/80 mt-1">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {!user ? (
          /* LOGIN CARD */
          <div className="relative group">
            {/* Background ambient glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-amber-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>

            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-rose-500/10 to-amber-500/10 border border-rose-500/20 mb-4 text-rose-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Welcome to Coral AI
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  Sign in with your Google account to test the authentication flow.
                </p>
              </div>

              {/* Google Sign In Button */}
              <div className="space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full relative flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-75 disabled:cursor-not-allowed group/btn active:scale-[0.99]"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      {/* Official Google 'G' Logo */}
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.37 7.36 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12c0 2.03.46 3.84 1.26 5.42l4.02-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.63 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span className="text-slate-900">Sign in with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Public Test Disclaimer */}
              <div className="mt-6 p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 text-center">
                <span>Free experimental testing playground. We never sell your data or share your personal profile.</span>
              </div>

              {/* Project & Integration Info */}
              <div className="mt-6 pt-5 border-t border-slate-800 text-xs text-slate-400 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Provider</span>
                  <span className="font-medium text-slate-300">Google OAuth 2.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Supabase Project</span>
                  <span className="font-mono text-slate-300">{PROJECT_DETAILS.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Region</span>
                  <span className="font-medium text-slate-300">{PROJECT_DETAILS.region}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Public Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AUTHENTICATED PROFILE CARD */
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-30"></div>

            <div className="relative bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                  <img
                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    alt={user.user_metadata?.full_name || 'User avatar'}
                    className="w-16 h-16 rounded-full border-2 border-emerald-500/50 shadow-md object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <UserIcon className="w-8 h-8" />
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 mb-1">
                    <CheckCircle2 className="w-3 h-3" /> Signed In with Google
                  </div>
                  <h3 className="text-xl font-bold text-white truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Authenticated User'}
                  </h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {user.email}
                  </p>
                </div>
              </div>

              {/* User Details Grid */}
              <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 mb-6 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                  <span className="text-slate-500">User ID</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]" title={user.id}>
                    {user.id}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                  <span className="text-slate-500">Email Verified</span>
                  <span className="text-emerald-400 font-medium">
                    {user.email_confirmed_at ? 'Yes' : 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/50">
                  <span className="text-slate-500">Last Sign In</span>
                  <span className="text-slate-300">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Just now'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Session Expiry</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {session?.expires_at ? new Date(session.expires_at * 1000).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-rose-400 hover:text-rose-300 border border-slate-700 font-medium text-sm transition-all duration-200 disabled:opacity-60 active:scale-[0.99]"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showRawData ? 'Hide Debug Data' : 'View Raw Session Data'}</span>
                </button>

                {showRawData && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto text-[11px] font-mono text-slate-300 max-h-56">
                    <pre>{JSON.stringify({ user, session }, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with Legal & Verification Links */}
      <footer className="max-w-4xl w-full mx-auto py-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span>Coral AI Playground</span>
          <span>•</span>
          <button 
            onClick={() => setModalType('privacy')}
            className="hover:text-slate-300 underline underline-offset-4 transition-colors"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button 
            onClick={() => setModalType('terms')}
            className="hover:text-slate-300 underline underline-offset-4 transition-colors"
          >
            Terms of Service
          </button>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={`https://supabase.com/dashboard/project/${PROJECT_DETAILS.ref}/auth/users`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 flex items-center gap-1 transition-colors"
          >
            Supabase Dashboard <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>

      {/* MODAL: Privacy Policy & Terms of Service */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                {modalType === 'privacy' ? <Lock className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                <h3 className="text-lg font-bold text-white">
                  {modalType === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setModalType(null);
                  if (window.location.hash) {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-300 leading-relaxed space-y-4">
              {modalType === 'privacy' ? (
                <>
                  <p>
                    <strong className="text-white">Last Updated:</strong> September 2026
                  </p>
                  <p>
                    Welcome to <strong>Coral AI</strong>. This application is an experimental, non-commercial prototype designed for testing and entertainment purposes.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-rose-300">1. Information We Collect:</p>
                    <p>
                      When you click &quot;Sign in with Google&quot;, we receive basic public profile information permitted by Google OAuth: your name, email address, and avatar image.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-rose-300">2. How We Use It:</p>
                    <p>
                      Your details are used solely to authenticate your temporary test session and display your avatar/email. We do <strong>NOT</strong> sell, rent, monetize, or track your personal information across other sites.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-rose-300">3. Storage & Security:</p>
                    <p>
                      Authentication tokens and user identities are managed securely via Supabase Cloud Auth. You may sign out at any time to invalidate your active session.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    <strong className="text-white">Last Updated:</strong> September 2026
                  </p>
                  <p>
                    By accessing or using the <strong>Coral AI</strong> login demonstration, you acknowledge and agree to the following terms:
                  </p>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-amber-300">1. Entertainment & Prototype Use:</p>
                    <p>
                      This application is provided strictly &quot;as-is&quot; for entertainment, educational demonstration, and testing purposes. No guarantees of uptime, permanence, or specific functionality are made.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-amber-300">2. Limitation of Liability:</p>
                    <p>
                      To the maximum extent permitted by applicable law, the creators and maintainers of this project bear zero liability for any direct, indirect, incidental, or consequential damages resulting from your use of this test application.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <p className="font-semibold text-amber-300">3. Fair & Lawful Use:</p>
                    <p>
                      Users agree not to attempt to bypass access controls, perform denial of service attacks, or use the service for unauthorized actions.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setModalType(null);
                  if (window.location.hash) {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

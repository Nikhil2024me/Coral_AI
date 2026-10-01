import { supabase } from './lib/supabase';

// Helper to display error or status messages inside the terminal card
function showMessage(text: string, isError = true) {
  let msgEl = document.getElementById('auth-message-banner');
  if (!msgEl) {
    msgEl = document.createElement('div');
    msgEl.id = 'auth-message-banner';
    const form = document.querySelector('form[data-purpose="credential-form"]');
    if (form && form.parentNode) {
      form.parentNode.insertBefore(msgEl, form);
    }
  }
  if (msgEl) {
    msgEl.className = `mb-6 p-3.5 rounded-xl text-xs leading-relaxed text-center font-mono ${
      isError
        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
    }`;
    msgEl.textContent = text;
  }
}

// 1. Google OAuth Click Handler
const googleBtn = document.querySelector<HTMLButtonElement>('.retro-google-btn');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const span = googleBtn.querySelector<HTMLSpanElement>('span.font-pixel');
    const originalText = span ? span.textContent : 'SIGN IN WITH GOOGLE';
    if (span) span.textContent = 'CONNECTING TO GOOGLE...';
    googleBtn.disabled = true;

    try {
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
        showMessage(error.message, true);
        if (span) span.textContent = originalText;
        googleBtn.disabled = false;
      }
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Unexpected error during sign-in', true);
      if (span) span.textContent = originalText;
      googleBtn.disabled = false;
    }
  });
}

// 2. Email / Password Login Handler
const credForm = document.querySelector<HTMLFormElement>('form[data-purpose="credential-form"]');
if (credForm) {
  credForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value?.trim() || '';

    if (!email || !password) {
      showMessage('Please provide both email/username and password.', true);
      return;
    }

    const submitBtn = credForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const span = submitBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    const originalText = span?.textContent || 'Sign In';
    if (span) span.textContent = 'Signing In...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showMessage(
          error.message.toLowerCase().includes('invalid login credentials')
            ? 'Invalid credentials. Please use Sign in with Google or check your email/password.'
            : error.message,
          true
        );
        if (span) span.textContent = originalText;
        if (submitBtn) submitBtn.disabled = false;
      } else {
        showMessage('Successfully authenticated!', false);
        if (span) span.textContent = 'Verified ✓';
      }
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : 'Authentication failed', true);
      if (span) span.textContent = originalText;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// 3. Inspect Session on Load
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    const span = googleBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    if (span) {
      span.textContent = `AUTHENTICATED: ${session.user.email?.split('@')[0]?.toUpperCase()}`;
    }
    showMessage(`Active Session: ${session.user.email}`, false);
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    const span = googleBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    if (span) {
      span.textContent = `AUTHENTICATED: ${session.user.email?.split('@')[0]?.toUpperCase()}`;
    }
  }
});

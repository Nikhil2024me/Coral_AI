# Google Login Screen • Coral AI

A modern, responsive Google Authentication login screen built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Vite**, connected directly to the **`Google_Login-Coral_AI`** project on **Supabase**.

---

## 🌟 Features

- **Google OAuth 2.0 Integration**: Seamless sign-in with Google using `@supabase/supabase-js`.
- **Pre-configured with Supabase**:
  - **Project Name**: `Google_Login-Coral_AI`
  - **Project Ref**: `thoqrtiscrdyupbnxgbt`
  - **Region**: `ap-south-1`
- **Authenticated Dashboard / Profile**:
  - Displays user avatar, display name, and email.
  - Verification badges (Email verified, provider status).
  - Session details (expiry timestamps, unique Supabase user ID).
  - Live session debug inspector.
  - Sign-out functionality.
- **Sleek Glassmorphic Dark UI**: Custom-tailored dark mode interface with radial gradients and responsive cards.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **npm**

### 2. Environment Variables
The `.env` file is already pre-configured for `Google_Login-Coral_AI`:
```bash
VITE_SUPABASE_URL=https://thoqrtiscrdyupbnxgbt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 🔧 Supabase Dashboard Reference
If you run this application on a custom domain or different port, remember to add your URL to the **Redirect URLs** in your Supabase Auth settings:
- **Supabase Auth Configuration**: [https://supabase.com/dashboard/project/thoqrtiscrdyupbnxgbt/auth/url-configuration](https://supabase.com/dashboard/project/thoqrtiscrdyupbnxgbt/auth/url-configuration)
- **Users Dashboard**: [https://supabase.com/dashboard/project/thoqrtiscrdyupbnxgbt/auth/users](https://supabase.com/dashboard/project/thoqrtiscrdyupbnxgbt/auth/users)

# Coral_AI — Neural Workspace & Retro Cyberpunk Auth

A modern 16-bit retro cyberpunk authentication and local AI neural workspace built with **TypeScript**, **Tailwind CSS**, and **Vite**, connected to **Supabase** for auth/persistence and **Ollama** for private local neural network inference.

---

## Features

- **16-Bit Retro Cyberpunk Aesthetic**:
  - Cosmic obsidian palette (`#080511`) with glowing violet and phosphor neon accents.
  - Tactile typography: `"Press Start 2P"` for brand & system tags, `"Silkscreen"` for telemetry & subheaders, `"VT323"` / monospace for terminal inputs & code blocks, and `"Plus Jakarta Sans"` for body text readability.
  - Authentic scanlines, glassmorphic cards, and retro tactile buttons.
  - **Crafted without AI Emojis or Slop**: Standard geometric SVG icons and technical system labels throughout (`[USER]`, `[CORAL_AI]`, `[COPY]`, `[STOP]`, `[CONFIG]`).

- **Authentication (Supabase)**:
  - **Google OAuth 2.0**: 1-click Google Sign-In with automatic session persistence and redirect to `#/chat`.
  - **Email & Password**: Direct authentication with error validation and success feedback.
  - **Route Guarding**: Seamless navigation between Login (`#/`) and Chat Workspace (`#/chat`), with protected access for authenticated sessions.

- **Local Neural Inference Engine (Ollama)**:
  - Connects directly to the user's local or custom Ollama daemon (defaults to `http://localhost:11434`).
  - Auto-detects installed models via `GET /api/tags` (e.g. `qwen3.5:2b`, `openbmb/minicpm5-2b`, etc.).
  - Real-time token streaming with live typing cursor and `[STOP GENERATING]` abort controller.
  - **Rich Markdown Formatting**: Clean headings, lists, tables, blockquotes, and syntax-highlighted code blocks with 1-click `[COPY CODE]` buttons.

- **Session Persistence (Cloud Sync + Local Fallback)**:
  - Multi-session conversation management with `[+ NEW SESSION]`, renaming, and deletion.
  - Syncs to Supabase `conversations` and `messages` tables under Row Level Security (`auth.uid()`).
  - Automatic `localStorage` fallback so chat functions immediately even before database migrations are run.

- **Diagnostics & CORS Configuration Drawer**:
  - Test connection button with real-time latency measurement and active model detection.
  - Direct guide for CORS / browser compatibility when deployed on the web.

---

## Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **npm**
- **Ollama** installed and running on your system ([ollama.com](https://ollama.com))

### 2. Configure Ollama for Web Access
If accessing from a web browser or deployed host (such as Cloudflare Pages), start Ollama with CORS origins enabled:
```bash
OLLAMA_ORIGINS="*" ollama serve
```

Pull your preferred model (e.g. Qwen or Llama):
```bash
ollama pull qwen3.5:2b
```

### 3. Environment Variables
The `.env` file is pre-configured for the `Google_Login-Coral_AI` Supabase project:
```bash
VITE_SUPABASE_URL=https://thoqrtiscrdyupbnxgbt.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser:
- `http://localhost:5173/#/` — Login & Authentication Terminal
- `http://localhost:5173/#/chat` — Coral_AI Chat Workspace

### 5. Production Build
```bash
npm run build
```
Builds the optimized bundle into `dist/` ready for Cloudflare Pages or any static host.

---

## Supabase Database Schema

To enable multi-device cloud chat synchronization, run [`supabase/schema.sql`](file:///home/debian/Documents/internaltesting/supabase/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard/project/thoqrtiscrdyupbnxgbt/sql):
- Creates `conversations` and `messages` tables with cascade deletes.
- Enables Row Level Security (RLS) guaranteeing users only read and write their own chats.

---

## Cloudflare Deployment

Deployment is configured via [`wrangler.toml`](file:///home/debian/Documents/internaltesting/wrangler.toml) pointing to `./dist` with SPA routing (`public/_redirects`) and security headers (`public/_headers`).
```bash
npm run build
npx wrangler pages deploy dist --project-name=coralai
```

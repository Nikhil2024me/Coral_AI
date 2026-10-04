import { marked } from 'marked';
import { supabase } from './lib/supabase';
import {
  getOllamaConfig,
  saveOllamaConfig,
  testOllamaConnection,
  streamOllamaChat,
  ChatMessage,
} from './lib/ollama';
import {
  Conversation,
  Message,
  listConversations,
  createConversation,
  deleteConversation,
  listMessages,
  addMessage,
  updateConversationTitle,
  getActiveStorageMode,
} from './lib/chatStore';

// ==============================================================================
// State Machine
// ==============================================================================
let currentUserId = 'guest-local-user';
let currentUserEmail = 'Guest';
let isAuthenticated = false;

let conversations: Conversation[] = [];
let activeConversation: Conversation | null = null;
let currentMessages: Message[] = [];
let availableModels: string[] = ['qwen3.5:2b'];

let activeAbortController: AbortController | null = null;
let isGenerating = false;
let lastUserPrompt = '';

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

// Helper: Escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Format Time
function formatTime(isoStr?: string): string {
  const date = isoStr ? new Date(isoStr) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ==============================================================================
// Markdown & Code Block Post-Processor
// ==============================================================================
function renderMarkdownWithCodeBlocks(rawText: string): string {
  const html = marked.parse(rawText) as string;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Process all pre code blocks to add header and standard copy button
  const preElements = tempDiv.querySelectorAll('pre');
  preElements.forEach((pre) => {
    const code = pre.querySelector('code');
    const codeContent = code ? code.innerText : pre.innerText;
    let language = 'CODE';

    if (code && code.className) {
      const match = code.className.match(/language-(\w+)/);
      if (match && match[1]) {
        language = match[1].toUpperCase();
      }
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'coral-code-box';

    const header = document.createElement('div');
    header.className = 'coral-code-header';
    header.innerHTML = `
      <span class="font-mono text-[11px] uppercase tracking-wider text-purple-300">${language}</span>
      <button type="button" class="copy-code-btn px-2.5 py-1 rounded bg-purple-950/70 border border-purple-500/30 hover:bg-purple-900/50 text-purple-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer" data-code="${encodeURIComponent(codeContent)}">
        <span class="material-symbols-outlined text-xs">content_copy</span>
        <span>COPY</span>
      </button>
    `;

    pre.parentNode?.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  return tempDiv.innerHTML;
}

// ==============================================================================
// Router & View Management
// ==============================================================================
const viewLogin = document.getElementById('view-login');
const viewChat = document.getElementById('view-chat');
const authGuardModal = document.getElementById('auth-guard-modal');
const launchChatBanner = document.getElementById('auth-launch-chat-banner');
const launchUserEmail = document.getElementById('auth-launch-user-email');

function syncViewToHash() {
  const hash = window.location.hash || '';

  if (hash.startsWith('#/chat')) {
    // Chat view requested
    if (!isAuthenticated) {
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (viewChat) viewChat.classList.add('hidden');
      if (authGuardModal) authGuardModal.classList.remove('hidden');
    } else {
      if (viewLogin) viewLogin.classList.add('hidden');
      if (viewChat) viewChat.classList.remove('hidden');
      if (authGuardModal) authGuardModal.classList.add('hidden');
      initChatWorkspace();
    }
  } else {
    // Login view default
    if (viewLogin) viewLogin.classList.remove('hidden');
    if (viewChat) viewChat.classList.add('hidden');
    if (authGuardModal) authGuardModal.classList.add('hidden');

    if (isAuthenticated) {
      if (launchChatBanner) launchChatBanner.classList.remove('hidden');
      if (launchUserEmail) launchUserEmail.textContent = `Signed in as: ${currentUserEmail}`;
    } else {
      if (launchChatBanner) launchChatBanner.classList.add('hidden');
    }
  }
}

window.addEventListener('hashchange', syncViewToHash);

// ==============================================================================
// Login Handlers
// ==============================================================================
function showLoginMessage(text: string, isError = true) {
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

// 1. Google OAuth
const googleBtn = document.querySelector<HTMLButtonElement>('.retro-google-btn');
if (googleBtn) {
  googleBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const span = googleBtn.querySelector<HTMLSpanElement>('span.font-pixel');
    const originalText = span ? span.textContent : 'SIGN IN WITH GOOGLE';
    if (span) span.textContent = 'CONNECTING TO GOOGLE...';
    googleBtn.disabled = true;

    try {
      const redirectUrl = `${window.location.origin}/#/chat`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) {
        showLoginMessage(error.message, true);
        if (span) span.textContent = originalText;
        googleBtn.disabled = false;
      }
    } catch (err: unknown) {
      showLoginMessage(err instanceof Error ? err.message : 'Unexpected error during sign-in', true);
      if (span) span.textContent = originalText;
      googleBtn.disabled = false;
    }
  });
}

// 2. Email / Password Login
const credForm = document.querySelector<HTMLFormElement>('form[data-purpose="credential-form"]');
if (credForm) {
  credForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('username') as HTMLInputElement | null;
    const passwordInput = document.getElementById('password') as HTMLInputElement | null;
    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value?.trim() || '';

    if (!email || !password) {
      showLoginMessage('Please provide both email/username and password.', true);
      return;
    }

    const submitBtn = credForm.querySelector<HTMLButtonElement>('button[type="submit"]');
    const span = submitBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    const originalText = span?.textContent || 'Sign In';
    if (span) span.textContent = 'Signing In...';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        showLoginMessage(
          error.message.toLowerCase().includes('invalid login credentials')
            ? 'Invalid credentials. Check your email/password or use Google Sign-in.'
            : error.message,
          true
        );
        if (span) span.textContent = originalText;
        if (submitBtn) submitBtn.disabled = false;
      } else if (data.user) {
        showLoginMessage('Successfully authenticated!', false);
        if (span) span.textContent = 'Verified ✓';
        currentUserEmail = data.user.email || 'User';
        currentUserId = data.user.id;
        isAuthenticated = true;
        setTimeout(() => {
          window.location.hash = '#/chat';
        }, 300);
      }
    } catch (err: unknown) {
      showLoginMessage(err instanceof Error ? err.message : 'Authentication failed', true);
      if (span) span.textContent = originalText;
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// 3. Sign Out Handler
const btnSignOut = document.getElementById('btn-sign-out');
if (btnSignOut) {
  btnSignOut.addEventListener('click', async () => {
    if (activeAbortController) {
      activeAbortController.abort();
    }
    await supabase.auth.signOut();
    isAuthenticated = false;
    currentUserEmail = 'Guest';
    currentUserId = 'guest-local-user';
    activeConversation = null;
    currentMessages = [];
    window.location.hash = '#/';
    syncViewToHash();
  });
}

// ==============================================================================
// Qwen-Style Model Dropdown Management (Screenshot 3)
// ==============================================================================
const btnModelTrigger = document.getElementById('btn-model-trigger');
const modelDropdownMenu = document.getElementById('model-dropdown-menu');
const modelDropdownItems = document.getElementById('model-dropdown-items');
const currentModelLabel = document.getElementById('current-model-label');
const ollamaStatusDot = document.getElementById('ollama-status-dot');
const ollamaStatusText = document.getElementById('ollama-status-text');
const btnDropdownConfig = document.getElementById('btn-dropdown-config');

function toggleModelDropdown() {
  modelDropdownMenu?.classList.toggle('hidden');
}

btnModelTrigger?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleModelDropdown();
});

btnDropdownConfig?.addEventListener('click', () => {
  modelDropdownMenu?.classList.add('hidden');
  openSettingsDialog();
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('#model-dropdown-wrapper')) {
    modelDropdownMenu?.classList.add('hidden');
  }
  if (!target.closest('#btn-plus-menu') && !target.closest('#plus-menu-dropdown')) {
    plusMenuDropdown?.classList.add('hidden');
  }
});

function renderModelDropdown() {
  if (!modelDropdownItems) return;
  modelDropdownItems.innerHTML = '';

  const activeModel = activeConversation?.model || getOllamaConfig().defaultModel;

  availableModels.forEach((model) => {
    const isSelected = model === activeModel;
    const item = document.createElement('div');
    item.className = `model-option p-2.5 rounded-xl hover:bg-purple-950/60 border ${
      isSelected ? 'border-purple-500/40 bg-purple-950/40' : 'border-transparent'
    } cursor-pointer transition-colors`;
    item.dataset.model = model;

    item.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-mono text-xs text-white font-semibold flex items-center gap-1.5">
          <span>${escapeHtml(model)}</span>
          ${isSelected ? '<span class="material-symbols-outlined text-sm text-purple-400">check</span>' : ''}
        </div>
        <span class="text-[9px] font-mono text-purple-300 uppercase">Local</span>
      </div>
      <div class="text-[10px] text-slate-400 font-sans mt-0.5">High-speed inference via local Ollama</div>
    `;

    item.addEventListener('click', () => {
      selectModel(model);
      modelDropdownMenu?.classList.add('hidden');
    });

    modelDropdownItems.appendChild(item);
  });
}

function selectModel(modelName: string) {
  if (currentModelLabel) currentModelLabel.textContent = modelName;
  if (activeConversation) {
    activeConversation.model = modelName;
  }
  saveOllamaConfig({ defaultModel: modelName });
  renderModelDropdown();
}

async function updateOllamaHealth(customHost?: string) {
  const config = getOllamaConfig();
  const host = customHost || config.host;

  if (ollamaStatusText) ollamaStatusText.textContent = 'CONNECTING';
  if (ollamaStatusDot) {
    ollamaStatusDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
  }

  const { ok, latencyMs, models, error } = await testOllamaConnection(host);

  if (ok) {
    if (ollamaStatusText) ollamaStatusText.textContent = `ONLINE ${latencyMs}ms`;
    if (ollamaStatusDot) {
      ollamaStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    }

    if (models.length > 0) {
      availableModels = models;
      const current = activeConversation?.model || config.defaultModel;
      if (!availableModels.includes(current)) {
        selectModel(availableModels[0]);
      } else {
        selectModel(current);
      }
    }
  } else {
    if (ollamaStatusText) ollamaStatusText.textContent = 'OFFLINE';
    if (ollamaStatusDot) {
      ollamaStatusDot.className = 'w-2 h-2 rounded-full bg-rose-500';
    }
    console.warn('[Coral_AI] Ollama offline or blocked:', error);
  }

  renderModelDropdown();
}

// ==============================================================================
// Plus Menu Popup (Screenshot 4)
// ==============================================================================
const btnPlusMenu = document.getElementById('btn-plus-menu');
const plusMenuDropdown = document.getElementById('plus-menu-dropdown');

btnPlusMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenuDropdown?.classList.toggle('hidden');
});

document.querySelectorAll('.plus-menu-item').forEach((item) => {
  item.addEventListener('click', () => {
    const action = (item as HTMLElement).dataset.action;
    plusMenuDropdown?.classList.add('hidden');

    if (action === 'prompt-sys') {
      openSettingsDialog();
      configSystemPrompt?.focus();
    } else if (action === 'mode-code') {
      saveOllamaConfig({
        systemPrompt: 'You are Coral_AI Expert Coder. Provide clean, secure, type-safe, and production-grade code with concise commentary.',
      });
      alert('Coder Mode enabled! System directive updated.');
    } else if (action === 'clear-chat') {
      startNewSession();
    }
  });
});

// ==============================================================================
// Sidebar Interactions (Screenshots 1 & 2)
// ==============================================================================
const chatSidebar = document.getElementById('chat-sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const chatSessionsList = document.getElementById('chat-sessions-list');
const btnNewSession = document.getElementById('btn-new-session');
const btnSearchChats = document.getElementById('btn-search-chats');
const sessionCountLabel = document.getElementById('session-count-label');
const storageModeLabel = document.getElementById('storage-mode-label');
const sidebarAvatarInitial = document.getElementById('sidebar-avatar-initial');
const sidebarUserName = document.getElementById('sidebar-user-name');

let isSidebarLockedOpen = false;

btnToggleSidebar?.addEventListener('click', () => {
  isSidebarLockedOpen = !isSidebarLockedOpen;
  if (isSidebarLockedOpen) {
    chatSidebar?.classList.remove('w-16');
    chatSidebar?.classList.add('w-64');
  } else {
    chatSidebar?.classList.remove('w-64');
    chatSidebar?.classList.add('w-16');
  }
});

btnSearchChats?.addEventListener('click', () => {
  const query = prompt('Enter keyword to search past sessions:');
  if (query && query.trim()) {
    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(query.toLowerCase())
    );
    renderFilteredSessions(filtered);
  } else {
    renderSidebarSessions();
  }
});

function renderFilteredSessions(filteredList: Conversation[]) {
  if (!chatSessionsList) return;
  chatSessionsList.innerHTML = '';

  filteredList.forEach((conv) => {
    const isActive = activeConversation?.id === conv.id;
    const item = document.createElement('div');
    item.className = `session-item group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
      isActive
        ? 'bg-purple-950/70 border border-purple-500/40 text-white font-semibold'
        : 'hover:bg-purple-950/30 border border-transparent text-slate-400 hover:text-slate-200'
    }`;
    item.dataset.id = conv.id;

    item.innerHTML = `
      <div class="flex items-center gap-2 truncate pr-1">
        <span class="material-symbols-outlined text-xs ${isActive ? 'text-purple-300' : 'text-purple-400/60'} shrink-0">chat_bubble</span>
        <span class="truncate text-xs font-mono">${escapeHtml(conv.title)}</span>
      </div>
      <button type="button" class="delete-session-btn p-1 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" data-id="${conv.id}" title="Delete session">
        <span class="material-symbols-outlined text-sm">delete</span>
      </button>
    `;

    item.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.delete-session-btn')) return;

      activeConversation = conv;
      currentMessages = await listMessages(conv.id, currentUserId);
      renderSidebarSessions();
      await renderConversationMessages();
    });

    chatSessionsList.appendChild(item);
  });
}

function renderSidebarSessions() {
  if (!chatSessionsList) return;
  chatSessionsList.innerHTML = '';

  if (sessionCountLabel) sessionCountLabel.textContent = String(conversations.length);
  if (storageModeLabel) {
    storageModeLabel.textContent = getActiveStorageMode() === 'supabase' ? 'CLOUD SYNC' : 'LOCAL STORAGE';
  }

  if (sidebarAvatarInitial) {
    sidebarAvatarInitial.textContent = (currentUserEmail[0] || 'U').toUpperCase();
  }
  if (sidebarUserName) {
    sidebarUserName.textContent = currentUserEmail.split('@')[0] || 'User';
  }

  if (conversations.length === 0) {
    chatSessionsList.innerHTML = `
      <div class="py-6 px-2 text-center text-slate-500 font-mono text-[11px] leading-relaxed whitespace-nowrap">
        No sessions yet.<br>Click "+ New Chat" to start.
      </div>
    `;
    return;
  }

  conversations.forEach((conv) => {
    const isActive = activeConversation?.id === conv.id;
    const item = document.createElement('div');
    item.className = `session-item group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${
      isActive
        ? 'bg-purple-950/70 border border-purple-500/40 text-white font-semibold'
        : 'hover:bg-purple-950/30 border border-transparent text-slate-400 hover:text-slate-200'
    }`;
    item.dataset.id = conv.id;

    item.innerHTML = `
      <div class="flex items-center gap-2 truncate pr-1">
        <span class="material-symbols-outlined text-xs ${isActive ? 'text-purple-300' : 'text-purple-400/60'} shrink-0">chat_bubble</span>
        <span class="truncate text-xs font-mono">${escapeHtml(conv.title)}</span>
      </div>
      <button type="button" class="delete-session-btn p-1 text-slate-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" data-id="${conv.id}" title="Delete session">
        <span class="material-symbols-outlined text-sm">delete</span>
      </button>
    `;

    item.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.delete-session-btn')) return;

      activeConversation = conv;
      selectModel(conv.model);
      currentMessages = await listMessages(conv.id, currentUserId);
      renderSidebarSessions();
      await renderConversationMessages();
    });

    const deleteBtn = item.querySelector('.delete-session-btn');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConversation(conv.id, currentUserId);
      conversations = conversations.filter((c) => c.id !== conv.id);
      if (activeConversation?.id === conv.id) {
        activeConversation = conversations[0] || null;
        if (activeConversation) {
          selectModel(activeConversation.model);
          currentMessages = await listMessages(activeConversation.id, currentUserId);
        } else {
          currentMessages = [];
        }
      }
      renderSidebarSessions();
      await renderConversationMessages();
    });

    chatSessionsList.appendChild(item);
  });
}

async function startNewSession() {
  if (isGenerating && activeAbortController) {
    activeAbortController.abort();
  }

  const model = currentModelLabel?.textContent || getOllamaConfig().defaultModel;
  const newConv = await createConversation(currentUserId, 'New Session', model);
  conversations.unshift(newConv);
  activeConversation = newConv;
  currentMessages = [];

  renderSidebarSessions();
  await renderConversationMessages();
  if (chatPromptInput) chatPromptInput.focus();
}

btnNewSession?.addEventListener('click', startNewSession);

// ==============================================================================
// Chat Message Rendering & Actions (Screenshot 5)
// ==============================================================================
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatEmptyState = document.getElementById('chat-empty-state');
const chatMessageList = document.getElementById('chat-message-list');
const chatStreamingContainer = document.getElementById('chat-streaming-container');
const btnStopStream = document.getElementById('btn-stop-stream');
const chatErrorCard = document.getElementById('chat-error-card');
const chatErrorText = document.getElementById('chat-error-text');
const btnRetryPrompt = document.getElementById('btn-retry-prompt');
const chatPromptForm = document.getElementById('chat-prompt-form') as HTMLFormElement | null;
const chatPromptInput = document.getElementById('chat-prompt-input') as HTMLTextAreaElement | null;

function renderUserMessageElement(content: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end w-full';
  wrapper.innerHTML = `
    <div class="max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-3.5 bg-purple-950/50 border border-purple-500/25 text-slate-100 shadow-md">
      <div class="whitespace-pre-wrap font-sans text-sm leading-relaxed">${escapeHtml(content)}</div>
    </div>
  `;
  return wrapper;
}

function renderAssistantMessageElement(
  content: string,
  modelName: string,
  isoTimestamp?: string,
  isLiveStreaming = false
): { container: HTMLElement; contentEl: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-start w-full group/msg';

  const innerCard = document.createElement('div');
  innerCard.className = 'w-full text-slate-100';

  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-2 text-xs font-mono text-purple-400';
  header.innerHTML = `
    <span class="font-pixel text-[9px] px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-500/40 text-purple-300">${escapeHtml(modelName)}</span>
    <span class="text-slate-500 text-[10px] font-mono">${formatTime(isoTimestamp)}</span>
  `;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'coral-prose text-sm leading-relaxed mb-3';

  if (isLiveStreaming) {
    bodyEl.innerHTML = renderMarkdownWithCodeBlocks(content) + '<span class="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1 align-middle"></span>';
  } else {
    bodyEl.innerHTML = renderMarkdownWithCodeBlocks(content);
  }

  // Action Toolbar (Screenshot 5: Copy, Thumbs up/down, Refresh)
  const actionToolbar = document.createElement('div');
  actionToolbar.className = 'flex items-center gap-1 text-slate-400 text-xs pt-1.5 border-t border-purple-500/10';
  actionToolbar.innerHTML = `
    <button type="button" class="action-btn copy-msg-btn p-1.5 rounded-lg hover:text-purple-300 hover:bg-purple-950/40 transition-colors cursor-pointer" data-text="${encodeURIComponent(content)}" title="Copy message">
      <span class="material-symbols-outlined text-base">content_copy</span>
    </button>
    <button type="button" class="action-btn thumbs-up-btn p-1.5 rounded-lg hover:text-purple-300 hover:bg-purple-950/40 transition-colors cursor-pointer" title="Good response">
      <span class="material-symbols-outlined text-base">thumb_up</span>
    </button>
    <button type="button" class="action-btn thumbs-down-btn p-1.5 rounded-lg hover:text-purple-300 hover:bg-purple-950/40 transition-colors cursor-pointer" title="Bad response">
      <span class="material-symbols-outlined text-base">thumb_down</span>
    </button>
    <button type="button" class="action-btn retry-msg-btn p-1.5 rounded-lg hover:text-purple-300 hover:bg-purple-950/40 transition-colors cursor-pointer" title="Regenerate">
      <span class="material-symbols-outlined text-base">refresh</span>
    </button>
  `;

  innerCard.appendChild(header);
  innerCard.appendChild(bodyEl);
  if (!isLiveStreaming && content.trim()) {
    innerCard.appendChild(actionToolbar);
  }
  wrapper.appendChild(innerCard);

  return { container: wrapper, contentEl: bodyEl };
}

function scrollChatToBottom() {
  if (chatMessagesContainer) {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }
}

async function renderConversationMessages() {
  if (!chatMessageList) return;
  chatMessageList.innerHTML = '';

  if (currentMessages.length === 0) {
    if (chatEmptyState) chatEmptyState.classList.remove('hidden');
    return;
  }

  if (chatEmptyState) chatEmptyState.classList.add('hidden');

  for (const msg of currentMessages) {
    if (msg.role === 'user') {
      const el = renderUserMessageElement(msg.content);
      chatMessageList.appendChild(el);
    } else if (msg.role === 'assistant') {
      const { container } = renderAssistantMessageElement(
        msg.content,
        activeConversation?.model || 'qwen3.5:2b',
        msg.created_at,
        false
      );
      chatMessageList.appendChild(container);
    }
  }

  scrollChatToBottom();
}

// Preset starter prompts
document.querySelectorAll('.starter-prompt-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = (btn as HTMLElement).dataset.prompt;
    if (prompt && chatPromptInput) {
      chatPromptInput.value = prompt;
      chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
});

// Auto-expand textarea on typing
if (chatPromptInput) {
  chatPromptInput.addEventListener('input', () => {
    chatPromptInput.style.height = 'auto';
    chatPromptInput.style.height = `${Math.min(chatPromptInput.scrollHeight, 140)}px`;
  });

  chatPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
}

// Message Action Toolbar Event Delegation
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  // 1-Click Copy Code block
  const copyCodeBtn = target.closest('.copy-code-btn') as HTMLButtonElement | null;
  if (copyCodeBtn) {
    const rawCode = copyCodeBtn.dataset.code;
    if (!rawCode) return;
    try {
      await navigator.clipboard.writeText(decodeURIComponent(rawCode));
      const span = copyCodeBtn.querySelector('span:last-child');
      const icon = copyCodeBtn.querySelector('.material-symbols-outlined');
      if (span) span.textContent = 'COPIED';
      if (icon) icon.textContent = 'check';
      copyCodeBtn.classList.add('text-emerald-300', 'border-emerald-500/40');
      setTimeout(() => {
        if (span) span.textContent = 'COPY';
        if (icon) icon.textContent = 'content_copy';
        copyCodeBtn.classList.remove('text-emerald-300', 'border-emerald-500/40');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
    return;
  }

  // Copy full message
  const copyMsgBtn = target.closest('.copy-msg-btn') as HTMLButtonElement | null;
  if (copyMsgBtn) {
    const text = copyMsgBtn.dataset.text;
    if (text) {
      await navigator.clipboard.writeText(decodeURIComponent(text));
      const icon = copyMsgBtn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'check';
      setTimeout(() => {
        if (icon) icon.textContent = 'content_copy';
      }, 1500);
    }
    return;
  }

  // Thumbs up / down
  const thumbsUpBtn = target.closest('.thumbs-up-btn');
  if (thumbsUpBtn) {
    thumbsUpBtn.classList.toggle('text-purple-400');
    return;
  }
  const thumbsDownBtn = target.closest('.thumbs-down-btn');
  if (thumbsDownBtn) {
    thumbsDownBtn.classList.toggle('text-rose-400');
    return;
  }

  // Retry / Regenerate
  const retryBtn = target.closest('.retry-msg-btn');
  if (retryBtn && lastUserPrompt) {
    chatPromptInput!.value = lastUserPrompt;
    chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

// Prompt Submission & Token Streaming
chatPromptForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isGenerating) return;

  const promptText = chatPromptInput?.value?.trim() || '';
  if (!promptText) return;

  lastUserPrompt = promptText;

  // Reset input field
  if (chatPromptInput) {
    chatPromptInput.value = '';
    chatPromptInput.style.height = 'auto';
  }

  // Ensure active conversation
  if (!activeConversation) {
    const model = currentModelLabel?.textContent || getOllamaConfig().defaultModel;
    const title = promptText.slice(0, 36).trim() || 'New Session';
    activeConversation = await createConversation(currentUserId, title, model);
    conversations.unshift(activeConversation);
    renderSidebarSessions();
  } else if (activeConversation.title === 'New Session' && currentMessages.length === 0) {
    const title = promptText.slice(0, 36).trim();
    activeConversation.title = title;
    await updateConversationTitle(activeConversation.id, currentUserId, title);
    renderSidebarSessions();
  }

  // Append user message
  const userMsg = await addMessage(activeConversation.id, currentUserId, 'user', promptText);
  currentMessages.push(userMsg);

  if (chatEmptyState) chatEmptyState.classList.add('hidden');
  if (chatErrorCard) chatErrorCard.classList.add('hidden');

  const userEl = renderUserMessageElement(promptText);
  chatMessageList?.appendChild(userEl);
  scrollChatToBottom();

  // Prepare streaming assistant response
  const activeModel = currentModelLabel?.textContent || activeConversation.model || getOllamaConfig().defaultModel;
  const { container: assistantContainer, contentEl } = renderAssistantMessageElement('', activeModel, undefined, true);
  chatMessageList?.appendChild(assistantContainer);
  scrollChatToBottom();

  if (chatStreamingContainer) chatStreamingContainer.classList.remove('hidden');

  isGenerating = true;
  activeAbortController = new AbortController();

  let accumulatedContent = '';

  const messagesPayload: ChatMessage[] = currentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const config = getOllamaConfig();

  await streamOllamaChat({
    host: config.host,
    model: activeModel,
    messages: messagesPayload,
    systemPrompt: config.systemPrompt,
    signal: activeAbortController.signal,
    onToken: (token) => {
      accumulatedContent += token;
      contentEl.innerHTML = renderMarkdownWithCodeBlocks(accumulatedContent) + '<span class="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1 align-middle"></span>';
      scrollChatToBottom();
    },
    onDone: async (finalContent) => {
      contentEl.innerHTML = renderMarkdownWithCodeBlocks(finalContent);
      if (chatStreamingContainer) chatStreamingContainer.classList.add('hidden');
      isGenerating = false;
      activeAbortController = null;

      if (finalContent.trim() && activeConversation) {
        const assistantMsg = await addMessage(activeConversation.id, currentUserId, 'assistant', finalContent);
        currentMessages.push(assistantMsg);
        // Refresh messages view to mount complete action toolbar
        await renderConversationMessages();
      }
      scrollChatToBottom();
    },
    onError: (err) => {
      if (chatStreamingContainer) chatStreamingContainer.classList.add('hidden');
      isGenerating = false;
      activeAbortController = null;

      if (!accumulatedContent) {
        assistantContainer.remove();
      }

      if (chatErrorCard && chatErrorText) {
        chatErrorText.textContent = `${err.message} — Verify Ollama is running on ${config.host} with OLLAMA_ORIGINS="*".`;
        chatErrorCard.classList.remove('hidden');
      }
      scrollChatToBottom();
    },
  });
});

// Stop generating button
btnStopStream?.addEventListener('click', () => {
  if (activeAbortController) {
    activeAbortController.abort();
  }
});

// Retry prompt button
btnRetryPrompt?.addEventListener('click', () => {
  if (lastUserPrompt && chatPromptInput) {
    chatPromptInput.value = lastUserPrompt;
    chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

// ==============================================================================
// Settings Dialog
// ==============================================================================
const settingsModal = document.getElementById('settings-modal');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnTestConnection = document.getElementById('btn-test-connection');
const configHostInput = document.getElementById('config-host-input') as HTMLInputElement | null;
const configModelInput = document.getElementById('config-model-input') as HTMLInputElement | null;
const configSystemPrompt = document.getElementById('config-system-prompt') as HTMLTextAreaElement | null;
const connectionTestResult = document.getElementById('connection-test-result');

function openSettingsDialog() {
  const config = getOllamaConfig();
  if (configHostInput) configHostInput.value = config.host;
  if (configModelInput) configModelInput.value = config.defaultModel;
  if (configSystemPrompt) configSystemPrompt.value = config.systemPrompt;
  if (connectionTestResult) connectionTestResult.classList.add('hidden');
  if (settingsModal) settingsModal.classList.remove('hidden');
}

function closeSettingsDialog() {
  if (settingsModal) settingsModal.classList.add('hidden');
}

btnOpenSettings?.addEventListener('click', openSettingsDialog);
btnCloseSettings?.addEventListener('click', closeSettingsDialog);
btnCancelSettings?.addEventListener('click', closeSettingsDialog);

btnTestConnection?.addEventListener('click', async () => {
  const host = configHostInput?.value?.trim() || 'http://localhost:11434';
  if (connectionTestResult) {
    connectionTestResult.classList.remove('hidden');
    connectionTestResult.className = 'mt-2 text-[11px] p-2.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono';
    connectionTestResult.textContent = 'Testing connection...';
  }

  const { ok, latencyMs, models, error } = await testOllamaConnection(host);

  if (connectionTestResult) {
    if (ok) {
      connectionTestResult.className = 'mt-2 text-[11px] p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-mono';
      connectionTestResult.textContent = `Connected! Latency: ${latencyMs}ms | Models: ${models.join(', ') || 'None'}`;
    } else {
      connectionTestResult.className = 'mt-2 text-[11px] p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 font-mono';
      connectionTestResult.textContent = `Connection failed: ${error || 'Host unreachable'}`;
    }
  }
});

btnSaveSettings?.addEventListener('click', async () => {
  const host = configHostInput?.value?.trim() || 'http://localhost:11434';
  const defaultModel = configModelInput?.value?.trim() || 'qwen3.5:2b';
  const systemPrompt = configSystemPrompt?.value || '';

  saveOllamaConfig({ host, defaultModel, systemPrompt });
  closeSettingsDialog();
  await updateOllamaHealth(host);
});

// ==============================================================================
// Workspace Initialization
// ==============================================================================
let isChatInitialized = false;

async function initChatWorkspace() {
  if (!isChatInitialized) {
    isChatInitialized = true;
    await updateOllamaHealth();
    conversations = await listConversations(currentUserId);
    if (conversations.length > 0) {
      activeConversation = conversations[0];
      selectModel(activeConversation.model);
      currentMessages = await listMessages(activeConversation.id, currentUserId);
    } else {
      activeConversation = null;
      currentMessages = [];
    }
    renderSidebarSessions();
    await renderConversationMessages();
  }
}

// Inspect Supabase Session on Load
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    isAuthenticated = true;
    currentUserId = session.user.id;
    currentUserEmail = session.user.email || 'User';

    const span = googleBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    if (span) {
      span.textContent = `AUTHENTICATED: ${currentUserEmail.split('@')[0]?.toUpperCase()}`;
    }
  }
  syncViewToHash();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    isAuthenticated = true;
    currentUserId = session.user.id;
    currentUserEmail = session.user.email || 'User';

    const span = googleBtn?.querySelector<HTMLSpanElement>('span.font-pixel');
    if (span) {
      span.textContent = `AUTHENTICATED: ${currentUserEmail.split('@')[0]?.toUpperCase()}`;
    }
  } else {
    isAuthenticated = false;
    currentUserId = 'guest-local-user';
    currentUserEmail = 'Guest';
  }
  syncViewToHash();
});

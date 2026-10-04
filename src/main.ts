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

let activeAbortController: AbortController | null = null;
let isGenerating = false;
let lastPromptText = '';

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
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
// Notification & Status Messaging (for Login view)
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
// Ollama Diagnostics & Models Management
// ==============================================================================
const ollamaStatusPill = document.getElementById('ollama-status-pill');
const ollamaStatusDot = document.getElementById('ollama-status-dot');
const ollamaStatusText = document.getElementById('ollama-status-text');
const chatModelSelect = document.getElementById('chat-model-select') as HTMLSelectElement | null;
const telemetryModel = document.getElementById('telemetry-model');
const telemetryHost = document.getElementById('telemetry-host');

async function updateOllamaHealth(customHost?: string) {
  const config = getOllamaConfig();
  const host = customHost || config.host;

  if (telemetryHost) telemetryHost.textContent = host.replace(/^https?:\/\//, '');

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

    if (chatModelSelect && models.length > 0) {
      const currentSelected = chatModelSelect.value || config.defaultModel;
      chatModelSelect.innerHTML = '';
      models.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === currentSelected) opt.selected = true;
        chatModelSelect.appendChild(opt);
      });
      if (telemetryModel) telemetryModel.textContent = chatModelSelect.value || models[0];
    }
  } else {
    if (ollamaStatusText) ollamaStatusText.textContent = 'OFFLINE';
    if (ollamaStatusDot) {
      ollamaStatusDot.className = 'w-2 h-2 rounded-full bg-rose-500';
    }
    console.warn('[Coral_AI] Ollama offline or blocked:', error);
  }
}

if (chatModelSelect) {
  chatModelSelect.addEventListener('change', () => {
    if (telemetryModel) telemetryModel.textContent = chatModelSelect.value;
    if (activeConversation) {
      activeConversation.model = chatModelSelect.value;
    }
  });
}

// ==============================================================================
// Settings Dialog Handlers
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
ollamaStatusPill?.addEventListener('click', openSettingsDialog);
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
      connectionTestResult.textContent = `Connected! Latency: ${latencyMs}ms | Models found: ${models.join(', ') || 'None'}`;
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
// Chat Workspace & Message Rendering
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
const promptCharCount = document.getElementById('prompt-char-count');
const btnClearPrompt = document.getElementById('btn-clear-prompt');

const chatSessionsList = document.getElementById('chat-sessions-list');
const btnNewSession = document.getElementById('btn-new-session');
const btnRefreshSessions = document.getElementById('btn-refresh-sessions');
const sessionCountLabel = document.getElementById('session-count-label');
const storageModeLabel = document.getElementById('storage-mode-label');
const chatUserEmailBadge = document.getElementById('chat-user-email');

function renderUserMessageElement(content: string, isoTimestamp?: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end w-full';
  wrapper.innerHTML = `
    <div class="max-w-[85%] md:max-w-[75%] rounded-2xl p-4 bg-purple-950/60 border border-purple-500/30 text-slate-100 shadow-md">
      <div class="flex items-center justify-between gap-4 mb-1.5 text-[10px] font-mono text-purple-300">
        <span class="font-bold tracking-wider">[USER]</span>
        <span class="text-slate-400 font-mono">${formatTime(isoTimestamp)}</span>
      </div>
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
  wrapper.className = 'flex justify-start w-full';

  const innerCard = document.createElement('div');
  innerCard.className = 'w-full rounded-2xl p-5 md:p-6 bg-[#0e071e]/90 border border-purple-500/25 text-slate-100 shadow-lg relative overflow-hidden';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-4 mb-3 pb-2 border-b border-purple-500/15 text-[10px] font-mono';
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="px-1.5 py-0.5 rounded bg-purple-600 text-white font-pixel text-[9px]">[CORAL_AI]</span>
      <span class="text-purple-300 tracking-wider font-semibold">${escapeHtml(modelName)}</span>
    </div>
    <span class="text-slate-400 font-mono">${formatTime(isoTimestamp)}</span>
  `;

  const bodyEl = document.createElement('div');
  bodyEl.className = 'coral-prose text-sm leading-relaxed';

  if (isLiveStreaming) {
    bodyEl.innerHTML = renderMarkdownWithCodeBlocks(content) + '<span class="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1 align-middle"></span>';
  } else {
    bodyEl.innerHTML = renderMarkdownWithCodeBlocks(content);
  }

  innerCard.appendChild(header);
  innerCard.appendChild(bodyEl);
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
      const el = renderUserMessageElement(msg.content, msg.created_at);
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

function renderSidebarSessions() {
  if (!chatSessionsList) return;
  chatSessionsList.innerHTML = '';

  if (sessionCountLabel) sessionCountLabel.textContent = String(conversations.length);
  if (storageModeLabel) {
    storageModeLabel.textContent = getActiveStorageMode() === 'supabase' ? 'CLOUD SYNC' : 'LOCAL STORAGE';
  }

  if (conversations.length === 0) {
    chatSessionsList.innerHTML = `
      <div class="py-6 px-2 text-center text-slate-500 font-mono text-[11px] leading-relaxed">
        No sessions yet.<br>Click "NEW SESSION" above to start.
      </div>
    `;
    return;
  }

  conversations.forEach((conv) => {
    const isActive = activeConversation?.id === conv.id;
    const item = document.createElement('div');
    item.className = `session-item group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
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

    const deleteBtn = item.querySelector('.delete-session-btn');
    deleteBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteConversation(conv.id, currentUserId);
      conversations = conversations.filter((c) => c.id !== conv.id);
      if (activeConversation?.id === conv.id) {
        activeConversation = conversations[0] || null;
        if (activeConversation) {
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

  const model = chatModelSelect?.value || getOllamaConfig().defaultModel;
  const newConv = await createConversation(currentUserId, 'New Session', model);
  conversations.unshift(newConv);
  activeConversation = newConv;
  currentMessages = [];

  renderSidebarSessions();
  await renderConversationMessages();
  if (chatPromptInput) chatPromptInput.focus();
}

btnNewSession?.addEventListener('click', startNewSession);
btnRefreshSessions?.addEventListener('click', async () => {
  conversations = await listConversations(currentUserId);
  renderSidebarSessions();
});

// Prompt input adjustments
if (chatPromptInput) {
  chatPromptInput.addEventListener('input', () => {
    chatPromptInput.style.height = 'auto';
    chatPromptInput.style.height = `${Math.min(chatPromptInput.scrollHeight, 180)}px`;
    if (promptCharCount) {
      promptCharCount.textContent = `${chatPromptInput.value.length} chars`;
    }
  });

  chatPromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
}

btnClearPrompt?.addEventListener('click', () => {
  if (chatPromptInput) {
    chatPromptInput.value = '';
    chatPromptInput.style.height = 'auto';
    if (promptCharCount) promptCharCount.textContent = '0 chars';
  }
});

// Preset starter prompts
document.querySelectorAll('.starter-prompt-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = (btn as HTMLElement).dataset.prompt;
    if (prompt && chatPromptInput) {
      chatPromptInput.value = prompt;
      chatPromptInput.style.height = 'auto';
      chatPromptInput.style.height = `${Math.min(chatPromptInput.scrollHeight, 180)}px`;
      if (promptCharCount) promptCharCount.textContent = `${prompt.length} chars`;
      chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
});

// 1-Click Copy Code Event Delegation
document.addEventListener('click', async (e) => {
  const target = (e.target as HTMLElement).closest('.copy-code-btn') as HTMLButtonElement | null;
  if (!target) return;

  const rawCode = target.dataset.code;
  if (!rawCode) return;

  try {
    const decoded = decodeURIComponent(rawCode);
    await navigator.clipboard.writeText(decoded);
    const span = target.querySelector('span:last-child');
    const icon = target.querySelector('.material-symbols-outlined');
    if (span) span.textContent = 'COPIED';
    if (icon) icon.textContent = 'check';
    target.classList.add('text-emerald-300', 'border-emerald-500/40');

    setTimeout(() => {
      if (span) span.textContent = 'COPY';
      if (icon) icon.textContent = 'content_copy';
      target.classList.remove('text-emerald-300', 'border-emerald-500/40');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
  }
});

// Submit prompt to Ollama
chatPromptForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isGenerating) return;

  const promptText = chatPromptInput?.value?.trim() || '';
  if (!promptText) return;

  lastPromptText = promptText;

  // Clear input
  if (chatPromptInput) {
    chatPromptInput.value = '';
    chatPromptInput.style.height = 'auto';
    if (promptCharCount) promptCharCount.textContent = '0 chars';
  }

  // Ensure active conversation
  if (!activeConversation) {
    const model = chatModelSelect?.value || getOllamaConfig().defaultModel;
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

  const userEl = renderUserMessageElement(promptText, userMsg.created_at);
  chatMessageList?.appendChild(userEl);
  scrollChatToBottom();

  // Prepare streaming assistant response
  const activeModel = chatModelSelect?.value || activeConversation.model || getOllamaConfig().defaultModel;
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
      }
      scrollChatToBottom();
    },
    onError: (err) => {
      if (chatStreamingContainer) chatStreamingContainer.classList.add('hidden');
      isGenerating = false;
      activeAbortController = null;

      // Remove the live empty assistant bubble if nothing was generated
      if (!accumulatedContent) {
        assistantContainer.remove();
      }

      if (chatErrorCard && chatErrorText) {
        chatErrorText.textContent = `${err.message} — Verify that Ollama is active on ${config.host} and allows origins (OLLAMA_ORIGINS="*" ollama serve).`;
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
  if (lastPromptText && chatPromptInput) {
    chatPromptInput.value = lastPromptText;
    chatPromptForm?.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

// Mobile sidebar toggle
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const chatSidebar = document.getElementById('chat-sidebar');
btnToggleSidebar?.addEventListener('click', () => {
  if (chatSidebar) {
    chatSidebar.classList.toggle('-translate-x-full');
  }
});

// Close sidebar on message container click on mobile
chatMessagesContainer?.addEventListener('click', () => {
  if (window.innerWidth < 768 && chatSidebar && !chatSidebar.classList.contains('-translate-x-full')) {
    chatSidebar.classList.add('-translate-x-full');
  }
});

// ==============================================================================
// Workspace Initialization
// ==============================================================================
let isChatInitialized = false;

async function initChatWorkspace() {
  if (chatUserEmailBadge) chatUserEmailBadge.textContent = currentUserEmail;

  if (!isChatInitialized) {
    isChatInitialized = true;
    await updateOllamaHealth();
    conversations = await listConversations(currentUserId);
    if (conversations.length > 0) {
      activeConversation = conversations[0];
      currentMessages = await listMessages(activeConversation.id, currentUserId);
    } else {
      activeConversation = null;
      currentMessages = [];
    }
    renderSidebarSessions();
    await renderConversationMessages();
  }
}

// Inspect Supabase Session on page load
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

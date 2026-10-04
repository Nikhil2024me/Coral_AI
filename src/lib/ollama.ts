export interface OllamaConfig {
  host: string;
  defaultModel: string;
  systemPrompt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const STORAGE_KEY = 'coral_ai_ollama_config';

const DEFAULT_CONFIG: OllamaConfig = {
  host: 'http://localhost:11434',
  defaultModel: 'qwen3.5:2b',
  systemPrompt: 'You are Coral_AI, an advanced, high-precision technical assistant. Provide clear, accurate, and structured answers.',
};

export function getOllamaConfig(): OllamaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      host: parsed.host?.trim() || DEFAULT_CONFIG.host,
      defaultModel: parsed.defaultModel?.trim() || DEFAULT_CONFIG.defaultModel,
      systemPrompt: parsed.systemPrompt ?? DEFAULT_CONFIG.systemPrompt,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveOllamaConfig(config: Partial<OllamaConfig>): OllamaConfig {
  const current = getOllamaConfig();
  const updated: OllamaConfig = {
    host: config.host !== undefined ? config.host.trim().replace(/\/+$/, '') : current.host,
    defaultModel: config.defaultModel !== undefined ? config.defaultModel.trim() : current.defaultModel,
    systemPrompt: config.systemPrompt !== undefined ? config.systemPrompt : current.systemPrompt,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function testOllamaConnection(hostUrl?: string): Promise<{
  ok: boolean;
  latencyMs?: number;
  models: string[];
  error?: string;
}> {
  const host = (hostUrl || getOllamaConfig().host).replace(/\/+$/, '');
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${host}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        models: [],
        error: `Host responded with HTTP ${res.status} ${res.statusText}`,
      };
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - startTime);
    const models = Array.isArray(data.models) ? data.models.map((m: { name: string }) => m.name) : [];

    return {
      ok: true,
      latencyMs,
      models,
    };
  } catch (err: unknown) {
    let errorMsg = 'Failed to connect to Ollama host.';
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        errorMsg = 'Connection timed out after 6 seconds.';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMsg = 'Network request failed. If accessing via web browser, ensure Ollama allows origins (OLLAMA_ORIGINS="*" ollama serve).';
      } else {
        errorMsg = err.message;
      }
    }
    return {
      ok: false,
      models: [],
      error: errorMsg,
    };
  }
}

export async function fetchOllamaModels(hostUrl?: string): Promise<string[]> {
  const { ok, models } = await testOllamaConnection(hostUrl);
  return ok ? models : [];
}

export interface StreamChatOptions {
  host?: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

export async function streamOllamaChat(options: StreamChatOptions): Promise<void> {
  const {
    host = getOllamaConfig().host,
    model,
    messages,
    systemPrompt,
    signal,
    onToken,
    onDone,
    onError,
  } = options;

  const endpoint = `${host.replace(/\/+$/, '')}/api/chat`;

  const payloadMessages: ChatMessage[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    payloadMessages.push({ role: 'system', content: systemPrompt.trim() });
  }
  for (const m of messages) {
    payloadMessages.push({ role: m.role, content: m.content });
  }

  let fullResponse = '';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson, text/event-stream, application/json',
      },
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      let errDetail = `${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.error) errDetail = errJson.error;
      } catch {
        // Fallback to status text
      }
      throw new Error(`Ollama Error (${errDetail})`);
    }

    if (!response.body) {
      throw new Error('Response body stream is not available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.message?.content) {
            const chunk = parsed.message.content;
            fullResponse += chunk;
            onToken(chunk);
          }
          if (parsed.done) {
            onDone(fullResponse);
            return;
          }
        } catch {
          // Incomplete chunk line, ignore and continue
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.message?.content) {
          const chunk = parsed.message.content;
          fullResponse += chunk;
          onToken(chunk);
        }
      } catch {
        // Ignore
      }
    }

    onDone(fullResponse);
  } catch (err: unknown) {
    if (signal?.aborted) {
      onDone(fullResponse);
      return;
    }
    const errorObj = err instanceof Error ? err : new Error(String(err));
    onError(errorObj);
  }
}

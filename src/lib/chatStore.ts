import { supabase } from './supabase';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

let activeStorageMode: 'supabase' | 'local' = 'supabase';
let hasCheckedSupabase = false;

const LOCAL_CONVERSATIONS_KEY = 'coral_ai_local_conversations';
const LOCAL_MESSAGES_KEY = 'coral_ai_local_messages';

function getLocalConversations(userId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    const all: Conversation[] = raw ? JSON.parse(raw) : [];
    return all.filter((c) => c.user_id === userId);
  } catch {
    return [];
  }
}

function saveLocalConversations(conversations: Conversation[]): void {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    const existing: Conversation[] = raw ? JSON.parse(raw) : [];
    const updatedIds = new Set(conversations.map((c) => c.id));
    const merged = [...conversations, ...existing.filter((c) => !updatedIds.has(c.id))];
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(merged));
  } catch {
    // Local storage full or unavailable
  }
}

function getLocalMessages(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const all: Message[] = raw ? JSON.parse(raw) : [];
    return all.filter((m) => m.conversation_id === conversationId);
  } catch {
    return [];
  }
}

function saveLocalMessage(message: Message): void {
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const all: Message[] = raw ? JSON.parse(raw) : [];
    all.push(message);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(all));
  } catch {
    // Ignore
  }
}

export function getActiveStorageMode(): 'supabase' | 'local' {
  return activeStorageMode;
}

export async function checkStorageCapability(): Promise<'supabase' | 'local'> {
  if (hasCheckedSupabase) return activeStorageMode;
  try {
    const { error } = await supabase.from('conversations').select('id').limit(1);
    if (error) {
      console.warn('[Coral_AI] Supabase conversations table not accessible, using local storage fallback:', error.message);
      activeStorageMode = 'local';
    } else {
      activeStorageMode = 'supabase';
    }
  } catch (err) {
    console.warn('[Coral_AI] Supabase storage check failed, using local fallback:', err);
    activeStorageMode = 'local';
  }
  hasCheckedSupabase = true;
  return activeStorageMode;
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  await checkStorageCapability();

  if (activeStorageMode === 'supabase') {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data as Conversation[]) || [];
    } catch (err) {
      console.warn('[Coral_AI] Falling back to local conversations:', err);
      activeStorageMode = 'local';
    }
  }

  return getLocalConversations(userId).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function createConversation(
  userId: string,
  title: string,
  model: string
): Promise<Conversation> {
  await checkStorageCapability();
  const now = new Date().toISOString();

  if (activeStorageMode === 'supabase') {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title,
          model,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Conversation;
    } catch (err) {
      console.warn('[Coral_AI] Supabase insert failed, fallback to local:', err);
      activeStorageMode = 'local';
    }
  }

  const localConv: Conversation = {
    id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    user_id: userId,
    title,
    model,
    created_at: now,
    updated_at: now,
  };

  const existing = getLocalConversations(userId);
  saveLocalConversations([localConv, ...existing]);
  return localConv;
}

export async function updateConversationTitle(
  conversationId: string,
  userId: string,
  title: string
): Promise<void> {
  const now = new Date().toISOString();

  if (activeStorageMode === 'supabase') {
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ title, updated_at: now })
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (!error) return;
    } catch (err) {
      console.warn('[Coral_AI] Supabase title update failed:', err);
    }
  }

  const localList = getLocalConversations(userId);
  const found = localList.find((c) => c.id === conversationId);
  if (found) {
    found.title = title;
    found.updated_at = now;
    saveLocalConversations(localList);
  }
}

export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  if (activeStorageMode === 'supabase') {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (!error) return;
    } catch (err) {
      console.warn('[Coral_AI] Supabase delete failed:', err);
    }
  }

  const localList = getLocalConversations(userId).filter((c) => c.id !== conversationId);
  saveLocalConversations(localList);

  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (raw) {
      const all: Message[] = JSON.parse(raw);
      const filtered = all.filter((m) => m.conversation_id !== conversationId);
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }
}

export async function listMessages(
  conversationId: string,
  userId: string
): Promise<Message[]> {
  await checkStorageCapability();

  if (activeStorageMode === 'supabase') {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data as Message[]) || [];
    } catch (err) {
      console.warn('[Coral_AI] Supabase list messages failed, using local:', err);
    }
  }

  return getLocalMessages(conversationId).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function addMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<Message> {
  await checkStorageCapability();
  const now = new Date().toISOString();

  if (activeStorageMode === 'supabase') {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role,
          content,
          created_at: now,
        })
        .select()
        .single();

      if (!error && data) {
        // Touch conversation updated_at
        await supabase
          .from('conversations')
          .update({ updated_at: now })
          .eq('id', conversationId);

        return data as Message;
      }
    } catch (err) {
      console.warn('[Coral_AI] Supabase message insert failed, using local:', err);
    }
  }

  const msg: Message = {
    id: `local-msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    created_at: now,
  };

  saveLocalMessage(msg);

  const localList = getLocalConversations(userId);
  const conv = localList.find((c) => c.id === conversationId);
  if (conv) {
    conv.updated_at = now;
    saveLocalConversations(localList);
  }

  return msg;
}

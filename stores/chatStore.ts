import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface ChatStoreState {
  messages: Message[];
  activeMatchId: string | null;
  isLoading: boolean;
  error: string | null;
  subscription: RealtimeChannel | null;

  fetchMessages: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, content: string) => Promise<void>;
  markAsRead: (matchId: string) => Promise<void>;
  subscribe: (matchId: string) => void;
  unsubscribe: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messages: [],
  activeMatchId: null,
  isLoading: false,
  error: null,
  subscription: null,

  fetchMessages: async (matchId: string) => {
    set({ isLoading: true, error: null, activeMatchId: matchId });
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({ messages: (data as Message[]) ?? [] });
    } catch (error) {
      console.error('Error fetching messages:', error);
      set({ error: 'chat.errorFetching' });
    } finally {
      set({ isLoading: false });
    }
  },

  sendMessage: async (matchId: string, content: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: user.id,
        content,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      set({ error: 'chat.errorSending' });
    }
  },

  markAsRead: async (matchId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  subscribe: (matchId: string) => {
    // Clean up any existing subscription
    get().unsubscribe();

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          set((state) => ({
            messages: [...state.messages, newMessage],
          }));
        }
      )
      .subscribe();

    set({ subscription: channel });
  },

  unsubscribe: () => {
    const { subscription } = get();
    if (subscription) {
      supabase.removeChannel(subscription);
      set({ subscription: null });
    }
  },

  reset: () => {
    get().unsubscribe();
    set({
      messages: [],
      activeMatchId: null,
      isLoading: false,
      error: null,
      subscription: null,
    });
  },
}));

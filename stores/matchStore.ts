import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface MatchUser {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface Match {
  id: string;
  otherUser: MatchUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  created_at: string;
}

interface MatchQueryRow {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: string;
  user_a: MatchUser | MatchUser[] | null;
  user_b: MatchUser | MatchUser[] | null;
}

interface MatchStoreState {
  matches: Match[];
  isLoading: boolean;
  error: string | null;

  fetchMatches: () => Promise<void>;
  reset: () => void;
}

export const useMatchStore = create<MatchStoreState>((set) => ({
  matches: [],
  isLoading: false,
  error: null,

  fetchMatches: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: matchesData, error } = await supabase
        .from('matches')
        .select(`
          id,
          user_a_id,
          user_b_id,
          created_at,
          user_a:profiles!matches_user_a_id_fkey(id, name, avatar_url),
          user_b:profiles!matches_user_b_id_fkey(id, name, avatar_url)
        `)
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const matches: Match[] = await Promise.all(
        (matchesData ?? []).map(async (match: MatchQueryRow) => {
          const rawOther =
            match.user_a_id === user.id ? match.user_b : match.user_a;
          const otherUser: MatchUser = Array.isArray(rawOther)
            ? rawOther[0] ?? { id: '', name: null, avatar_url: null }
            : rawOther ?? { id: '', name: null, avatar_url: null };

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', match.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          return {
            id: match.id,
            otherUser,
            lastMessage: lastMsg?.content ?? null,
            lastMessageAt: lastMsg?.created_at ?? null,
            unreadCount: count ?? 0,
            created_at: match.created_at,
          };
        })
      );

      // Sort by last activity (last message or match creation)
      matches.sort((a, b) => {
        const aDate = a.lastMessageAt ?? a.created_at;
        const bDate = b.lastMessageAt ?? b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      set({ matches });
    } catch (error) {
      console.error('Error fetching matches:', error);
      set({ error: 'matches.errorFetching' });
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => set({ matches: [], isLoading: false, error: null }),
}));

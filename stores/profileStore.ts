import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Profile } from './authStore';

interface MatchResult {
  matched: boolean;
  match_id?: string;
}

interface ProfileStoreState {
  candidates: Profile[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  matchResult: MatchResult | null;

  fetchCandidates: () => Promise<void>;
  likeProfile: (targetId: string) => Promise<void>;
  passProfile: (targetId: string) => Promise<void>;
  clearMatchResult: () => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStoreState>((set, get) => ({
  candidates: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  matchResult: null,

  fetchCandidates: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_daily_candidates', {
        candidate_limit: 10,
      });

      if (error) throw error;

      set({ candidates: (data as Profile[]) ?? [], currentIndex: 0 });
    } catch (error) {
      console.error('Error fetching candidates:', error);
      set({ error: 'today.errorFetching' });
    } finally {
      set({ isLoading: false });
    }
  },

  likeProfile: async (targetId: string) => {
    try {
      const { data, error } = await supabase.rpc('like_profile', {
        target_user_id: targetId,
      });

      if (error) throw error;

      const result = data as MatchResult;

      if (result.matched) {
        set({ matchResult: result });
      }

      set((state) => ({ currentIndex: state.currentIndex + 1 }));
    } catch (error) {
      console.error('Error liking profile:', error);
    }
  },

  passProfile: async (targetId: string) => {
    try {
      const { error } = await supabase.from('daily_profiles').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        target_id: targetId,
        action: 'pass',
        action_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      set((state) => ({ currentIndex: state.currentIndex + 1 }));
    } catch (error) {
      console.error('Error passing profile:', error);
    }
  },

  clearMatchResult: () => set({ matchResult: null }),

  reset: () =>
    set({
      candidates: [],
      currentIndex: 0,
      isLoading: false,
      error: null,
      matchResult: null,
    }),
}));

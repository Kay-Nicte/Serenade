import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorReporting';

interface BoostState {
  availableBoosts: number;
  boostedUntil: Date | null;
  secondsRemaining: number;
  fetch: () => Promise<void>;
  activateBoost: () => Promise<{ success: boolean; error?: string }>;
  grantWeeklyIfNeeded: () => Promise<void>;
  reset: () => void;
}

let countdownInterval: ReturnType<typeof setInterval> | null = null;

function startCountdown(boostedUntil: Date, updateSeconds: (s: number) => void) {
  if (countdownInterval) clearInterval(countdownInterval);
  const tick = () => {
    const remaining = Math.max(0, Math.floor((boostedUntil.getTime() - Date.now()) / 1000));
    updateSeconds(remaining);
    if (remaining === 0 && countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  };
  tick();
  countdownInterval = setInterval(tick, 1000);
}

export const useBoostStore = create<BoostState>((set, get) => ({
  availableBoosts: 0,
  boostedUntil: null,
  secondsRemaining: 0,

  fetch: async () => {
    try {
      const { data: streak } = await supabase
        .from('user_streaks')
        .select('available_boosts')
        .single();
      const { data: profile } = await supabase
        .from('profiles')
        .select('boosted_until')
        .single();

      const boostedUntil = profile?.boosted_until ? new Date(profile.boosted_until) : null;
      const isActive = boostedUntil ? boostedUntil > new Date() : false;

      set({
        availableBoosts: streak?.available_boosts ?? 0,
        boostedUntil: isActive ? boostedUntil : null,
        secondsRemaining: isActive ? Math.max(0, Math.floor((boostedUntil!.getTime() - Date.now()) / 1000)) : 0,
      });

      if (isActive && boostedUntil) {
        startCountdown(boostedUntil, (s) => set({ secondsRemaining: s }));
      }
    } catch (e) {
      reportError(e, { source: 'boostStore.fetch' });
    }
  },

  activateBoost: async () => {
    try {
      const { data, error } = await supabase.rpc('activate_boost');
      if (error) throw error;
      const result = data as { success?: boolean; error?: string; boosted_until?: string };
      if (result.error) return { success: false, error: result.error };

      const boostedUntil = result.boosted_until ? new Date(result.boosted_until) : null;
      set((state) => ({
        availableBoosts: Math.max(0, state.availableBoosts - 1),
        boostedUntil,
        secondsRemaining: boostedUntil ? Math.max(0, Math.floor((boostedUntil.getTime() - Date.now()) / 1000)) : 0,
      }));
      if (boostedUntil) {
        startCountdown(boostedUntil, (s) => set({ secondsRemaining: s }));
      }
      return { success: true };
    } catch (e) {
      reportError(e, { source: 'boostStore.activateBoost' });
      return { success: false, error: 'unknown' };
    }
  },

  grantWeeklyIfNeeded: async () => {
    try {
      await supabase.rpc('maybe_grant_weekly_boost');
      await get().fetch();
    } catch (e) {
      reportError(e, { source: 'boostStore.grantWeeklyIfNeeded' });
    }
  },

  reset: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    set({ availableBoosts: 0, boostedUntil: null, secondsRemaining: 0 });
  },
}));

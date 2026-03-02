import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorReporting';
import * as auth from '@/lib/auth';
import { useProfileStore } from './profileStore';
import { useMatchStore } from './matchStore';
import { useChatStore } from './chatStore';
import { usePhotoStore } from './photoStore';
import { useDiscoveryStore } from './discoveryStore';
import { useBlockStore } from './blockStore';
import { useDailyStatsStore } from './dailyStatsStore';
import { useVerificationStore } from './verificationStore';
import { usePromptStore } from './promptStore';
import { showToast } from './toastStore';
import i18n from '@/i18n';
import type { Orientation, LookingFor } from '@/constants/config';

export interface Profile {
  id: string;
  name: string | null;
  birth_date: string | null;
  bio: string | null;
  orientation: Orientation[] | null;
  looking_for: LookingFor[] | null;
  avatar_url: string | null;
  is_profile_complete: boolean;
  is_admin: boolean;
  is_premium: boolean;
  premium_until: string | null;
  language_preference: string | null;
  interests: string[] | null;
  children: string | null;
  zodiac: string | null;
  zodiac_ascendant: string | null;
  pets: string[] | null;
  smoking: string | null;
  drinking: string | null;
  height_cm: number | null;
  hogwarts_house: string | null;
  hometown: string | null;
  is_verified: boolean;
  verification_status: string;
  created_at: string;
  updated_at: string;
  distance_km?: number | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  isVerified: boolean;
  isPasswordRecovery: boolean;
  initialize: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  forceReset: () => void;
  clearPasswordRecovery: () => void;
}

// Supabase may return text[] as PostgreSQL literal "{val1,val2}" or as an array
// whose elements still contain braces/quotes. This normalizes all cases.
function normalizeArray(val: unknown): string[] | null {
  if (val == null) return null;
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      const s = String(v).replace(/^\{|\}$/g, '');
      const parts = s.includes(',') ? s.split(',') : [s];
      return parts.map((p) => p.replace(/"/g, '').trim()).filter(Boolean);
    });
  }
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    const inner = val.slice(1, -1);
    return inner ? inner.split(',').map((s) => s.replace(/"/g, '').trim()) : [];
  }
  return [String(val)];
}

function normalizeProfile(data: any): Profile {
  return {
    ...data,
    orientation: normalizeArray(data.orientation),
    looking_for: normalizeArray(data.looking_for),
    interests: normalizeArray(data.interests),
    pets: normalizeArray(data.pets),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileComplete: false,
  isVerified: false,
  isPasswordRecovery: false,

  initialize: async () => {
    try {
      const session = await auth.getSession();
      set({ session, user: session?.user ?? null });

      if (session?.user) {
        await get().fetchProfile();
      }
    } catch {
      // Session expired or invalid
    } finally {
      set({ isLoading: false });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null });
      if (event === 'PASSWORD_RECOVERY') {
        set({ isPasswordRecovery: true });
      }
      if (session?.user) {
        await get().fetchProfile();
        if (event === 'USER_UPDATED' && session.user.email_confirmed_at) {
          showToast(i18n.t('auth.emailVerified'), 'success', 5000);
        }
      } else {
        set({ profile: null, isProfileComplete: false });
      }
    });
  },

  fetchProfile: async () => {
    const user = get().user;
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      reportError(error, { source: 'authStore.fetchProfile' });
      return;
    }

    if (data?.language_preference) {
      const i18n = (await import('@/i18n')).default;
      await i18n.changeLanguage(data.language_preference);
    }

    set({
      profile: normalizeProfile(data),
      isProfileComplete: data?.is_profile_complete ?? false,
      isVerified: data?.is_verified ?? false,
    });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    await get().fetchProfile();
  },

  signOut: async () => {
    try {
      const { updatePresence } = await import('@/lib/presence');
      await updatePresence(false);
    } catch {
      // Presence cleanup is best-effort
    }
    try {
      const { removePushTokenFromServer } = await import('@/lib/notifications');
      await removePushTokenFromServer();
    } catch {
      // Push token cleanup is best-effort; don't block sign out
    }
    try {
      const { logoutUser } = await import('@/lib/purchases');
      await logoutUser();
    } catch {
      // RevenueCat cleanup is best-effort
    }
    try {
      await auth.signOut();
    } catch {
      // Sign out may fail if session is already invalid; force reset anyway
    }
    get().forceReset();
  },

  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),

  forceReset: () => {
    useProfileStore.getState().reset();
    useMatchStore.getState().reset();
    useChatStore.getState().reset();
    usePhotoStore.getState().reset();
    useDiscoveryStore.getState().reset();
    useBlockStore.getState().reset();
    useDailyStatsStore.getState().reset();
    useVerificationStore.getState().reset();
    usePromptStore.getState().reset();
    // Reset language to device default
    const { getLocales } = require('expo-localization');
    const deviceLang = getLocales()[0]?.languageCode ?? 'en';
    const supported = ['es', 'en', 'eu', 'ca', 'fr', 'it', 'gl'];
    i18n.changeLanguage(supported.includes(deviceLang) ? deviceLang : 'en');
    set({
      session: null,
      user: null,
      profile: null,
      isProfileComplete: false,
      isVerified: false,
    });
  },
}));

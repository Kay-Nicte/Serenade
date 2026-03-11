import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import * as auth from '@/lib/auth';
import { useProfileStore } from './profileStore';
import { useMatchStore } from './matchStore';
import { useChatStore } from './chatStore';
import { usePhotoStore } from './photoStore';
import type { Orientation, LookingFor } from '@/constants/config';

export interface Profile {
  id: string;
  name: string | null;
  birth_date: string | null;
  bio: string | null;
  orientation: Orientation | null;
  looking_for: LookingFor | null;
  avatar_url: string | null;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  initialize: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isProfileComplete: false,

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
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        await get().fetchProfile();
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
      console.error('Error fetching profile:', error);
      return;
    }

    set({
      profile: data as Profile,
      isProfileComplete: data?.is_profile_complete ?? false,
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
    const { removePushTokenFromServer } = await import('@/lib/notifications');
    await removePushTokenFromServer();
    await auth.signOut();
    useProfileStore.getState().reset();
    useMatchStore.getState().reset();
    useChatStore.getState().reset();
    usePhotoStore.getState().reset();
    set({
      session: null,
      user: null,
      profile: null,
      isProfileComplete: false,
    });
  },
}));

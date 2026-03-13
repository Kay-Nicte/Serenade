import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorReporting';
import * as Location from 'expo-location';

export interface Plan {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string | null;
  title: string;
  description: string | null;
  category: 'viajes' | 'ocio' | 'cultura';
  location_name: string;
  event_date: string;
  max_attendees: number | null;
  attendee_count: number;
  is_joined: boolean;
  is_creator: boolean;
  created_at: string;
  distance_km: number | null;
}

export type PlanCategory = 'todos' | 'cerca' | 'viajes' | 'ocio' | 'cultura';

interface CreatePlanData {
  title: string;
  description?: string | null;
  category: 'viajes' | 'ocio' | 'cultura';
  location_name: string;
  latitude?: number;
  longitude?: number;
  event_date: string;
  max_attendees?: number | null;
}

interface PlansState {
  plans: Plan[];
  loading: boolean;
  category: PlanCategory;
  fetchPlans: () => Promise<void>;
  joinPlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
  leavePlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
  createPlan: (data: CreatePlanData) => Promise<{ success: boolean; error?: string }>;
  deletePlan: (planId: string) => Promise<{ success: boolean; error?: string }>;
  setCategory: (category: PlanCategory) => Promise<void>;
  reset: () => void;
}

export const usePlansStore = create<PlansState>((set, get) => ({
  plans: [],
  loading: false,
  category: 'todos',

  fetchPlans: async () => {
    set({ loading: true });
    try {
      const { category } = get();

      let lat: number | undefined;
      let lng: number | undefined;

      if (category === 'cerca') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let position = await Location.getLastKnownPositionAsync();
          if (!position) {
            position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
          }
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        }
      }

      const params: Record<string, unknown> = {};
      if (category !== 'todos' && category !== 'cerca') {
        params.p_category = category;
      }
      if (lat !== undefined && lng !== undefined) {
        params.p_near_lat = lat;
        params.p_near_lng = lng;
      }

      const { data, error } = await supabase.rpc('get_plans', params);
      if (error) throw error;

      set({ plans: (data as Plan[]) ?? [] });
    } catch (e) {
      reportError(e, { source: 'plansStore.fetchPlans' });
    } finally {
      set({ loading: false });
    }
  },

  joinPlan: async (planId: string) => {
    try {
      const { data, error } = await supabase.rpc('join_plan', { p_plan_id: planId });
      if (error) throw error;

      set((state) => ({
        plans: state.plans.map((p) =>
          p.id === planId
            ? { ...p, is_joined: true, attendee_count: p.attendee_count + 1 }
            : p
        ),
      }));
      return { success: true };
    } catch (e) {
      reportError(e, { source: 'plansStore.joinPlan' });
      const msg = (e as any)?.message ?? (e as Error).message ?? '';
      return { success: false, error: msg };
    }
  },

  leavePlan: async (planId: string) => {
    try {
      const { data, error } = await supabase.rpc('leave_plan', { p_plan_id: planId });
      if (error) throw error;

      set((state) => ({
        plans: state.plans.map((p) =>
          p.id === planId
            ? { ...p, is_joined: false, attendee_count: Math.max(0, p.attendee_count - 1) }
            : p
        ),
      }));
      return { success: true };
    } catch (e) {
      reportError(e, { source: 'plansStore.leavePlan' });
      return { success: false, error: (e as Error).message };
    }
  },

  createPlan: async (data: CreatePlanData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const insertData: Record<string, unknown> = {
        creator_id: userData.user.id,
        title: data.title,
        description: data.description ?? null,
        category: data.category,
        location_name: data.location_name,
        event_date: data.event_date,
        max_attendees: data.max_attendees ?? null,
      };

      if (data.latitude != null && data.longitude != null) {
        insertData.location = `POINT(${data.longitude} ${data.latitude})`;
      }

      const { error } = await supabase.from('plans').insert(insertData);
      if (error) {
        console.error('[Plans] Create error:', JSON.stringify(error));
        throw error;
      }

      await get().fetchPlans();
      return { success: true };
    } catch (e) {
      reportError(e, { source: 'plansStore.createPlan' });
      return { success: false, error: (e as Error).message };
    }
  },

  deletePlan: async (planId: string) => {
    try {
      const { error } = await supabase.rpc('delete_plan', { p_plan_id: planId });
      if (error) {
        console.error('[Plans] Delete error:', JSON.stringify(error));
        throw error;
      }

      await get().fetchPlans();
      return { success: true };
    } catch (e) {
      reportError(e, { source: 'plansStore.deletePlan' });
      return { success: false, error: (e as Error).message };
    }
  },

  setCategory: async (category: PlanCategory) => {
    set({ category });
    await get().fetchPlans();
  },

  reset: () => {
    set({ plans: [], loading: false, category: 'todos' });
  },
}));

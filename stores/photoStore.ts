import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorReporting';
import { uploadPhoto, deletePhoto, getPhotoUrl } from '@/lib/storage';

export interface Photo {
  id: string;
  user_id: string;
  storage_path: string;
  position: number;
  created_at: string;
}

interface PhotoStoreState {
  photos: Photo[];
  isLoading: boolean;
  error: string | null;

  fetchPhotos: (userId: string) => Promise<void>;
  addPhoto: (userId: string, uri: string, position: number) => Promise<void>;
  removePhoto: (photo: Photo) => Promise<void>;
  reorderPhotos: (userId: string, orderedPhotos: Photo[]) => Promise<void>;
  reset: () => void;
}

export const usePhotoStore = create<PhotoStoreState>((set, get) => ({
  photos: [],
  isLoading: false,
  error: null,

  fetchPhotos: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId)
        .order('position');

      if (error) throw error;
      set({ photos: (data as Photo[]) ?? [] });
    } catch (error) {
      reportError(error, { source: 'photoStore.fetchPhotos' });
      set({ error: 'profile.errorLoadingPhotos' });
    } finally {
      set({ isLoading: false });
    }
  },

  addPhoto: async (userId: string, uri: string, position: number) => {
    try {
      const storagePath = await uploadPhoto(userId, uri, position);
      const publicUrl = getPhotoUrl(storagePath);

      // Upsert into photos table (handles position conflict)
      const { error } = await supabase
        .from('photos')
        .upsert(
          { user_id: userId, storage_path: storagePath, position },
          { onConflict: 'user_id,position' }
        );

      if (error) throw error;

      // If position 0, update avatar_url on profiles
      if (position === 0) {
        await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', userId);
      }

      await get().fetchPhotos(userId);
    } catch (error) {
      reportError(error, { source: 'photoStore.addPhoto' });
      throw error;
    }
  },

  removePhoto: async (photo: Photo) => {
    try {
      // Delete from storage
      await deletePhoto(photo.storage_path);

      // Delete from photos table
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      // If position 0, clear avatar_url
      if (photo.position === 0) {
        await supabase
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', photo.user_id);
      }

      set({ photos: get().photos.filter((p) => p.id !== photo.id) });
    } catch (error) {
      reportError(error, { source: 'photoStore.removePhoto' });
      throw error;
    }
  },

  reorderPhotos: async (userId: string, orderedPhotos: Photo[]) => {
    const previous = get().photos;

    try {
      const photoIds = orderedPhotos.map((p) => p.id);
      const positions = orderedPhotos.map((_, i) => i);

      const { error } = await supabase.rpc('reorder_photos', {
        p_photo_ids: photoIds,
        p_positions: positions,
      });
      if (error) throw error;

      // Update avatar_url
      const newFirst = orderedPhotos[0];
      if (newFirst) {
        await supabase
          .from('profiles')
          .update({ avatar_url: getPhotoUrl(newFirst.storage_path) })
          .eq('id', userId);
      }

      // Re-fetch to ensure consistency with DB
      await get().fetchPhotos(userId);
    } catch (error) {
      set({ photos: previous });
      reportError(error, { source: 'photoStore.reorderPhotos' });
    }
  },

  reset: () => set({ photos: [], isLoading: false, error: null }),
}));

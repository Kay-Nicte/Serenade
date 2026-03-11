import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
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

  fetchPhotos: (userId: string) => Promise<void>;
  addPhoto: (userId: string, uri: string, position: number) => Promise<void>;
  removePhoto: (photo: Photo) => Promise<void>;
  reset: () => void;
}

export const usePhotoStore = create<PhotoStoreState>((set, get) => ({
  photos: [],
  isLoading: false,

  fetchPhotos: async (userId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId)
        .order('position');

      if (error) throw error;
      set({ photos: (data as Photo[]) ?? [] });
    } catch (error) {
      console.error('Error fetching photos:', error);
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
      console.error('Error adding photo:', error);
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
      console.error('Error removing photo:', error);
      throw error;
    }
  },

  reset: () => set({ photos: [], isLoading: false }),
}));

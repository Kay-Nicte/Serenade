import { useEffect } from 'react';
import { usePhotoStore } from '@/stores/photoStore';

export function usePhotos(userId: string | undefined) {
  const { photos, isLoading, fetchPhotos, addPhoto, removePhoto } =
    usePhotoStore();

  useEffect(() => {
    if (userId) {
      fetchPhotos(userId);
    }
  }, [userId]);

  return { photos, isLoading, addPhoto, removePhoto, fetchPhotos };
}

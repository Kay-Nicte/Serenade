import { useEffect, useRef } from 'react';
import {
  initializePushNotifications,
  setupNotificationResponseListener,
} from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';

export function useNotifications() {
  const isProfileComplete = useAuthStore((s) => s.isProfileComplete);
  const session = useAuthStore((s) => s.session);
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!session || !isProfileComplete) return;

    initializePushNotifications();

    setupNotificationResponseListener().then((listener) => {
      responseListenerRef.current = listener;
    });

    return () => {
      responseListenerRef.current?.remove();
    };
  }, [session, isProfileComplete]);
}

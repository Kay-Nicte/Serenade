import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from './supabase';

let isHandlerConfigured = false;

async function configureNotificationHandler() {
  if (isHandlerConfigured) return;
  isHandlerConfigured = true;

  try {
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;

        const { useChatStore } = await import('@/stores/chatStore');
        const activeMatchId = useChatStore.getState().activeMatchId;

        if (data?.type === 'new_message' && data?.match_id === activeMatchId) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }

        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });
  } catch {
    // expo-notifications not available (e.g. Expo Go limitations)
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');

    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E6A8B4',
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function savePushTokenToServer(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('push_tokens').upsert(
    {
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

export async function removePushTokenFromServer(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('push_tokens').delete().eq('user_id', user.id);
}

export async function setupNotificationResponseListener(): Promise<{
  remove: () => void;
} | null> {
  try {
    const Notifications = await import('expo-notifications');

    return Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.match_id) {
          router.push(`/(tabs)/chat/${data.match_id}`);
        }
      }
    );
  } catch {
    return null;
  }
}

export async function initializePushNotifications(): Promise<void> {
  try {
    await configureNotificationHandler();

    const token = await registerForPushNotificationsAsync();
    if (token) {
      await savePushTokenToServer(token);
    }
  } catch {
    // Notifications not available, silently ignore
  }
}

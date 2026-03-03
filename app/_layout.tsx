import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useColors } from '@/hooks/useColors';
import { useThemeStore } from '@/stores/themeStore';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocation } from '@/hooks/useLocation';
import { usePresence } from '@/hooks/usePresence';
import { useStreak } from '@/hooks/useStreak';
import { initPurchases, identifyUser } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBlockStore } from '@/stores/blockStore';
import { useBoostStore } from '@/stores/boostStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Toast } from '@/components/Toast';
import { useToastStore } from '@/stores/toastStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import '@/i18n';

SplashScreen.preventAutoHideAsync();

async function extractSessionFromUrl(url: string) {
  if (!url.includes('reset-password')) return;

  const parsed = new URL(url);
  const fragment = parsed.hash.substring(1);
  const params = new URLSearchParams(fragment);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isProfileComplete } = useAuth();
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useNotifications();
  useLocation();
  usePresence();
  useStreak();

  useEffect(() => {
    initPurchases();
  }, []);

  // Handle deep links for password recovery
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) extractSessionFromUrl(url);
    });

    const subscription = Linking.addEventListener('url', (event) => {
      extractSessionFromUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      useBlockStore.getState().fetchBlockedUsers();
      // Identify user in RevenueCat for subscription tracking
      const session = useAuthStore.getState().session;
      if (session?.user?.id) {
        identifyUser(session.user.id);
      }
      // Boost: fetch current state and grant weekly boost if premium
      const profile = useAuthStore.getState().profile;
      if (profile?.is_premium) {
        useBoostStore.getState().grantWeeklyIfNeeded();
      } else {
        useBoostStore.getState().fetch();
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    if (!isReady) {
      setIsReady(true);
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inCompleteProfile = segments[0] === 'complete-profile';
    const inResetPassword = segments[0] === 'reset-password';
    const inPublicScreen =
      segments[0] === 'terms-of-service' || segments[0] === 'privacy-policy';

    // During password recovery, always navigate to reset-password
    if (isPasswordRecovery && isAuthenticated && !inResetPassword) {
      router.replace('/reset-password');
    } else if (!isAuthenticated && !inAuthGroup && !inPublicScreen) {
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && !isProfileComplete && !inCompleteProfile && !inResetPassword) {
      router.replace('/complete-profile');
    } else if (isAuthenticated && isProfileComplete && (inAuthGroup || inCompleteProfile)) {
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, isProfileComplete, isPasswordRecovery, segments, isReady, router]);

  const Colors = useColors();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function GlobalToast() {
  const { visible, message, variant, duration, onPress, dismiss } = useToastStore();
  return <Toast visible={visible} message={message} variant={variant} duration={duration} onDismiss={dismiss} onPress={onPress} />;
}

function GlobalConfirmDialog() {
  const { t } = useTranslation();
  return <ConfirmDialog defaultConfirmLabel={t('common.done')} defaultCancelLabel={t('common.cancel')} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const { isConnected } = useNetworkStatus();
  const theme = useThemeStore((s) => s.theme);
  const Colors = useColors();

  if (!fontsLoaded) return null;

  const statusBarStyle = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'auto';

  return (
    <ErrorBoundary>
      {!isConnected && <OfflineBanner />}
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="discovery-preferences" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="admin-profile" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="terms-of-service" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="match-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="verify-identity" options={{ presentation: 'modal' }} />
          <Stack.Screen name="admin-verification" />
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
          <Stack.Screen name="buy-boost" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style={statusBarStyle} />
      </AuthGuard>
      <GlobalToast />
      <GlobalConfirmDialog />
    </ErrorBoundary>
  );
}

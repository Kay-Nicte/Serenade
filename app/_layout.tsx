import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, useGlobalSearchParams } from 'expo-router';
import { useFonts, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import ExpoFullscreenSplash, { type SplashScreenRef } from 'expo-fullscreen-splash';
import * as Linking from 'expo-linking';
import { SplashContent } from '@/components/FullscreenSplash';
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
import { useToastStore, showToast } from '@/stores/toastStore';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import '@/i18n';

SplashScreen.preventAutoHideAsync();

async function extractSessionFromUrl(url: string) {
  console.log('[DeepLink] extractSessionFromUrl called with:', url);

  // Parse query params and fragment manually (new URL() can fail with custom schemes on Hermes)
  const queryString = url.split('?')[1]?.split('#')[0] ?? '';
  const fragment = url.split('#')[1] ?? '';
  const queryParams = new URLSearchParams(queryString);
  const code = queryParams.get('code');

  console.log('[DeepLink] Parsed → code:', !!code, 'fragment length:', fragment.length);

  // PKCE flow: Supabase v2 sends a ?code= parameter for email actions
  // (password reset, magic links, email verification)
  if (code) {
    console.log('[DeepLink] PKCE code found:', code.substring(0, 10) + '...');
    if (url.includes('reset-password')) {
      useAuthStore.getState().setPasswordRecovery();
      console.log('[DeepLink] Password recovery flag set');
    }
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (result.error) {
      console.log('[DeepLink] exchangeCodeForSession ERROR:', result.error.message);
    } else {
      console.log('[DeepLink] exchangeCodeForSession SUCCESS, user:', result.data.user?.id);
    }
    return;
  }

  // Implicit flow: tokens in hash fragment (used by OAuth redirects)
  if (!fragment) {
    console.log('[DeepLink] No code or fragment, ignoring URL');
    return;
  }

  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) {
    console.log('[DeepLink] Fragment found but no tokens');
    return;
  }

  console.log('[DeepLink] Implicit flow tokens found');
  if (params.get('type') === 'recovery' || url.includes('reset-password')) {
    useAuthStore.getState().setPasswordRecovery();
    console.log('[DeepLink] Password recovery flag set');
  }

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  console.log('[DeepLink] setSession result:', error?.message ?? 'success');
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isProfileComplete, isProfileFetched } = useAuth();
  const isPasswordRecovery = useAuthStore((s) => s.isPasswordRecovery);
  const segments = useSegments();
  const globalParams = useGlobalSearchParams();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(false);
  const exchangedRef = useRef(false);

  useNotifications();
  useLocation();
  usePresence();
  useStreak();

  useEffect(() => {
    initPurchases();
  }, []);

  // Exchange PKCE code when expo-router delivers it via params (deep link)
  useEffect(() => {
    const code = globalParams.code as string | undefined;
    const seg = segments[0] as string | undefined;
    if (!code || exchangedRef.current || seg !== 'reset-password') return;
    exchangedRef.current = true;
    console.log('[AuthGuard] PKCE code found in global params, exchanging...');
    setExchangingCode(true);
    (async () => {
      try {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          console.log('[AuthGuard] PKCE exchange error:', result.error.message);
        } else {
          console.log('[AuthGuard] PKCE exchange success, user:', result.data.user?.id);
          useAuthStore.getState().setPasswordRecovery();
        }
      } catch (e) {
        console.log('[AuthGuard] PKCE exchange exception:', e);
      } finally {
        setExchangingCode(false);
      }
    })();
  }, [globalParams.code, segments]);

  // Handle deep links for password recovery and OAuth redirects
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      console.log('[DeepLink] getInitialURL:', url);
      if (url) extractSessionFromUrl(url).catch((e) => console.log('[DeepLink] getInitialURL error:', e));
    });

    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[DeepLink] addEventListener url:', event.url);
      extractSessionFromUrl(event.url).catch((e) => console.log('[DeepLink] addEventListener error:', e));
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
    console.log('[AuthGuard] Effect run:', { isLoading, isAuthenticated, isProfileComplete, isProfileFetched, isPasswordRecovery, isReady, seg0: segments[0], code: globalParams.code, exchangingCode });

    if (isLoading) { console.log('[AuthGuard] → waiting (loading)'); return; }
    if (exchangingCode) { console.log('[AuthGuard] → waiting (exchanging PKCE code)'); return; }
    if (useAuthStore.getState().suppressRecoveryRedirect) { console.log('[AuthGuard] → waiting (password reset in progress)'); return; }

    // Password recovery can proceed without waiting for profile
    if (isPasswordRecovery && isAuthenticated) {
      const inResetPassword = segments[0] === 'reset-password';
      if (!inResetPassword) router.replace('/reset-password');
      console.log('[AuthGuard] → password recovery, inResetPassword:', inResetPassword);
      return;
    }

    // Wait for profile fetch to complete before making routing decisions
    // This prevents redirecting to complete-profile during the brief moment
    // between session being set and profile being fetched
    if (isAuthenticated && !isProfileFetched) { console.log('[AuthGuard] → waiting (profile not fetched)'); return; }

    if (!isReady) {
      setIsReady(true);
      console.log('[AuthGuard] → setting isReady=true, skipping this cycle');
      return;
    }

    const seg = segments[0] as string | undefined;
    const inAuthGroup = seg === '(auth)';
    const inCompleteProfile = seg === 'complete-profile';
    const inResetPassword = seg === 'reset-password';
    const inPublicScreen = seg === 'terms-of-service' || seg === 'privacy-policy';
    // Screens where an authenticated user with complete profile should NOT stay
    const inPreLoginScreen = inAuthGroup || inCompleteProfile || seg === 'google-auth' || seg === '+not-found' || !seg;

    if (!isAuthenticated && !inAuthGroup && !inPublicScreen && !inResetPassword) {
      console.log('[AuthGuard] → redirect to welcome (not authenticated)');
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && !isProfileComplete && !inCompleteProfile && !inResetPassword) {
      console.log('[AuthGuard] → redirect to complete-profile');
      router.replace('/complete-profile');
    } else if (isAuthenticated && isProfileComplete && inPreLoginScreen) {
      console.log('[AuthGuard] → redirect to tabs');
      router.replace('/(tabs)');
    } else {
      console.log('[AuthGuard] → no action', { isAuthenticated, isProfileComplete, inPreLoginScreen, seg });
    }
  }, [isLoading, isAuthenticated, isProfileComplete, isPasswordRecovery, segments, isReady, router, isProfileFetched, exchangingCode]);

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
  const splashRef = useRef<SplashScreenRef>(null);

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
      // Hide the native splash first, then let fullscreen splash take over
      SplashScreen.hideAsync();
      // Auto-hide the fullscreen splash after a brief moment
      const timer = setTimeout(() => {
        splashRef.current?.hide();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  // Check for OTA updates on launch
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          showToast(
            '✨ Nueva versión lista. ¡Toca para actualizar!',
            'success',
            6000,
            () => Updates.reloadAsync(),
          );
        }
      } catch { // Silently ignore OTA errors — not critical
      }
    })();
  }, []);

  const { isConnected } = useNetworkStatus();
  const theme = useThemeStore((s) => s.theme);
  const Colors = useColors();

  if (!fontsLoaded) return null;

  const statusBarStyle = theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'auto';

  return (
    <ExpoFullscreenSplash
      ref={splashRef}
      SplashComponent={<SplashContent />}
      backgroundColor="#FFF0F3"
      animationType="fade"
      autoHide={false}
    >
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
            <Stack.Screen name="manage-moderators" />
            <Stack.Screen name="admin-audit-log" />
            <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
            <Stack.Screen name="buy-boost" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style={statusBarStyle} />
        </AuthGuard>
        <GlobalToast />
        <GlobalConfirmDialog />
      </ErrorBoundary>
    </ExpoFullscreenSplash>
  );
}

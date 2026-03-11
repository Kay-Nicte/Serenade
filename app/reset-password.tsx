import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { showToast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';
import { updatePasswordFromReset } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const code = params.code as string | undefined;
  console.log('[ResetPassword] Screen rendered. Params:', JSON.stringify(params), 'code:', code);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(!!code);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const Colors = useColors();
  const styles = makeStyles(Colors);

  // Exchange PKCE code for session when arriving from deep link
  useEffect(() => {
    if (!code) return;
    console.log('[ResetPassword] PKCE code found in params, exchanging...');
    (async () => {
      try {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          console.log('[ResetPassword] Exchange error:', result.error.message);
          showToast(result.error.message, 'error');
          router.replace('/(auth)/welcome');
          return;
        }
        console.log('[ResetPassword] Exchange success, user:', result.data.user?.id);
        useAuthStore.getState().setPasswordRecovery();
      } catch (e) {
        console.log('[ResetPassword] Exchange exception:', e);
        showToast(t('auth.errorGeneric'), 'error');
        router.replace('/(auth)/welcome');
      } finally {
        setExchanging(false);
      }
    })();
  }, [code]);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!password || password.length < 6) {
      newErrors.password = t('auth.errorPasswordShort');
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errorPasswordMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate() || exchanging) return;

    setLoading(true);
    try {
      console.log('[ResetPassword] Updating password via Supabase SDK...');
      await updatePasswordFromReset(password);
      console.log('[ResetPassword] Password updated successfully');
      useAuthStore.getState().clearPasswordRecovery();
      showToast(t('auth.passwordUpdatedMessage'));
      router.replace('/(tabs)');
    } catch (e: unknown) {
      console.log('[ResetPassword] Error:', e);
      const message = e instanceof Error ? e.message : t('auth.errorGeneric');
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (exchanging) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.newPassword')}</Text>
          <Text style={styles.subtitle}>{t('auth.newPasswordSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('auth.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.password}
          />
          <Input
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.confirmPassword}
          />

          <Button
            title={t('auth.updatePassword')}
            onPress={handleUpdate}
            loading={loading}
            style={styles.button}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
    },
    header: {
      paddingTop: 40,
      paddingBottom: 32,
      gap: 8,
    },
    title: {
      fontSize: 32,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 22,
    },
    form: {
      gap: 16,
    },
    button: {
      marginTop: 8,
    },
  });
}

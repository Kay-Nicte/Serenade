import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toastStore';
import { useAuthStore } from '@/stores/authStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const handleSendCode = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: t('auth.errorInvalidEmail') });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setStep('code');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorGeneric');
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async () => {
    const newErrors: Record<string, string> = {};
    if (!otp || otp.length < 6) {
      newErrors.otp = t('auth.errorInvalidCode', { defaultValue: 'Enter the code from your email' });
    }
    if (!password || password.length < 6) {
      newErrors.password = t('auth.errorPasswordShort');
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errorPasswordMismatch');
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      // Suppress AuthGuard navigation during the entire verify+update flow
      useAuthStore.getState().setSuppressRecoveryRedirect(true);

      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });
      if (verifyError) throw verifyError;

      // Now we have a valid session, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      showToast(t('auth.passwordUpdatedMessage'));
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorGeneric');
      showToast(message, 'error');
    } finally {
      useAuthStore.getState().setSuppressRecoveryRedirect(false);
      setLoading(false);
    }
  };

  if (step === 'code') {
    return (
      <SafeAreaView style={styles.container}>
        <ResponsiveContainer>
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            onPress={() => setStep('email')}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="mail-outline" size={48} color={Colors.primary} />
            <Text style={styles.title}>{t('auth.resetCodeTitle', { defaultValue: 'Check your email' })}</Text>
            <Text style={styles.subtitle}>
              {t('auth.resetCodeSubtitle', { defaultValue: 'Enter the 6-digit code we sent to {{email}} and your new password', email })}
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.verificationCode', { defaultValue: 'Verification code' })}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              error={errors.otp}
            />
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
              onPress={handleVerifyAndReset}
              loading={loading}
              style={styles.button}
            />

            <TouchableOpacity onPress={handleSendCode} style={styles.resendLink}>
              <Text style={styles.resendText}>
                {t('auth.resendCode', { defaultValue: 'Resend code' })}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </ResponsiveContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.forgotPasswordSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <Button
            title={t('auth.sendResetLink')}
            onPress={handleSendCode}
            loading={loading}
            style={styles.button}
          />
        </View>
      </KeyboardAvoidingView>
      </ResponsiveContainer>
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
    backButton: {
      paddingTop: 16,
      paddingBottom: 8,
      alignSelf: 'flex-start',
    },
    header: {
      paddingTop: 16,
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
    resendLink: {
      alignItems: 'center',
      paddingTop: 8,
    },
    resendText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.primary,
    },
  });
}

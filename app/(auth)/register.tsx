import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { signUp } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    age?: string;
  }>({});
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.errorInvalidEmail');
    }
    if (!password || password.length < 6) {
      newErrors.password = t('auth.errorPasswordShort');
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errorPasswordMismatch');
    }
    if (!ageConfirmed) {
      newErrors.age = t('auth.errorAgeConfirm');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await signUp(email.trim(), password);
      // If session is returned, email confirmation is disabled — proceed normally
      if (data.session) {
        await fetchProfile();
      } else if ((data.user?.identities?.length ?? 0) === 0) {
        // Supabase silently "succeeds" for existing emails but returns empty identities
        showToast(t('auth.errorEmailAlreadyExists'), 'error');
      } else {
        // Email confirmation required — show verification screen
        router.replace({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorGeneric');
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.register')}</Text>
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
            <Input
              label={t('auth.password')}
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

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgeConfirmed((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ageConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={ageConfirmed ? Colors.primary : Colors.textTertiary}
              />
              <Text style={styles.checkboxLabel}>{t('auth.ageConfirm')}</Text>
            </TouchableOpacity>
            {errors.age && (
              <Text style={styles.errorText}>{errors.age}</Text>
            )}

            <Text style={styles.terms}>
              {t('auth.termsAgree')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => router.push('/terms-of-service')}
              >
                {t('auth.termsLink')}
              </Text>{' '}
              {t('auth.and')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => router.push('/privacy-policy')}
              >
                {t('auth.privacyLink')}
              </Text>
            </Text>

            <Button
              title={t('auth.register')}
              onPress={handleRegister}
              loading={loading}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={styles.link}
            >
              <Text style={styles.linkText}>
                {t('auth.hasAccount')}{' '}
                <Text style={styles.linkHighlight}>{t('auth.login')}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 32,
      paddingBottom: 40,
    },
    header: {
      paddingTop: 40,
      paddingBottom: 32,
    },
    title: {
      fontSize: 32,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    form: {
      gap: 16,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    checkboxLabel: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      flex: 1,
    },
    errorText: {
      fontSize: 12,
      fontFamily: Fonts.bodyMedium,
      color: c.error,
      marginLeft: 32,
      marginTop: -4,
    },
    terms: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
    termsLink: {
      color: c.primary,
      fontFamily: Fonts.bodyMedium,
    },
    button: {
      marginTop: 8,
    },
    link: {
      alignItems: 'center',
      paddingTop: 16,
    },
    linkText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    linkHighlight: {
      fontFamily: Fonts.bodySemiBold,
      color: c.primary,
    },
  });
}

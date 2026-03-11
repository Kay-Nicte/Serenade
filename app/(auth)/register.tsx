import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { signUp } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      await fetchProfile();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('auth.errorGeneric');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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

            <Text style={styles.terms}>
              {t('auth.termsAgree')}{' '}
              <Text style={styles.termsLink}>{t('auth.termsLink')}</Text>{' '}
              {t('auth.and')}{' '}
              <Text style={styles.termsLink}>{t('auth.privacyLink')}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
  },
  form: {
    gap: 16,
  },
  terms: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
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
    color: Colors.textSecondary,
  },
  linkHighlight: {
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
  },
});

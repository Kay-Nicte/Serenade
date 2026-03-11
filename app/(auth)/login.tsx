import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { signIn } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.errorInvalidEmail');
    }
    if (!password || password.length < 6) {
      newErrors.password = t('auth.errorPasswordShort');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      await fetchProfile();
    } catch {
      Alert.alert(t('common.error'), t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.login')}</Text>
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
            autoComplete="password"
            error={errors.password}
          />

          <Button
            title={t('auth.login')}
            onPress={handleLogin}
            loading={loading}
            style={styles.button}
          />

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.forgotLink}
          >
            <Text style={styles.forgotLinkText}>
              {t('auth.forgotPassword')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/register')}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              {t('auth.noAccount')}{' '}
              <Text style={styles.linkHighlight}>{t('auth.register')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
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
  forgotLink: {
    alignItems: 'center',
    paddingTop: 4,
  },
  forgotLinkText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primary,
  },
});

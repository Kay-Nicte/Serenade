import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { signIn, signInWithGoogle } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
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
      showToast(t('auth.errorGeneric'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
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

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={async () => {
              setGoogleLoading(true);
              try {
                await signInWithGoogle();
                // onAuthStateChange handles fetchProfile and AuthGuard handles navigation
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : '';
                if (!msg.includes('cancelled')) {
                  showToast(t('auth.errorGeneric'), 'error');
                }
              } finally {
                setGoogleLoading(false);
              }
            }}
            activeOpacity={0.7}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={Colors.primaryDark} />
                <Text style={styles.googleButtonText}>{t('auth.continueWithGoogle')}</Text>
              </>
            )}
          </TouchableOpacity>
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
    forgotLink: {
      alignItems: 'center',
      paddingTop: 4,
    },
    forgotLinkText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.primary,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    dividerText: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      textTransform: 'lowercase',
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 12,
      paddingVertical: 14,
    },
    googleButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.primaryDark,
    },
  });
}

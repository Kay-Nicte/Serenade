import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { signInWithGoogle } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [googleLoading, setGoogleLoading] = useState(false);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      await fetchProfile();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('cancelled')) {
        showToast(t('auth.errorGeneric'), 'error');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>{t('welcome.title')}</Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title={t('welcome.login')}
            onPress={() => router.push('/(auth)/login')}
          />
          <Button
            title={t('welcome.register')}
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogle}
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
      </View>
      </ResponsiveContainer>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.primaryPastel,
    },
    content: {
      flex: 1,
      paddingHorizontal: 32,
      justifyContent: 'space-between',
      paddingBottom: 40,
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      fontSize: 48,
      fontFamily: Fonts.heading,
      color: c.primaryDark,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 18,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
    },
    buttons: {
      gap: 12,
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

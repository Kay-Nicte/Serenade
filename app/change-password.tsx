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
import { reauthenticate, changePassword } from '@/lib/auth';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!currentPassword) {
      newErrors.currentPassword = t('changePassword.errorCurrentPassword');
    }
    if (!newPassword || newPassword.length < 6) {
      newErrors.newPassword = t('auth.errorPasswordShort');
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('auth.errorPasswordMismatch');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await reauthenticate(user?.email ?? '', currentPassword);
      await changePassword(newPassword);
      showToast(t('changePassword.success'));
      router.back();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '';
      if (message.includes('Invalid login credentials')) {
        setErrors({ currentPassword: t('changePassword.errorCurrentPassword') });
      } else {
        showToast(t('changePassword.errorGeneric'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('changePassword.title')}</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            <Input
              label={t('changePassword.currentPassword')}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoComplete="current-password"
              error={errors.currentPassword}
            />
            <Input
              label={t('changePassword.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              error={errors.newPassword}
            />
            <Input
              label={t('changePassword.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              error={errors.confirmPassword}
            />

            <Button
              title={t('changePassword.submit')}
              onPress={handleSubmit}
              loading={loading}
              style={styles.button}
            />
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
      backgroundColor: c.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginLeft: 4,
    },
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 40,
    },
    form: {
      gap: 16,
    },
    button: {
      marginTop: 8,
    },
  });
}

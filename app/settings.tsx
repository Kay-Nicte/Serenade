import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { showToast } from '@/stores/toastStore';
import { showConfirm } from '@/components/ConfirmDialog';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useColors } from '@/hooks/useColors';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { Fonts } from '@/constants/fonts';
import { useAuthStore } from '@/stores/authStore';
import { deleteAccount } from '@/lib/auth';
import {
  registerForPushNotificationsAsync,
  savePushTokenToServer,
  removePushTokenFromServer,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';
import { useBlock } from '@/hooks/useBlock';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, profile, updateProfile, signOut } = useAuthStore();
  const { blockedUsers } = useBlock();
  const Colors = useColors();
  const { theme, setTheme } = useThemeStore();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    profile?.language_preference ?? i18n.language
  );
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const isPaused = profile?.is_paused ?? false;
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const styles = makeStyles(Colors);

  useEffect(() => {
    checkPushTokenExists();
  }, []);

  const checkPushTokenExists = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('push_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setPushEnabled(!!data);
  };

  const handleTogglePush = async (value: boolean) => {
    setPushLoading(true);
    try {
      if (value) {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushTokenToServer(token);
          setPushEnabled(true);
        } else {
          showToast(t('notifications.pushNotAvailable'), 'error');
        }
      } else {
        await removePushTokenFromServer();
        setPushEnabled(false);
      }
    } catch {
      showToast(t('notifications.pushNotAvailable'), 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const handleChangeLanguage = async (lang: string) => {
    setSelectedLanguage(lang);
    await i18n.changeLanguage(lang);
    try {
      await updateProfile({ language_preference: lang } as any);
    } catch {
      // profile update failed but language changed locally
    }
  };

  const handleTogglePause = async (value: boolean) => {
    if (value) {
      showConfirm({
        title: t('settings.pauseConfirmTitle'),
        message: t('settings.pauseConfirmMessage'),
        confirmLabel: t('settings.pauseProfile'),
        onConfirm: async () => {
          setPauseLoading(true);
          try {
            await supabase.rpc('set_profile_paused', { paused: true });
            await useAuthStore.getState().fetchProfile();
          } catch {
            showToast(t('common.error'), 'error');
          } finally {
            setPauseLoading(false);
          }
        },
      });
    } else {
      setPauseLoading(true);
      try {
        await supabase.rpc('set_profile_paused', { paused: false });
        await useAuthStore.getState().fetchProfile();
      } catch {
        showToast(t('common.error'), 'error');
      } finally {
        setPauseLoading(false);
      }
    }
  };

  const handleSignOut = () => {
    showConfirm({
      title: t('settings.signOut'),
      message: t('settings.signOutConfirm'),
      confirmLabel: t('settings.signOut'),
      destructive: true,
      onConfirm: signOut,
    });
  };

  const handleDeleteAccount = () => {
    setDeleteConfirmText('');
    setDeleteModalVisible(true);
  };

  const confirmWord = t('settings.deleteAccountConfirmWord');
  const canDelete = deleteConfirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  const executeDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      try { await removePushTokenFromServer(); } catch { /* best-effort */ }
      await deleteAccount();
      // Force-reset all stores and clear session immediately
      // (can't rely on auth.signOut — the user no longer exists in DB)
      useAuthStore.getState().forceReset();
      showToast(t('settings.deleteAccountSuccess'), 'success');
    } catch {
      showToast(t('settings.deleteAccountError'), 'error');
    } finally {
      setDeleteLoading(false);
      setDeleteModalVisible(false);
    }
  };

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'light', label: t('settings.light'), icon: '☀️' },
    { value: 'dark', label: t('settings.dark'), icon: '🌙' },
    { value: 'system', label: t('settings.system'), icon: '📱' },
  ];

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
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.profileSection')}</Text>
          <View style={styles.card}>
            <View style={[styles.row, isPaused && styles.rowPaused]}>
              <Ionicons
                name={isPaused ? 'pause-circle-outline' : 'pause-circle-outline'}
                size={20}
                color={isPaused ? Colors.warning : Colors.text}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, isPaused && { color: Colors.warning }]}>
                  {t('settings.pauseProfile')}
                </Text>
                <Text style={styles.rowSubtitle}>
                  {isPaused ? t('settings.resumeProfile') : t('settings.pauseProfileDesc')}
                </Text>
              </View>
              {pauseLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Switch
                  value={isPaused}
                  onValueChange={handleTogglePause}
                  trackColor={{ false: Colors.border, true: Colors.warning }}
                  thumbColor={Colors.surface}
                />
              )}
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/change-password')}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.changePassword')}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/blocked-users')}
              activeOpacity={0.7}
            >
              <Ionicons name="ban-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.blockedUsers')}</Text>
              {blockedUsers.length > 0 && (
                <Text style={styles.rowValue}>{blockedUsers.length}</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.row}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={Colors.error} />
              <Text style={[styles.rowLabel, { color: Colors.error }]}>
                {t('settings.deleteAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="notifications-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.pushNotifications')}</Text>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                disabled={pushLoading}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={pushEnabled ? Colors.primary : Colors.surface}
              />
            </View>
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setLanguageExpanded(!languageExpanded)}
              activeOpacity={0.7}
            >
              <Ionicons name="language-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>
                {t(`settings.language${selectedLanguage.charAt(0).toUpperCase()}${selectedLanguage.slice(1)}`)}
              </Text>
              <Ionicons
                name={languageExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>

            {languageExpanded && (
              <>
                {(['en', 'es', 'eu', 'ca', 'fr', 'gl', 'it', 'de', 'pt'] as const).map((lang) => (
                  <View key={lang}>
                    <View style={styles.separator} />
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        handleChangeLanguage(lang);
                        setLanguageExpanded(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.rowLabel,
                        selectedLanguage === lang && { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
                      ]}>
                        {t(`settings.language${lang.charAt(0).toUpperCase()}${lang.slice(1)}`)}
                      </Text>
                      {selectedLanguage === lang && (
                        <Ionicons name="checkmark" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={styles.card}>
            <View style={styles.themeRow}>
              {themeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.themeButton,
                    theme === opt.value && styles.themeButtonActive,
                  ]}
                  onPress={() => setTheme(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.themeIcon}>{opt.icon}</Text>
                  <Text style={[
                    styles.themeLabel,
                    theme === opt.value && { color: Colors.primary, fontFamily: Fonts.bodySemiBold },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/terms-of-service')}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.termsOfService')}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/privacy-policy')}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.privacyPolicy')}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.version')}</Text>
              <Text style={styles.rowValue}>{appVersion}</Text>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.support')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => Linking.openURL('mailto:serenade.dating@gmail.com')}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.text} />
              <Text style={styles.rowLabel}>{t('settings.contactUs')}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.error} />
              <Text style={[styles.rowLabel, { color: Colors.error }]}>
                {t('settings.signOut')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Delete account confirmation modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteLoading && setDeleteModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => !deleteLoading && setDeleteModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Ionicons name="warning" size={32} color={Colors.error} />
                <Text style={styles.modalTitle}>{t('settings.deleteAccount')}</Text>
                <Text style={styles.modalMessage}>{t('settings.deleteAccountWarning')}</Text>
                <Text style={styles.modalInputLabel}>{t('settings.deleteAccountConfirmLabel')}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder={confirmWord}
                  placeholderTextColor={Colors.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!deleteLoading}
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setDeleteModalVisible(false)}
                    activeOpacity={0.7}
                    disabled={deleteLoading}
                  >
                    <Text style={styles.modalCancelText}>{t('settings.deleteCancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalDeleteButton,
                      !canDelete && styles.modalDeleteButtonDisabled,
                    ]}
                    onPress={executeDeleteAccount}
                    activeOpacity={0.7}
                    disabled={!canDelete || deleteLoading}
                  >
                    {deleteLoading ? (
                      <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                    ) : (
                      <Text style={styles.modalDeleteText}>{t('settings.deleteConfirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    content: {
      padding: 16,
      paddingBottom: 40,
      gap: 8,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: 4,
      marginTop: 8,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: c.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
    },
    rowPaused: {
      backgroundColor: c.goldBg,
      borderRadius: 12,
    },
    rowSubtitle: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      marginTop: 1,
    },
    rowValue: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    separator: {
      height: 1,
      backgroundColor: c.borderLight,
      marginLeft: 48,
    },
    themeRow: {
      flexDirection: 'row',
      padding: 8,
      gap: 8,
    },
    themeButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      gap: 4,
    },
    themeButtonActive: {
      borderColor: c.primary,
      backgroundColor: c.primaryPastel,
    },
    themeIcon: {
      fontSize: 20,
    },
    themeLabel: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
    },
    modalMessage: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalInputLabel: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      alignSelf: 'stretch',
      marginTop: 4,
    },
    modalInput: {
      width: '100%',
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.background,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
      letterSpacing: 2,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      width: '100%',
      marginTop: 8,
    },
    modalCancelButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    modalCancelText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.textSecondary,
    },
    modalDeleteButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.error,
      minWidth: 80,
      alignItems: 'center',
    },
    modalDeleteButtonDisabled: {
      opacity: 0.4,
    },
    modalDeleteText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
  });
}

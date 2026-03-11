import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { Config } from '@/constants/config';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import type { Profile } from '@/stores/authStore';

function ensureArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      const s = String(v).replace(/^\{|\}$/g, '');
      return s.includes(',') ? s.split(',').map((x) => x.replace(/"/g, '').trim()) : [s];
    });
  }
  if (typeof val === 'string') {
    const trimmed = val.replace(/^\{|\}$/g, '');
    return trimmed ? trimmed.split(',').map((s) => s.replace(/"/g, '').trim()) : [];
  }
  return [String(val)];
}

interface ConversationMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function AdminProfileScreen() {
  const { userId, reporterId } = useLocalSearchParams<{ userId: string; reporterId?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [reporterName, setReporterName] = useState<string>('');
  const [reportedName, setReportedName] = useState<string>('');
  const [reportHistory, setReportHistory] = useState<{ id: string; reason: string; status: string; created_at: string; reporter_name: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userId) fetchProfileData();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileData();
    setRefreshing(false);
  };

  const fetchProfileData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, photosRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase
          .from('photos')
          .select('storage_path')
          .eq('user_id', userId)
          .order('position', { ascending: true }),
      ]);

      if (profileRes.error) throw profileRes.error;
      setProfile(profileRes.data as Profile);
      setReportedName(profileRes.data?.name ?? '');

      if (!photosRes.error && photosRes.data) {
        const uris = photosRes.data
          .map((p: any) => {
            const { data } = supabase.storage
              .from(Config.storageBucket)
              .getPublicUrl(p.storage_path);
            return { uri: data.publicUrl };
          })
          .filter((p: any) => p.uri);
        setPhotos(uris);
      }

      // Fetch all reports against this user
      const { data: reports } = await supabase
        .from('reports')
        .select('id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(name)')
        .eq('reported_id', userId)
        .order('created_at', { ascending: false });

      if (reports) {
        setReportHistory(
          reports.map((r: any) => ({
            id: r.id,
            reason: r.reason,
            status: r.status,
            created_at: r.created_at,
            reporter_name: Array.isArray(r.reporter) ? r.reporter[0]?.name : r.reporter?.name,
          })),
        );
      }

      // Fetch conversation between reporter and reported
      if (reporterId) {
        const reportedUserName = profileRes.data?.name ?? '';
        await fetchConversation(reporterId, userId, reportedUserName);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversation = async (reporter: string, reported: string, reportedUserName: string) => {
    try {
      // Get reporter name
      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', reporter)
        .single();
      const reporterUserName = reporterProfile?.name ?? '';
      setReporterName(reporterUserName);

      // Find match between these two users (user_a_id < user_b_id constraint)
      const userA = reporter < reported ? reporter : reported;
      const userB = reporter < reported ? reported : reporter;

      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('user_a_id', userA)
        .eq('user_b_id', userB)
        .single();

      if (!match) return;

      // Fetch last 50 messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, content, image_url, created_at')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (msgs && msgs.length > 0) {
        const formatted: ConversationMessage[] = msgs.reverse().map((m: any) => ({
          ...m,
          sender_name: m.sender_id === reporter ? reporterUserName : reportedUserName,
        }));
        setMessages(formatted);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const calculateAge = (birthDate: string | null): number | null => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleBan = () => {
    if (!profile) return;
    const isBanned = !!(profile as any).banned_at;

    if (isBanned) {
      Alert.alert(
        t('admin.unbanConfirmTitle'),
        t('admin.unbanConfirmMessage', { name: profile.name ?? '' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('admin.unbanUser'),
            onPress: async () => {
              try {
                const { error } = await supabase.rpc('unban_user', {
                  target_user_id: userId,
                });
                if (error) throw error;
                await fetchProfileData();
              } catch {
                Alert.alert(t('common.error'));
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        t('admin.banConfirmTitle'),
        t('admin.banConfirmMessage', { name: profile.name ?? '' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('admin.banUser'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase.rpc('ban_user', {
                  target_user_id: userId,
                });
                if (error) throw error;
                await fetchProfileData();
              } catch {
                Alert.alert(t('common.error'));
              }
            },
          },
        ],
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const age = calculateAge(profile.birth_date);
  const isBanned = !!(profile as any).banned_at;
  const photoWidth = width;
  const photoHeight = photoWidth / (3 / 4);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.viewProfile')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Banned banner */}
        {isBanned && (
          <View style={styles.bannedBanner}>
            <Ionicons name="ban" size={18} color={Colors.textOnPrimary} />
            <Text style={styles.bannedText}>BANNED</Text>
          </View>
        )}

        {/* Photos */}
        <PhotoCarousel
          photos={photos}
          fallbackUri={profile.avatar_url}
          width={photoWidth}
          height={photoHeight}
        />

        {/* Profile info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name ?? '—'}</Text>
            {age !== null && <Text style={styles.age}>{age}</Text>}
          </View>

          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.noBio}>{t('admin.noBio')}</Text>
          )}

          <View style={styles.tags}>
            {ensureArray(profile.orientation).map((o) => (
              <View key={o} style={styles.tag}>
                <Text style={styles.tagText}>{t(`orientation.${o}`)}</Text>
              </View>
            ))}
            {ensureArray(profile.looking_for).map((lf) => (
              <View key={lf} style={styles.tag}>
                <Text style={styles.tagText}>{t(`lookingFor.${lf}`)}</Text>
              </View>
            ))}
          </View>

          {/* Admin details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t('admin.profileDetails')}</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID</Text>
              <Text style={styles.detailValue} selectable>{profile.id}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('admin.createdAt')}</Text>
              <Text style={styles.detailValue}>
                {new Date(profile.created_at).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('admin.photosCount')}</Text>
              <Text style={styles.detailValue}>{photos.length}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('admin.profileComplete')}</Text>
              <Ionicons
                name={profile.is_profile_complete ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={profile.is_profile_complete ? Colors.success : Colors.error}
              />
            </View>
          </View>

          {/* Report history */}
          <View style={styles.detailsSection}>
            <View style={styles.reportHistoryHeader}>
              <Text style={styles.sectionTitle}>{t('admin.reportHistory')}</Text>
              {reportHistory.length > 0 && (
                <View style={[
                  styles.reportCountBadge,
                  reportHistory.length >= 3 && styles.reportCountBadgeDanger,
                ]}>
                  <Text style={styles.reportCountText}>{reportHistory.length}</Text>
                </View>
              )}
            </View>
            {reportHistory.length === 0 ? (
              <Text style={styles.noMessages}>{t('admin.noReportHistory')}</Text>
            ) : (
              reportHistory.map((report) => (
                <View key={report.id} style={styles.reportHistoryItem}>
                  <View style={styles.reportHistoryRow}>
                    <Text style={styles.reportHistoryReason}>{t(`report.reason_${report.reason}`)}</Text>
                    <Text style={[
                      styles.reportHistoryStatus,
                      { color: report.status === 'pending' ? Colors.warning : report.status === 'resolved' ? Colors.success : Colors.textTertiary },
                    ]}>
                      {t(`admin.status_${report.status}`)}
                    </Text>
                  </View>
                  <Text style={styles.reportHistoryMeta}>
                    {report.reporter_name ? `${t('admin.reporter')}: ${report.reporter_name} · ` : ''}
                    {new Date(report.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Conversation between reporter and reported */}
          {messages.length > 0 && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>{t('admin.conversation')}</Text>
              <Text style={styles.conversationSubtitle}>
                {t('admin.conversationBetween', { reporter: reporterName, reported: reportedName })}
              </Text>
              {messages.map((msg) => {
                const isReported = msg.sender_id === userId;
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      isReported ? styles.messageBubbleReported : styles.messageBubbleReporter,
                    ]}
                  >
                    <Text style={styles.messageSender}>{msg.sender_name}</Text>
                    <Text style={styles.messageContent}>{msg.content}</Text>
                    {msg.image_url && (
                      <Text style={styles.messageImage}>[{t('chat.photoMessage')}]</Text>
                    )}
                    <Text style={styles.messageTime}>
                      {new Date(msg.created_at).toLocaleString([], {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {reporterId && messages.length === 0 && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>{t('admin.conversation')}</Text>
              <Text style={styles.noMessages}>{t('admin.noConversation')}</Text>
            </View>
          )}

          {/* Ban/Unban button */}
          <TouchableOpacity
            style={[styles.banButton, isBanned ? styles.unbanButton : styles.banButtonDanger]}
            onPress={handleBan}
          >
            <Ionicons
              name={isBanned ? 'checkmark-circle-outline' : 'ban'}
              size={20}
              color={Colors.textOnPrimary}
            />
            <Text style={styles.banButtonText}>
              {isBanned ? t('admin.unbanUser') : t('admin.banUser')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    bannedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.error,
      paddingVertical: 8,
    },
    bannedText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    info: {
      padding: 24,
      gap: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    name: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
      flexShrink: 1,
    },
    age: {
      fontSize: 24,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    bio: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 24,
    },
    noBio: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      fontStyle: 'italic',
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    tagText: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.primaryDark,
    },
    detailsSection: {
      marginTop: 16,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: c.borderLight,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginBottom: 4,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      maxWidth: '60%',
      textAlign: 'right',
    },
    reportHistoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    reportCountBadge: {
      backgroundColor: c.warning,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    reportCountBadgeDanger: {
      backgroundColor: c.error,
    },
    reportCountText: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    reportHistoryItem: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borderLight,
      paddingTop: 10,
      gap: 4,
    },
    reportHistoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reportHistoryReason: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
    },
    reportHistoryStatus: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
    },
    reportHistoryMeta: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    conversationSubtitle: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      marginBottom: 8,
    },
    messageBubble: {
      borderRadius: 12,
      padding: 10,
      maxWidth: '85%',
    },
    messageBubbleReported: {
      backgroundColor: '#FDECEA',
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    messageBubbleReporter: {
      backgroundColor: c.surfaceSecondary,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    messageSender: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: c.textTertiary,
      marginBottom: 2,
    },
    messageContent: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      lineHeight: 20,
    },
    messageImage: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.secondary,
      marginTop: 2,
    },
    messageTime: {
      fontSize: 10,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    noMessages: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 12,
    },
    banButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 8,
    },
    banButtonDanger: {
      backgroundColor: c.error,
    },
    unbanButton: {
      backgroundColor: c.success,
    },
    banButtonText: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
  });
}

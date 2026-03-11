import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { ActionSheet, type ActionSheetOption } from '@/components/ActionSheet';
import { Toast, useToast } from '@/components/Toast';
import { showConfirm } from '@/components/ConfirmDialog';
import { useAuthStore } from '@/stores/authStore';

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

interface ReportRow {
  id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  reporter: { name: string | null; avatar_url: string | null } | null;
  reported: { name: string | null; avatar_url: string | null; banned_at: string | null } | null;
  reporter_id: string;
  reported_id: string;
  reportCount: number;
}

const FILTER_TABS: ReportStatus[] = ['pending', 'reviewed', 'resolved', 'dismissed'];

export default function AdminScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const isAdmin = useAuthStore((s) => s.profile?.is_admin === true);

  const STATUS_COLORS: Record<ReportStatus, string> = {
    pending: Colors.warning,
    reviewed: Colors.secondary,
    resolved: Colors.success,
    dismissed: Colors.textTertiary,
  };

  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('pending');
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetOptions, setActionSheetOptions] = useState<ActionSheetOption[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const toast = useToast();

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('reports')
        .select(`
          id,
          reason,
          description,
          status,
          created_at,
          resolved_at,
          reporter_id,
          reported_id,
          reporter:profiles!reports_reporter_id_fkey(name, avatar_url),
          reported:profiles!reports_reported_id_fkey(name, avatar_url, banned_at)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []).map((row: any) => ({
        ...row,
        reporter: Array.isArray(row.reporter) ? row.reporter[0] : row.reporter,
        reported: Array.isArray(row.reported) ? row.reported[0] : row.reported,
        reportCount: 0,
      }));

      // Get total report counts per reported user
      const uniqueReportedIds = [...new Set(rows.map((r: any) => r.reported_id))];
      if (uniqueReportedIds.length > 0) {
        const { data: counts } = await supabase
          .from('reports')
          .select('reported_id')
          .in('reported_id', uniqueReportedIds);

        if (counts) {
          const countMap: Record<string, number> = {};
          for (const c of counts) {
            countMap[c.reported_id] = (countMap[c.reported_id] || 0) + 1;
          }
          for (const row of rows) {
            row.reportCount = countMap[row.reported_id] || 0;
          }
        }
      }

      setReports(rows);
    } catch (error) {
      // Reports fetch failed
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const fetchPendingVerifications = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('admin_get_pending_verifications');
      setPendingVerifications(Array.isArray(data) ? data.length : 0);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchPendingVerifications();
  }, [fetchReports, fetchPendingVerifications]);

  const handleAction = (report: ReportRow) => {
    const isBanned = !!report.reported?.banned_at;
    const options: ActionSheetOption[] = [];

    if (report.status === 'pending') {
      options.push({
        label: t('admin.markReviewed'),
        icon: 'eye-outline',
        onPress: () => updateReportStatus(report.id, 'reviewed'),
      });
    }

    if (!isBanned) {
      options.push({
        label: t('admin.banUser'),
        icon: 'ban',
        destructive: true,
        onPress: () => confirmBan(report),
      });
    } else {
      options.push({
        label: t('admin.unbanUser'),
        icon: 'checkmark-circle-outline',
        onPress: () => confirmUnban(report),
      });
    }

    if (report.status !== 'dismissed') {
      options.push({
        label: t('admin.dismiss'),
        icon: 'close-circle-outline',
        onPress: () => updateReportStatus(report.id, 'dismissed'),
      });
    }

    if (report.status !== 'resolved') {
      options.push({
        label: t('admin.resolve'),
        icon: 'checkmark-done-outline',
        onPress: () => updateReportStatus(report.id, 'resolved'),
      });
    }

    setActionSheetOptions(options);
    setActionSheetVisible(true);
  };

  const updateReportStatus = async (reportId: string, status: ReportStatus) => {
    try {
      const { error } = await supabase.rpc('resolve_report', {
        report_id: reportId,
        new_status: status,
      });
      if (error) throw error;
      await fetchReports();
    } catch {
      toast.show(t('common.error'), 'error');
    }
  };

  const confirmBan = (report: ReportRow) => {
    showConfirm({
      title: t('admin.banConfirmTitle'),
      message: t('admin.banConfirmMessage', { name: report.reported?.name ?? '' }),
      confirmLabel: t('admin.banUser'),
      destructive: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('ban_user', {
            target_user_id: report.reported_id,
          });
          if (error) throw error;
          await updateReportStatus(report.id, 'resolved');
        } catch {
          toast.show(t('common.error'), 'error');
        }
      },
    });
  };

  const confirmUnban = (report: ReportRow) => {
    showConfirm({
      title: t('admin.unbanConfirmTitle'),
      message: t('admin.unbanConfirmMessage', { name: report.reported?.name ?? '' }),
      confirmLabel: t('admin.unbanUser'),
      destructive: false,
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('unban_user', {
            target_user_id: report.reported_id,
          });
          if (error) throw error;
          await fetchReports();
        } catch {
          toast.show(t('common.error'), 'error');
        }
      },
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderReport = ({ item }: { item: ReportRow }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => handleAction(item)}
      activeOpacity={0.7}
    >
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
        <Text style={styles.statusText}>{t(`admin.status_${item.status}`)}</Text>
      </View>

      {/* Reporter */}
      <View style={styles.userRow}>
        <Text style={styles.rowLabel}>{t('admin.reporter')}</Text>
        <View style={styles.userInfo}>
          {item.reporter?.avatar_url ? (
            <Image source={{ uri: item.reporter.avatar_url }} style={styles.miniAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder]}>
              <Ionicons name="person" size={12} color={Colors.primaryLight} />
            </View>
          )}
          <Text style={styles.userName}>{item.reporter?.name ?? '—'}</Text>
        </View>
      </View>

      {/* Reported — tap to view profile */}
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => router.push({ pathname: '/admin-profile', params: { userId: item.reported_id, reporterId: item.reporter_id } })}
      >
        <Text style={styles.rowLabel}>{t('admin.reported')}</Text>
        <View style={styles.userInfo}>
          {item.reported?.avatar_url ? (
            <Image source={{ uri: item.reported.avatar_url }} style={styles.miniAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder]}>
              <Ionicons name="person" size={12} color={Colors.primaryLight} />
            </View>
          )}
          <Text style={[styles.userName, styles.userNameLink]}>
            {item.reported?.name ?? '—'}
            {item.reported?.banned_at ? ' (BANNED)' : ''}
          </Text>
          <Ionicons name="eye-outline" size={16} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      {/* Repeat offender warning */}
      {item.reportCount > 1 && (
        <View style={[styles.repeatBadge, item.reportCount >= 3 && styles.repeatBadgeDanger]}>
          <Ionicons name="warning" size={14} color={Colors.textOnPrimary} />
          <Text style={styles.repeatText}>
            {t('admin.reportedNTimes', { count: item.reportCount })}
          </Text>
        </View>
      )}

      {/* Reason */}
      <View style={styles.detailRow}>
        <Text style={styles.rowLabel}>{t('admin.reason')}</Text>
        <Text style={styles.reasonText}>{t(`report.reason_${item.reason}`)}</Text>
      </View>

      {/* Description */}
      {item.description && (
        <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
      )}

      {/* Date */}
      <Text style={styles.date}>{formatDate(item.created_at)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.adminHeader}>
        <Text style={styles.title}>{t('admin.panelTitle')}</Text>
      </View>

      {/* Section navigation */}
      <View style={styles.sectionNav}>
        <View style={[styles.sectionNavTab, styles.sectionNavTabActive]}>
          <Text style={[styles.sectionNavText, styles.sectionNavTextActive]}>{t('admin.reports')}</Text>
        </View>
        <TouchableOpacity
          style={styles.sectionNavTab}
          onPress={() => router.push('/admin-verification')}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionNavText}>{t('admin.verifications')}</Text>
          {pendingVerifications > 0 && (
            <View style={styles.sectionNavBadge}>
              <Text style={styles.sectionNavBadgeText}>{pendingVerifications}</Text>
            </View>
          )}
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={styles.sectionNavTab}
            onPress={() => router.push('/manage-moderators')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionNavText}>{t('admin.moderators')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Report filter tabs */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            {t('admin.all')}
          </Text>
        </TouchableOpacity>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {t(`admin.status_${tab}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('admin.noReports')}</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          onRefresh={fetchReports}
          refreshing={isLoading}
        />
      )}

      <ActionSheet
        visible={actionSheetVisible}
        title={t('admin.actions')}
        options={actionSheetOptions}
        onClose={() => setActionSheetVisible(false)}
      />
      <Toast visible={toast.visible} message={toast.message} variant={toast.variant} onDismiss={toast.dismiss} />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    adminHeader: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 4,
    },
    title: {
      fontSize: 24,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    sectionNav: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
    },
    sectionNavTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: c.surfaceSecondary,
    },
    sectionNavTabActive: {
      backgroundColor: c.primary,
    },
    sectionNavText: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    sectionNavTextActive: {
      color: c.textOnPrimary,
    },
    sectionNavBadge: {
      backgroundColor: c.error,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    sectionNavBadgeText: {
      fontSize: 10,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
    // Legacy styles removed
    verificationsCountText: {
      fontSize: 11,
      fontFamily: Fonts.bodyBold,
      color: c.primary,
    },
    filters: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingBottom: 12,
      gap: 6,
      flexWrap: 'wrap',
    },
    filterTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.surfaceSecondary,
    },
    filterTabActive: {
      backgroundColor: c.primary,
    },
    filterText: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    filterTextActive: {
      color: c.textOnPrimary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
    },
    list: {
      padding: 16,
      gap: 12,
    },
    reportCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    statusText: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    userRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLabel: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    miniAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    miniAvatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userName: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    userNameLink: {
      color: c.secondary,
      textDecorationLine: 'underline',
    },
    repeatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.warning,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      alignSelf: 'flex-start',
    },
    repeatBadgeDanger: {
      backgroundColor: c.error,
    },
    repeatText: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reasonText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.error,
    },
    description: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 18,
      backgroundColor: c.surfaceSecondary,
      borderRadius: 8,
      padding: 10,
    },
    date: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textAlign: 'right',
    },
  });
}

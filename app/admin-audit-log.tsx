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
import { useAuthStore } from '@/stores/authStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

type ActionFilter = 'all' | 'verification_approved' | 'verification_rejected' | 'ban' | 'unban';

interface AuditEntry {
  id: string;
  action: string;
  details: {
    selfie_path?: string;
    gesture?: string;
    matches_created?: number;
    rejection_reason?: string;
  };
  created_at: string;
  admin: { id: string; name: string | null; avatar_url: string | null };
  target: { id: string; name: string | null; avatar_url: string | null };
}

const ACTION_ICONS: Record<string, string> = {
  verification_approved: 'checkmark-circle',
  verification_rejected: 'close-circle',
  ban: 'ban',
  unban: 'checkmark-circle-outline',
};

export default function AdminAuditLogScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.profile?.is_admin === true);

  const ACTION_COLORS: Record<string, string> = {
    verification_approved: Colors.success,
    verification_rejected: Colors.warning,
    ban: Colors.error,
    unban: Colors.secondary,
  };

  const FILTERS: { key: ActionFilter; label: string }[] = [
    { key: 'all', label: t('admin.auditAll') },
    { key: 'verification_approved', label: t('admin.auditVerified') },
    { key: 'verification_rejected', label: t('admin.auditRejected') },
    { key: 'ban', label: t('admin.auditBanned') },
    { key: 'unban', label: t('admin.auditUnbanned') },
  ];

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<ActionFilter>('all');

  const fetchLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_audit_log', {
        page_limit: 100,
        page_offset: 0,
        action_filter: filter === 'all' ? null : filter,
      });
      if (error) throw error;
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      // fetch failed
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderEntry = ({ item }: { item: AuditEntry }) => {
    const color = ACTION_COLORS[item.action] ?? Colors.textSecondary;
    const icon = ACTION_ICONS[item.action] ?? 'ellipsis-horizontal';

    return (
      <View style={styles.card}>
        {/* Action badge */}
        <View style={styles.actionRow}>
          <View style={[styles.actionBadge, { backgroundColor: color }]}>
            <Ionicons name={icon as any} size={14} color="#fff" />
            <Text style={styles.actionText}>{t(`admin.action_${item.action}`)}</Text>
          </View>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>

        {/* Target user */}
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => router.push({ pathname: '/admin-profile', params: { userId: item.target.id } })}
          activeOpacity={0.7}
        >
          {item.target.avatar_url ? (
            <Image source={{ uri: item.target.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={14} color={Colors.primaryLight} />
            </View>
          )}
          <Text style={styles.targetName}>{item.target.name ?? '—'}</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
        </TouchableOpacity>

        {/* Admin who performed the action */}
        <View style={styles.adminRow}>
          <Text style={styles.byText}>{t('admin.auditBy')}</Text>
          {item.admin.avatar_url ? (
            <Image source={{ uri: item.admin.avatar_url }} style={styles.miniAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.miniAvatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={10} color={Colors.primaryLight} />
            </View>
          )}
          <Text style={styles.adminName}>{item.admin.name ?? '—'}</Text>
        </View>

        {/* Extra details */}
        {item.action === 'verification_approved' && (item.details.matches_created ?? 0) > 0 && (
          <Text style={styles.detail}>
            {t('admin.auditMatches', { count: item.details.matches_created })}
          </Text>
        )}
        {item.action === 'verification_rejected' && item.details.rejection_reason && (
          <Text style={styles.detail}>
            {t('admin.auditRejectionReason', { reason: item.details.rejection_reason })}
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t('admin.panelTitle')}</Text>
      </View>

      {/* Section navigation */}
      <View style={styles.sectionNav}>
        <TouchableOpacity
          style={styles.sectionNavTab}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionNavText}>{t('admin.reports')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionNavTab}
          onPress={() => router.replace('/admin-verification')}
          activeOpacity={0.7}
        >
          <Text style={styles.sectionNavText}>{t('admin.verifications')}</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={styles.sectionNavTab}
            onPress={() => router.replace('/manage-moderators')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionNavText}>{t('admin.moderators')}</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.sectionNavTab, styles.sectionNavTabActive]}>
          <Text style={[styles.sectionNavText, styles.sectionNavTextActive]}>{t('admin.auditLog')}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('admin.noAuditLog')}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={styles.list}
          onRefresh={fetchLog}
          refreshing={isLoading}
        />
      )}
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
    card: {
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
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    actionText: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
    date: {
      fontSize: 11,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    targetName: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    adminRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    byText: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    miniAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    adminName: {
      fontSize: 12,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    detail: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      backgroundColor: c.surfaceSecondary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
  });
}

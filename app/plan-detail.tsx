import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { usePlansStore } from '@/stores/plansStore';
import { showToast } from '@/stores/toastStore';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showConfirm } from '@/components/ConfirmDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

interface Attendee {
  id: string;
  name: string;
  avatar_url: string | null;
}

const AVATAR_COLORS = ['#E8A0BF', '#BA90C6', '#C0DBEA', '#DCCCBB', '#A8D8B9', '#F2C57C'];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function PlanDetailScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const plans = usePlansStore((s) => s.plans);
  const joinPlan = usePlansStore((s) => s.joinPlan);
  const leavePlan = usePlansStore((s) => s.leavePlan);
  const deletePlan = usePlansStore((s) => s.deletePlan);

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const plan = plans.find((p) => p.id === id);

  const fetchAttendees = useCallback(async () => {
    if (!id) return;
    setLoadingAttendees(true);
    try {
      const { data, error } = await supabase.rpc('get_plan_attendees', { p_plan_id: id });
      if (error) throw error;
      setAttendees((data as Attendee[]) ?? []);
    } catch {
      // silent
    } finally {
      setLoadingAttendees(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const getCategoryColor = (cat: string) => {
    if (cat === 'viajes') return '#C8956C';
    if (cat === 'cultura') return Colors.primary;
    return Colors.primaryDark;
  };

  const getCategoryLabel = (cat: string) => {
    if (cat === 'viajes') return t('plans.categoryTravel');
    if (cat === 'cultura') return t('plans.categoryCulture');
    return t('plans.categoryLeisure');
  };

  const handleJoin = async () => {
    if (!id) return;
    setActionLoading(true);
    const result = await joinPlan(id);
    if (result.success) {
      showToast(t('plans.joined'), 'success');
      fetchAttendees();
    } else if (result.error?.includes('verified')) {
      showToast(t('plans.mustVerify'), 'error');
    } else if (result.error?.includes('full')) {
      showToast(t('plans.planFull'), 'error');
    } else {
      showToast(t('plans.errorJoining'), 'error');
    }
    setActionLoading(false);
  };

  const handleLeave = async () => {
    if (!id) return;
    setActionLoading(true);
    const result = await leavePlan(id);
    if (result.success) {
      showToast(t('plans.left'), 'success');
      fetchAttendees();
    } else {
      showToast(t('plans.errorLeaving'), 'error');
    }
    setActionLoading(false);
  };

  const handleKick = (attendee: Attendee) => {
    showConfirm({
      title: t('plans.kickConfirmTitle'),
      message: t('plans.kickConfirm', { name: attendee.name }),
      confirmLabel: t('plans.kick'),
      destructive: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('kick_plan_attendee', {
            p_plan_id: id,
            p_user_id: attendee.id,
          });
          if (error) throw error;
          showToast(t('plans.kicked'), 'success');
          fetchAttendees();
          usePlansStore.getState().fetchPlans();
        } catch {
          showToast('Error', 'error');
        }
      },
    });
  };

  const handleDelete = () => {
    showConfirm({
      title: t('plans.delete'),
      message: t('plans.deleteConfirm'),
      confirmLabel: t('plans.delete'),
      destructive: true,
      onConfirm: async () => {
        if (!id) return;
        setActionLoading(true);
        const result = await deletePlan(id);
        if (result.success) {
          showToast(t('plans.planDeleted'), 'success');
          router.back();
        } else {
          showToast(result.error || 'Error', 'error');
        }
        setActionLoading(false);
      },
    });
  };

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ResponsiveContainer>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Plan</Text>
            <View style={{ width: 26 }} />
          </View>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        </ResponsiveContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ResponsiveContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(plan.category) }]}>
            <Text style={styles.categoryBadgeText}>
              {getCategoryLabel(plan.category)}
            </Text>
          </View>

          <Text style={styles.title}>{plan.title}</Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{t('plans.createdBy', { name: plan.creator_name })}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{plan.location_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {new Date(plan.event_date).toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>

          {plan.max_attendees != null && (
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                {plan.attendee_count}/{plan.max_attendees} {t('plans.attendees', { count: plan.attendee_count })}
              </Text>
            </View>
          )}

          {plan.description ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>{t('plans.descriptionLabel')}</Text>
              <Text style={styles.description}>{plan.description}</Text>
            </View>
          ) : null}

          <View style={styles.attendeesSection}>
            <Text style={styles.sectionTitle}>
              {t('plans.attendees', { count: plan.attendee_count })}
            </Text>
            {loadingAttendees ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
            ) : attendees.length === 0 ? (
              <Text style={styles.noAttendeesText}>{t('plans.empty')}</Text>
            ) : (
              <View style={styles.attendeesList}>
                {attendees.map((a, i) => (
                  <View key={a.id} style={styles.attendeeItem}>
                    <TouchableOpacity
                      style={styles.attendeeProfile}
                      onPress={() => router.push({ pathname: '/match-profile', params: { userId: a.id } } as any)}
                      activeOpacity={0.7}
                    >
                      {a.avatar_url ? (
                        <Image source={{ uri: a.avatar_url }} style={styles.attendeeAvatar} />
                      ) : (
                        <View
                          style={[
                            styles.attendeeAvatar,
                            { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] },
                          ]}
                        >
                          <Text style={styles.attendeeInitials}>{getInitials(a.name)}</Text>
                        </View>
                      )}
                      <Text style={styles.attendeeName}>{a.name}</Text>
                    </TouchableOpacity>
                    {plan.is_creator && a.id !== plan.creator_id && (
                      <TouchableOpacity onPress={() => handleKick(a)} hitSlop={8} activeOpacity={0.7}>
                        <Ionicons name="close-circle-outline" size={22} color={Colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {plan.is_creator && plan.attendee_count <= 1 && (
              <Button
                title={t('plans.edit')}
                onPress={() => router.push(`/edit-plan?id=${plan.id}` as any)}
                style={{ marginBottom: 12 }}
              />
            )}
            {plan.is_creator ? (
              <Button
                title={t('plans.delete')}
                onPress={handleDelete}
                variant="outline"
                loading={actionLoading}
              />
            ) : plan.is_joined ? (
              <Button
                title={t('plans.leave')}
                onPress={handleLeave}
                variant="outline"
                loading={actionLoading}
              />
            ) : (
              <Button
                title={t('plans.join')}
                onPress={handleJoin}
                loading={actionLoading}
              />
            )}
          </View>
        </ScrollView>
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
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 40,
    },
    categoryBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      marginBottom: 12,
    },
    categoryBadgeText: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
      color: '#FFFFFF',
    },
    title: {
      fontSize: 24,
      fontFamily: Fonts.heading,
      color: c.text,
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      flex: 1,
    },
    descriptionSection: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginBottom: 8,
    },
    description: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 22,
    },
    attendeesSection: {
      marginTop: 24,
    },
    noAttendeesText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      marginTop: 8,
    },
    attendeesList: {
      marginTop: 12,
      gap: 12,
    },
    attendeeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    attendeeProfile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    attendeeAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    attendeeInitials: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: '#FFFFFF',
    },
    attendeeName: {
      fontSize: 15,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
    },
    actions: {
      marginTop: 32,
    },
  });
}

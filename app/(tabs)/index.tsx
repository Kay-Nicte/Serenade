import { IceBreakerModal } from "@/components/IceBreakerModal";
import { MatchOverlay } from "@/components/MatchOverlay";
import { ProfileCard } from "@/components/ProfileCard";
import { UndoButton } from "@/components/UndoButton";
import { useColors } from "@/hooks/useColors";
import { Fonts } from "@/constants/fonts";
import { useDailyProfiles } from "@/hooks/useDailyProfiles";
import { useStreak } from "@/hooks/useStreak";
import { useAuthStore } from "@/stores/authStore";
import { useDailyStatsStore } from "@/stores/dailyStatsStore";
import { useIceBreakerStore } from "@/stores/iceBreakerStore";
import { supabase } from "@/lib/supabase";
import { computeActivityLevel, useProfileStore } from "@/stores/profileStore";
import { showToast } from "@/stores/toastStore";
import { checkToxicity } from "@/lib/moderation";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function TodayScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const {
    currentProfile,
    currentPhotos,
    hasMore,
    isLoading,
    error,
    matchResult,
    like,
    superlike,
    pass,
    lastSwipe,
    undoLastSwipe,
    clearMatchResult,
    refresh,
    resetPasses,
  } = useDailyProfiles();

  useStreak(); // triggers fetch on mount
  const availableSuperlikes = useDailyStatsStore((s) => s.availableSuperlikes);
  const availableIceBreakers = useDailyStatsStore((s) => s.availableIceBreakers);
  const remainingLikes = useDailyStatsStore((s) => s.remainingLikes);
  const reward = useDailyStatsStore((s) => s.reward);
  const isPremium = useAuthStore((s) => s.profile?.is_premium ?? false);
  const isVerified = useAuthStore((s) => s.profile?.is_verified ?? false);
  const verificationStatus = useAuthStore((s) => s.profile?.verification_status ?? 'none');
  const fetchProfile = useAuthStore((s) => s.fetchProfile);

  // Refresh profile on tab focus to pick up verification status changes
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );
  const candidatePresence = useProfileStore((s) => s.candidatePresence);
  const superlikeSenders = useProfileStore((s) => s.superlikeSenders);
  const sendIceBreaker = useIceBreakerStore((s) => s.sendIceBreaker);
  const shownRewardRef = useRef<string | null>(null);
  const [iceBreakerModalVisible, setIceBreakerModalVisible] = useState(false);
  const [pendingLikesCount, setPendingLikesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const refreshPendingLikes = useCallback(() => {
    supabase.rpc('get_pending_likes').then(({ data }) => {
      if (Array.isArray(data)) setPendingLikesCount(data.length);
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshPendingLikes(), fetchProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshPendingLikes, fetchProfile]);

  // Refresh on tab focus and when currentProfile changes (after like/pass/superlike)
  useFocusEffect(
    useCallback(() => {
      refreshPendingLikes();
    }, [refreshPendingLikes])
  );

  useEffect(() => {
    refreshPendingLikes();
  }, [currentProfile, refreshPendingLikes]);

  useEffect(() => {
    if (reward && reward !== shownRewardRef.current) {
      shownRewardRef.current = reward;
      const msg =
        reward === "superlike"
          ? t("streak.rewardSuperlike")
          : t("streak.rewardIceBreaker");
      showToast(msg, "success");
    }
  }, [reward]);

  const handleChat = () => {
    if (matchResult?.match_id) {
      clearMatchResult();
      router.push(`/(tabs)/chat/${matchResult.match_id}`);
    }
  };

  const handleKeepExploring = () => {
    clearMatchResult();
  };

  const handleSendIceBreaker = async (message: string) => {
    if (!currentProfile) return;
    if (checkToxicity(message).toxic) {
      showToast(t("chat.toxicMessage"), "error");
      return;
    }
    setIceBreakerModalVisible(false);
    const result = await sendIceBreaker(currentProfile.id, message);
    if (result.success) {
      showToast(t("iceBreaker.sent"), "success");
      pass(); // advance to next candidate
    } else if (result.errorKey === "no_ice_breakers_available") {
      showToast(t("iceBreaker.noIceBreakers"), "error");
    } else if (result.errorKey === "already_matched") {
      showToast(t("iceBreaker.alreadyMatched"), "error");
    } else {
      showToast(t("common.error"), "error");
    }
  };

  const photos = currentPhotos.map((p) => ({ uri: p.url }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t("today.title")}</Text>
        {pendingLikesCount > 0 && (
          <TouchableOpacity
            style={styles.whoLikedButton}
            onPress={() => router.push("/who-liked-me")}
            activeOpacity={0.7}
          >
            <Ionicons name="heart" size={16} color={Colors.primary} />
            <Text style={styles.whoLikedText}>
              {t("likes.count", { count: pendingLikesCount })}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Verification banner */}
      {!isVerified && (
        <TouchableOpacity
          style={[
            styles.verificationBanner,
            verificationStatus === 'pending' && styles.verificationBannerPending,
          ]}
          onPress={() => {
            if (verificationStatus !== 'pending') {
              router.push('/verify-identity');
            }
          }}
          activeOpacity={verificationStatus === 'pending' ? 1 : 0.7}
        >
          <Ionicons
            name={verificationStatus === 'pending' ? 'time-outline' : 'shield-checkmark-outline'}
            size={18}
            color={verificationStatus === 'pending' ? Colors.warning : Colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.verificationBannerText, verificationStatus === 'pending' && styles.verificationBannerTextPending]}>
              {verificationStatus === 'pending'
                ? t("verification.bannerPending")
                : t("verification.banner")}
            </Text>
            {verificationStatus !== 'pending' && (
              <Text style={[styles.verificationBannerText, { color: Colors.goldText, marginTop: 2 }]}>
                {t("verification.promoLaunch")}
              </Text>
            )}
          </View>
          {verificationStatus !== 'pending' && (
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          )}
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={styles.centeredFull}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t("today.loading")}</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredFull}>
          <Ionicons
            name="alert-circle-outline"
            size={64}
            color={Colors.primary}
          />
          <Text style={styles.errorText}>{t(error)}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={refresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color={Colors.surface} />
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : currentProfile && hasMore ? (
        <View style={styles.cardWrapper}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <ProfileCard
              profile={currentProfile}
              photos={photos}
              activityLevel={computeActivityLevel(
                candidatePresence[currentProfile.id] ?? currentProfile.updated_at,
              )}
              lastSeen={
                candidatePresence[currentProfile.id] ??
                currentProfile.updated_at
              }
              showActivityLevel={isPremium}
              isSuperlike={superlikeSenders.includes(currentProfile.id)}
              showCompatibility
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.passButton]}
              onPress={pass}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={32} color={Colors.textSecondary} />
            </TouchableOpacity>

            {availableIceBreakers > 0 && isVerified && (
              <TouchableOpacity
                style={[styles.actionButton, styles.iceBreakerButton]}
                onPress={() => setIceBreakerModalVisible(true)}
                activeOpacity={0.7}
              >
                <View>
                  <Ionicons name="chatbubble-ellipses" size={28} color={Colors.primary} />
                  <View style={styles.iceBreakerBadge}>
                    <Text style={styles.iceBreakerBadgeText}>
                      {availableIceBreakers}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {availableSuperlikes > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.superlikeButton]}
                onPress={superlike}
                activeOpacity={0.7}
              >
                <View>
                  <Ionicons name="star" size={32} color={Colors.goldAccent} />
                  <View style={styles.superlikeBadge}>
                    <Text style={styles.superlikeBadgeText}>
                      {availableSuperlikes}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.likeButton]}
              onPress={() => {
                if (!isPremium && remainingLikes === 0) {
                  showToast(t('today.likesExhaustedPremium'), 'success', 2500, () => router.push('/premium'));
                  return;
                }
                like();
              }}
              activeOpacity={0.7}
            >
              <View>
                <Ionicons name="heart" size={32} color={Colors.primary} />
                <View style={styles.likeBadge}>
                  <Text style={styles.likeBadgeText}>{remainingLikes}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.centeredFull}>
          <Ionicons name="heart" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t("today.empty")}</Text>
          <TouchableOpacity
            style={styles.secondChanceButton}
            onPress={resetPasses}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh-circle-outline"
              size={22}
              color={Colors.primary}
            />
            <Text style={styles.secondChanceText}>
              {t("today.secondChance")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <IceBreakerModal
        visible={iceBreakerModalVisible}
        onSend={handleSendIceBreaker}
        onClose={() => setIceBreakerModalVisible(false)}
        recipientName={currentProfile?.name ?? ""}
      />

      <MatchOverlay
        visible={matchResult?.matched === true}
        onChat={handleChat}
        onKeepExploring={handleKeepExploring}
      />
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 4,
      zIndex: 1,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    whoLikedButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    whoLikedText: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: c.primary,
    },
    refreshButton: {
      padding: 8,
    },
    verificationBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 24,
      marginBottom: 4,
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    verificationBannerPending: {
      backgroundColor: c.goldBg,
      borderColor: c.goldBorder,
    },
    verificationBannerText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
    },
    verificationBannerTextPending: {
      color: c.goldText,
    },
    cardWrapper: {
      flex: 1,
    },
    scrollContent: {
      alignItems: "center",
      paddingVertical: 8,
      paddingBottom: 80,
    },
    centeredFull: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      paddingHorizontal: 40,
    },
    loadingText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    errorText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    secondChanceButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.primaryPastel,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.primaryLight,
      marginTop: 8,
    },
    secondChanceText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.primary,
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      marginTop: 8,
    },
    retryText: {
      fontSize: 15,
      fontFamily: Fonts.bodyMedium,
      color: c.surface,
    },
    actions: {
      position: "absolute",
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "center",
      gap: 24,
    },
    actionButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 60,
      height: 60,
      borderRadius: 30,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    passButton: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    likeButton: {
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
    },
    iceBreakerButton: {
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
    },
    iceBreakerBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: c.primary,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    iceBreakerBadgeText: {
      fontSize: 9,
      fontFamily: Fonts.bodySemiBold,
      color: "#FFFFFF",
    },
    superlikeButton: {
      backgroundColor: c.goldBg,
      borderWidth: 1,
      borderColor: c.goldBorder,
    },
    superlikeBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: c.goldAccent,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    likeBadge: {
      position: "absolute",
      top: -4,
      right: -8,
      backgroundColor: c.primary,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    likeBadgeText: {
      fontSize: 9,
      fontFamily: Fonts.bodySemiBold,
      color: "#FFFFFF",
    },
    superlikeBadgeText: {
      fontSize: 9,
      fontFamily: Fonts.bodySemiBold,
      color: "#FFFFFF",
    },
  });
}

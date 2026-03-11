import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { type PurchasesPackage } from 'react-native-purchases';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { getOfferings, purchasePackage, restorePurchases } from '@/lib/purchases';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useDailyStatsStore } from '@/stores/dailyStatsStore';
import { useBoostStore } from '@/stores/boostStore';
import { showToast } from '@/stores/toastStore';

const PROMO_CODES: Record<string, number> = {
  SERENADEVIP: 365,
};

const PLAN_ORDER = ['$rc_monthly', '$rc_three_month', '$rc_annual'];

function planLabel(identifier: string, t: (key: string) => string): string {
  if (identifier.includes('monthly') || identifier === '$rc_monthly') return t('premium.monthlyPlan');
  if (identifier.includes('three') || identifier.includes('3month') || identifier === '$rc_three_month') return t('premium.3monthPlan');
  if (identifier.includes('annual') || identifier.includes('yearly') || identifier === '$rc_annual') return t('premium.yearlyPlan');
  return identifier;
}

function isBestValue(identifier: string): boolean {
  return identifier.includes('annual') || identifier.includes('yearly') || identifier === '$rc_annual';
}

export default function PremiumScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  useEffect(() => {
    (async () => {
      try {
        const offering = await getOfferings();
        if (offering) {
          // Sort packages in a predictable order
          const sorted = [...offering.availablePackages].sort((a, b) => {
            const aIdx = PLAN_ORDER.indexOf(a.packageType as string);
            const bIdx = PLAN_ORDER.indexOf(b.packageType as string);
            return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
          });
          setPackages(sorted);
          // Pre-select best value or first
          const best = sorted.find((p) => isBestValue(p.identifier)) ?? sorted[0];
          setSelectedPkg(best ?? null);
        }
      } catch {
        // Offerings may fail in sandbox/simulator
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setIsPurchasing(true);
    try {
      await purchasePackage(selectedPkg);
      await fetchProfile();
      useDailyStatsStore.getState().fetch();
      useBoostStore.getState().grantWeeklyIfNeeded();
      showToast(t('premium.purchaseSuccess'), 'success');
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('PURCHASE_CANCELLED') || msg.includes('userCancelled')) {
        // User cancelled — do nothing
      } else {
        showToast(t('premium.purchaseError'), 'error');
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const info = await restorePurchases();
      const hasActive = !!info.entitlements.active['Serenade Pro'];
      if (hasActive) {
        await fetchProfile();
        useDailyStatsStore.getState().fetch();
        useBoostStore.getState().grantWeeklyIfNeeded();
        showToast(t('premium.restoreSuccess'), 'success');
        router.back();
      } else {
        showToast(t('premium.restoreNone'), 'success');
      }
    } catch {
      showToast(t('premium.purchaseError'), 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRedeem = async () => {
    const code = promoCode.trim().toUpperCase();
    const days = PROMO_CODES[code];
    if (!days) {
      showToast(t('premium.invalidCode'), 'error');
      return;
    }
    setIsRedeeming(true);
    try {
      const premiumUntil = new Date();
      premiumUntil.setDate(premiumUntil.getDate() + days);
      const { data, error } = await supabase.rpc('activate_premium_purchase', {
        premium_until_ts: premiumUntil.toISOString(),
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      fetchProfile(); // fire-and-forget, don't block navigation
      useDailyStatsStore.getState().fetch();
      useBoostStore.getState().grantWeeklyIfNeeded();
      showToast(t('premium.codeSuccess'), 'success');
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('premium.purchaseError');
      showToast(msg, 'error');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 44 }}>💎</Text>
        <Text style={styles.title}>{t('premium.choosePlan')}</Text>

        {/* Benefits */}
        <View style={styles.benefits}>
          <Benefit icon="heart" color={Colors.primary} text={t('premium.benefit10Likes')} styles={styles} />
          <Benefit icon="star" color={Colors.goldAccent} text={t('premium.benefitSuperlike')} styles={styles} />
          <Benefit icon="chatbubble" color={Colors.primary} text={t('premium.benefitIceBreaker')} styles={styles} />
          <Benefit icon="eye" color={Colors.primary} text={t('premium.benefitReadReceipts')} styles={styles} />
          <Benefit icon="time" color={Colors.primary} text={t('premium.benefitLastSeen')} styles={styles} />
          <Benefit icon="flash" color={Colors.goldAccent} text={t('premium.benefitBoost')} styles={styles} />
        </View>

        {/* Plans */}
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={styles.noPlans}>{t('premium.noPlansAvailable')}</Text>
        ) : (
          <View style={styles.plans}>
            {packages.map((pkg) => {
              const isSelected = selectedPkg?.identifier === pkg.identifier;
              const bestValue = isBestValue(pkg.identifier);
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    bestValue && styles.planCardBest,
                  ]}
                  onPress={() => setSelectedPkg(pkg)}
                  activeOpacity={0.7}
                >
                  {bestValue && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>{t('premium.bestValue')}</Text>
                    </View>
                  )}
                  <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                    {planLabel(pkg.identifier, t)}
                  </Text>
                  <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                    {pkg.product.priceString}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Subscribe button */}
        {packages.length > 0 && (
          <TouchableOpacity
            style={[styles.subscribeButton, isPurchasing && styles.subscribeButtonDisabled]}
            onPress={handlePurchase}
            activeOpacity={0.7}
            disabled={isPurchasing || !selectedPkg}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={{ fontSize: 16 }}>💎</Text>
                <Text style={styles.subscribeText}>{t('premium.subscribe')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Restore */}
        <TouchableOpacity onPress={handleRestore} disabled={isRestoring} style={styles.restoreLink}>
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.textTertiary} />
          ) : (
            <Text style={styles.restoreText}>{t('premium.restorePurchases')}</Text>
          )}
        </TouchableOpacity>

        {/* Redeem code */}
        <View style={styles.redeemSection}>
          <Text style={styles.redeemTitle}>{t('premium.redeemTitle')}</Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.redeemInput}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder={t('premium.redeemPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.redeemButton, isRedeeming && styles.subscribeButtonDisabled]}
              onPress={handleRedeem}
              disabled={isRedeeming || !promoCode.trim()}
              activeOpacity={0.7}
            >
              {isRedeeming ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.redeemButtonText}>{t('premium.redeem')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ icon, color, text, styles }: { icon: string; color: string; text: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.benefit}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
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
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingBottom: 40,
      gap: 20,
    },
    title: {
      fontSize: 26,
      fontFamily: Fonts.heading,
      color: c.text,
      textAlign: 'center',
    },
    benefits: {
      width: '100%',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 20,
    },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
      flex: 1,
    },
    plans: {
      width: '100%',
      gap: 10,
    },
    planCard: {
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
    },
    planCardSelected: {
      borderColor: c.goldAccent,
      backgroundColor: c.goldBg,
    },
    planCardBest: {
      overflow: 'visible',
    },
    bestBadge: {
      position: 'absolute',
      top: -10,
      right: 16,
      backgroundColor: c.goldAccent,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    bestBadgeText: {
      fontSize: 10,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
      textTransform: 'uppercase',
    },
    planName: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    planNameSelected: {
      color: c.goldText,
    },
    planPrice: {
      fontSize: 16,
      fontFamily: Fonts.bodyBold,
      color: c.text,
    },
    planPriceSelected: {
      color: c.goldAccent,
    },
    noPlans: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    subscribeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.goldAccent,
      paddingVertical: 16,
      borderRadius: 24,
      width: '100%',
      marginTop: 4,
    },
    subscribeButtonDisabled: {
      opacity: 0.7,
    },
    subscribeText: {
      fontSize: 17,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
    restoreLink: {
      paddingVertical: 8,
    },
    restoreText: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textDecorationLine: 'underline',
    },
    redeemSection: {
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 20,
      gap: 10,
    },
    redeemTitle: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
    },
    redeemRow: {
      flexDirection: 'row',
      gap: 10,
    },
    redeemInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
      backgroundColor: c.surface,
    },
    redeemButton: {
      backgroundColor: c.goldAccent,
      borderRadius: 12,
      paddingHorizontal: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    redeemButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
  });
}

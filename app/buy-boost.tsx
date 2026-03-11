import { useState, useEffect } from 'react';
import {
  View,
  Text,
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
import { getBoostOffering, purchaseBoostPackage } from '@/lib/purchases';
import { useBoostStore } from '@/stores/boostStore';
import { showToast } from '@/stores/toastStore';

// Map package identifier → boost count granted
const BOOST_COUNTS: Record<string, number> = {
  boost_x1: 1,
  boost_x3: 3,
};

export default function BuyBoostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { fetch: fetchBoosts } = useBoostStore();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const offering = await getBoostOffering();
        if (offering) {
          // Sort: x1 first, x3 second
          const sorted = [...offering.availablePackages].sort((a, b) => {
            const order = ['boost_x1', 'boost_x3'];
            return order.indexOf(a.identifier) - order.indexOf(b.identifier);
          });
          setPackages(sorted);
        }
      } catch {
        // Offerings may fail in sandbox
      } finally {
        setLoadingOffering(false);
      }
    })();
  }, []);

  const handleBuy = async (pkg: PurchasesPackage) => {
    const count = BOOST_COUNTS[pkg.identifier] ?? 1;
    setPurchasing(true);
    try {
      await purchaseBoostPackage(pkg, count);
      await fetchBoosts();
      showToast(t('boost.activateSuccess'), 'success');
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('PURCHASE_CANCELLED') || msg.includes('userCancelled')) {
        // User cancelled — do nothing
      } else {
        showToast(t('common.error'), 'error');
      }
    } finally {
      setPurchasing(false);
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
        <Ionicons name="flash" size={48} color={Colors.goldAccent} />
        <Text style={styles.title}>{t('boost.title')}</Text>
        <Text style={styles.subtitle}>{t('boost.subtitle')}</Text>

        {loadingOffering ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
        ) : packages.length === 0 ? (
          <Text style={styles.noPlans}>{t('premium.noPlansAvailable')}</Text>
        ) : (
          <View style={styles.options}>
            {packages.map((pkg) => {
              const isBest = pkg.identifier === 'boost_x3';
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.optionCard, isBest && styles.optionCardBest]}
                  onPress={() => handleBuy(pkg)}
                  disabled={purchasing}
                  activeOpacity={0.7}
                >
                  {isBest && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>{t('premium.bestValue')}</Text>
                    </View>
                  )}
                  <Text style={[styles.optionTitle, isBest && { color: Colors.goldAccent }]}>
                    {t(pkg.identifier === 'boost_x1' ? 'boost.x1' : 'boost.x3')}
                  </Text>
                  <View style={styles.optionRight}>
                    <Text style={styles.optionPrice}>{pkg.product.priceString}</Text>
                    {isBest ? (
                      <View style={styles.flashRow}>
                        {[0, 1, 2].map((i) => (
                          <Ionicons key={i} name="flash" size={20} color={Colors.goldAccent} />
                        ))}
                      </View>
                    ) : (
                      <Ionicons name="flash" size={24} color={Colors.goldAccent} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {purchasing && (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
        )}
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
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    closeButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingBottom: 40,
      gap: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
    },
    noPlans: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      paddingVertical: 20,
    },
    options: {
      width: '100%',
      gap: 16,
      marginTop: 8,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    optionCardBest: {
      borderColor: c.goldAccent,
      borderWidth: 2,
      position: 'relative',
    },
    optionTitle: {
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    optionRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    optionPrice: {
      fontSize: 15,
      fontFamily: Fonts.bodyBold,
      color: c.textSecondary,
    },
    flashRow: {
      flexDirection: 'row',
      gap: 2,
    },
    bestBadge: {
      position: 'absolute',
      top: -12,
      right: 16,
      backgroundColor: c.goldAccent,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    bestBadgeText: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
  });
}

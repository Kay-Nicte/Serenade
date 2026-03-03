import { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { useBoostStore } from '@/stores/boostStore';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toastStore';

export default function BuyBoostScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { fetch: fetchBoosts } = useBoostStore();
  const [purchasing, setPurchasing] = useState(false);

  const handleBuy = async (count: number) => {
    setPurchasing(true);
    try {
      // TODO: integrate RevenueCat consumable product for boosts
      // For now, grant directly (dev/testing path)
      await supabase.rpc('add_boosts', { count });
      await fetchBoosts();
      showToast(t('boost.activateSuccess'), 'success');
      router.back();
    } catch {
      showToast(t('common.error'), 'error');
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
        <Ionicons name="flash" size={48} color="#E0A800" />
        <Text style={styles.title}>{t('boost.title')}</Text>
        <Text style={styles.subtitle}>{t('boost.subtitle')}</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => handleBuy(1)}
            disabled={purchasing}
            activeOpacity={0.7}
          >
            <Text style={styles.optionTitle}>{t('boost.x1')}</Text>
            <Ionicons name="flash" size={28} color="#E0A800" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionCard, styles.optionCardBest]}
            onPress={() => handleBuy(3)}
            disabled={purchasing}
            activeOpacity={0.7}
          >
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>{t('premium.bestValue')}</Text>
            </View>
            <Text style={[styles.optionTitle, { color: '#E0A800' }]}>{t('boost.x3')}</Text>
            <View style={styles.flashRow}>
              {[0, 1, 2].map((i) => (
                <Ionicons key={i} name="flash" size={24} color="#E0A800" />
              ))}
            </View>
          </TouchableOpacity>
        </View>

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
      borderColor: '#E0A800',
      borderWidth: 2,
      position: 'relative',
    },
    optionTitle: {
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    flashRow: {
      flexDirection: 'row',
      gap: 2,
    },
    bestBadge: {
      position: 'absolute',
      top: -12,
      right: 16,
      backgroundColor: '#E0A800',
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

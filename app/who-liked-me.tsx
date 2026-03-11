import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 24;
const GRID_GAP = 12;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

interface PendingLike {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  action: 'like' | 'superlike';
}

export default function WhoLikedMeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isPremium = useAuthStore((s) => s.profile?.is_premium ?? false);
  const [likes, setLikes] = useState<PendingLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const fetchLikes = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_pending_likes');
      if (error) throw error;
      setLikes(data ?? []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchLikes().finally(() => setIsLoading(false));
  }, [fetchLikes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLikes();
    setRefreshing(false);
  }, [fetchLikes]);

  const handleProfilePress = (userId: string) => {
    if (isPremium) {
      router.push(`/match-profile?userId=${userId}`);
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
        <Text style={styles.title}>{t('likes.title')}</Text>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : likes.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="heart-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('likes.empty')}</Text>
        </View>
      ) : (
        <>
          {!isPremium && (
            <TouchableOpacity
              style={styles.premiumCta}
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
            >
              <Ionicons name="lock-closed" size={18} color={Colors.primary} />
              <Text style={styles.premiumCtaText}>{t('likes.premiumCta')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}

          <FlatList
            data={likes}
            keyExtractor={(item) => item.id}
            numColumns={3}
            refreshing={refreshing}
            onRefresh={onRefresh}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.likeCard}
                onPress={() => handleProfilePress(item.id)}
                activeOpacity={isPremium ? 0.7 : 1}
              >
                {item.avatar_url ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.avatar}
                    contentFit="cover"
                    transition={200}
                    blurRadius={isPremium ? 0 : 20}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={30} color={Colors.primaryLight} />
                  </View>
                )}
                {item.action === 'superlike' && (
                  <View style={styles.superlikeBadge}>
                    <Ionicons name="star" size={12} color={Colors.goldAccent} />
                  </View>
                )}
                {item.is_verified && isPremium && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#fff" />
                  </View>
                )}
                {isPremium && (
                  <Text style={styles.likeName} numberOfLines={1}>
                    {item.name ?? ''}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 20,
      fontFamily: Fonts.heading,
      color: c.text,
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
      lineHeight: 24,
    },
    premiumCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: GRID_PADDING,
      marginTop: 16,
      marginBottom: 8,
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    premiumCtaText: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
    },
    grid: {
      paddingHorizontal: GRID_PADDING,
      paddingVertical: 16,
    },
    row: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    likeCard: {
      width: ITEM_SIZE,
      alignItems: 'center',
    },
    avatar: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    superlikeBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: c.goldBg,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    verifiedBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      backgroundColor: c.primary,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    likeName: {
      fontSize: 12,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
      marginTop: 4,
      textAlign: 'center',
    },
  });
}

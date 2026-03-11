import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useMatches } from '@/hooks/useMatches';
import { useIceBreakerStore } from '@/stores/iceBreakerStore';
import { useMatchStore } from '@/stores/matchStore';
import { ActionSheet, type ActionSheetOption } from '@/components/ActionSheet';
import type { Match } from '@/stores/matchStore';
import type { IceBreaker } from '@/stores/iceBreakerStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 24;
const ITEM_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

function formatMatchDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

function MatchCard({ match, onPress, onLongPress, onToggleFavorite, deletedLabel, styles, Colors }: { match: Match; onPress: () => void; onLongPress: () => void; onToggleFavorite: () => void; deletedLabel: string; styles: ReturnType<typeof makeStyles>; Colors: ReturnType<typeof useColors> }) {
  return (
    <TouchableOpacity
      style={styles.matchCard}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {match.otherUser.avatar_url ? (
        <Image
          source={{ uri: match.otherUser.avatar_url }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={40} color={Colors.primaryLight} />
        </View>
      )}
      <View style={styles.matchInfo}>
        <View style={styles.matchNameRow}>
          <Text style={[styles.matchName, !match.otherUser.name && styles.matchNameDeleted]} numberOfLines={1}>
            {match.otherUser.name ?? deletedLabel}
          </Text>
          {match.otherUser.is_verified && (
            <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
          )}
        </View>
        <Text style={styles.matchDate} numberOfLines={1}>
          <Ionicons name="heart" size={11} color={Colors.primary} />{' '}
          {formatMatchDate(match.created_at)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={onToggleFavorite}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={match.isFavorite ? 'heart' : 'heart-outline'}
          size={20}
          color={match.isFavorite ? Colors.primary : Colors.textTertiary}
        />
      </TouchableOpacity>
      {match.unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{match.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function IceBreakerCard({
  iceBreaker,
  onAccept,
  onDecline,
  onViewProfile,
  styles,
  Colors,
}: {
  iceBreaker: IceBreaker;
  onAccept: () => void;
  onDecline: () => void;
  onViewProfile: () => void;
  styles: ReturnType<typeof makeStyles>;
  Colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.ibCard}>
      <TouchableOpacity onPress={onViewProfile} activeOpacity={0.7}>
        {iceBreaker.sender.avatar_url ? (
          <Image
            source={{ uri: iceBreaker.sender.avatar_url }}
            style={styles.ibAvatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.ibAvatar, styles.ibAvatarPlaceholder]}>
            <Ionicons name="person" size={24} color={Colors.primaryLight} />
          </View>
        )}
        <Text style={styles.ibName} numberOfLines={1}>
          {iceBreaker.sender.name ?? ''}
        </Text>
      </TouchableOpacity>
      <Text style={styles.ibMessage} numberOfLines={2}>
        {iceBreaker.message}
      </Text>
      <View style={styles.ibActions}>
        <TouchableOpacity
          style={[styles.ibActionButton, styles.ibDeclineButton]}
          onPress={onDecline}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={Colors.error} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ibActionButton, styles.ibAcceptButton]}
          onPress={onAccept}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark" size={18} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MatchesScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const { matches, isLoading, refresh } = useMatches();
  const {
    pendingIceBreakers,
    isLoading: ibLoading,
    fetchPending,
    respondToIceBreaker,
  } = useIceBreakerStore();

  useEffect(() => {
    fetchPending();
  }, []);

  const handleMatchPress = (match: Match) => {
    router.push(`/(tabs)/chat/${match.id}`);
  };

  const [actionSheetMatch, setActionSheetMatch] = useState<Match | null>(null);

  const handleLongPress = useCallback((match: Match) => {
    setActionSheetMatch(match);
  }, []);

  const actionSheetOptions: ActionSheetOption[] = actionSheetMatch ? [
    {
      label: t('matches.unmatch'),
      icon: 'heart-dislike-outline',
      destructive: true,
      onPress: async () => {
        const match = actionSheetMatch;
        await useMatchStore.getState().unmatchUser(match.id);
        refresh();
      },
    },
  ] : [];

  const handleAcceptIceBreaker = useCallback(
    async (iceBreaker: IceBreaker) => {
      const result = await respondToIceBreaker(iceBreaker.id, true);
      if (result.matchId) {
        refresh();
        router.push(`/(tabs)/chat/${result.matchId}`);
      }
    },
    [respondToIceBreaker, refresh, router]
  );

  const handleDeclineIceBreaker = useCallback(
    (iceBreaker: IceBreaker) => {
      Alert.alert(
        t('iceBreaker.decline'),
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('iceBreaker.decline'),
            style: 'destructive',
            onPress: () => respondToIceBreaker(iceBreaker.id, false),
          },
        ]
      );
    },
    [respondToIceBreaker, t]
  );

  const handleRefresh = useCallback(() => {
    refresh();
    fetchPending();
  }, [refresh, fetchPending]);

  const renderIceBreakersHeader = useCallback(() => {
    if (pendingIceBreakers.length === 0) return null;

    return (
      <View style={styles.ibSection}>
        <Text style={styles.ibSectionTitle}>{t('iceBreaker.title')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ibScrollContent}
        >
          {pendingIceBreakers.map((ib) => (
            <IceBreakerCard
              key={ib.id}
              iceBreaker={ib}
              onAccept={() => handleAcceptIceBreaker(ib)}
              onDecline={() => handleDeclineIceBreaker(ib)}
              onViewProfile={() => router.push({ pathname: '/match-profile', params: { userId: ib.sender.id } })}
              styles={styles}
              Colors={Colors}
            />
          ))}
        </ScrollView>
      </View>
    );
  }, [pendingIceBreakers, t, handleAcceptIceBreaker, handleDeclineIceBreaker, styles, Colors]);

  const hasContent = matches.length > 0 || pendingIceBreakers.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('matches.title')}</Text>

      {isLoading && ibLoading && !hasContent ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : !hasContent ? (
        <View style={styles.centered}>
          <Ionicons name="sparkles" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('matches.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          ListHeaderComponent={renderIceBreakersHeader}
          renderItem={({ item }) => (
            <MatchCard match={item} onPress={() => handleMatchPress(item)} onLongPress={() => handleLongPress(item)} onToggleFavorite={() => useMatchStore.getState().toggleFavorite(item.id)} deletedLabel={t('matches.deletedUser')} styles={styles} Colors={Colors} />
          )}
          onRefresh={handleRefresh}
          refreshing={isLoading}
        />
      )}

      <ActionSheet
        visible={!!actionSheetMatch}
        title={actionSheetMatch ? t('matches.unmatchConfirmMessage', { name: actionSheetMatch.otherUser.name }) : ''}
        options={actionSheetOptions}
        onClose={() => setActionSheetMatch(null)}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
      paddingHorizontal: GRID_PADDING,
      paddingTop: 16,
      paddingBottom: 12,
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
    grid: {
      paddingHorizontal: GRID_PADDING,
      paddingBottom: 24,
    },
    row: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    matchCard: {
      width: ITEM_WIDTH,
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    avatar: {
      width: '100%',
      aspectRatio: 1,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    matchInfo: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    matchNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    matchName: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      flexShrink: 1,
    },
    matchNameDeleted: {
      color: c.textTertiary,
      fontStyle: 'italic',
    },
    matchDate: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      marginTop: 2,
    },
    favoriteButton: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 14,
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: c.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: Fonts.bodyBold,
      color: c.textOnPrimary,
    },
    // Ice Breaker styles
    ibSection: {
      marginBottom: 16,
      marginHorizontal: -GRID_PADDING,
    },
    ibSectionTitle: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.text,
      paddingHorizontal: GRID_PADDING,
      marginBottom: 12,
    },
    ibScrollContent: {
      paddingHorizontal: GRID_PADDING,
      gap: 12,
    },
    ibCard: {
      width: 160,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    ibAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignSelf: 'center',
      marginBottom: 8,
    },
    ibAvatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ibName: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    ibMessage: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 10,
      minHeight: 36,
    },
    ibActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    ibActionButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    ibDeclineButton: {
      backgroundColor: c.surfaceSecondary,
    },
    ibAcceptButton: {
      backgroundColor: c.primary,
    },
  });
}

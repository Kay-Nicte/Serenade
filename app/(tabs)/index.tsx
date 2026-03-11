import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useDailyProfiles } from '@/hooks/useDailyProfiles';
import { ProfileCard } from '@/components/ProfileCard';
import { MatchOverlay } from '@/components/MatchOverlay';
import { supabase } from '@/lib/supabase';
import { getPhotoUrl } from '@/lib/storage';

export default function TodayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    currentProfile,
    hasMore,
    isLoading,
    matchResult,
    like,
    pass,
    clearMatchResult,
  } = useDailyProfiles();

  const [candidatePhotos, setCandidatePhotos] = useState<{ uri: string }[]>([]);

  useEffect(() => {
    if (currentProfile) {
      supabase
        .from('photos')
        .select('storage_path, position')
        .eq('user_id', currentProfile.id)
        .order('position')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCandidatePhotos(data.map((p) => ({ uri: getPhotoUrl(p.storage_path) })));
          } else {
            setCandidatePhotos([]);
          }
        });
    } else {
      setCandidatePhotos([]);
    }
  }, [currentProfile?.id, currentProfile]);

  const handleChat = () => {
    if (matchResult?.match_id) {
      clearMatchResult();
      router.push(`/(tabs)/chat/${matchResult.match_id}`);
    }
  };

  const handleKeepExploring = () => {
    clearMatchResult();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{t('today.title')}</Text>

      <View style={styles.cardContainer}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>{t('today.loading')}</Text>
          </View>
        ) : currentProfile && hasMore ? (
          <>
            <ProfileCard profile={currentProfile} photos={candidatePhotos} />
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.passButton]}
                onPress={pass}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={32} color={Colors.textSecondary} />
                <Text style={styles.passText}>{t('today.pass')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.likeButton]}
                onPress={like}
                activeOpacity={0.7}
              >
                <Ionicons name="heart" size={32} color={Colors.primary} />
                <Text style={styles.likeText}>{t('today.like')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.centered}>
            <Ionicons name="heart" size={64} color={Colors.primaryLight} />
            <Text style={styles.emptyText}>{t('today.empty')}</Text>
          </View>
        )}
      </View>

      <MatchOverlay
        visible={matchResult?.matched === true}
        onChat={handleChat}
        onKeepExploring={handleKeepExploring}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.heading,
    color: Colors.text,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  centered: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingTop: 20,
    paddingBottom: 8,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  passButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  likeButton: {
    backgroundColor: Colors.primaryPastel,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  passText: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  likeText: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primaryDark,
    marginTop: 2,
  },
});

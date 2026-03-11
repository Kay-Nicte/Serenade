import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { getPhotoUrl } from '@/lib/storage';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useResponsive } from '@/hooks/useResponsive';

interface ProfileData {
  id: string;
  name: string | null;
  birth_date: string | null;
  bio: string | null;
  orientation: string[] | null;
  looking_for: string[] | null;
  avatar_url: string | null;
  interests: string[] | null;
  children: string | null;
  zodiac: string | null;
  zodiac_ascendant: string | null;
  pets: string[] | null;
  smoking: string | null;
  drinking: string | null;
  height_cm: number | null;
  hogwarts_house: string | null;
  hometown: string | null;
  languages: string[] | null;
  pronouns: string | null;
  gender_identity: string | null;
  relationship_type: string | null;
  exercise: string | null;
  education: string | null;
  profession: string | null;
  religion: string | null;
  music_genres: string[] | null;
}

function ensureArray(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.flatMap((v) => {
      const s = String(v).replace(/^\{|\}$/g, '');
      return s.includes(',') ? s.split(',').map((x) => x.replace(/"/g, '').trim()) : [s];
    });
  }
  if (typeof val === 'string') {
    const trimmed = val.replace(/^\{|\}$/g, '');
    return trimmed ? trimmed.split(',').map((s) => s.replace(/"/g, '').trim()) : [];
  }
  return [String(val)];
}

interface PhotoRow {
  id: string;
  storage_path: string;
  position: number;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function MatchProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const Colors = useColors();
  const { width } = useWindowDimensions();
  const { contentMaxWidth } = useResponsive();
  const carouselWidth = Math.min(width, contentMaxWidth);
  const styles = makeStyles(Colors);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;

      setIsLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, birth_date, bio, orientation, looking_for, avatar_url, interests, children, zodiac, zodiac_ascendant, pets, smoking, drinking, height_cm, hogwarts_house, hometown, languages, pronouns, gender_identity, relationship_type, exercise, education, profession, religion, music_genres')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData as ProfileData);

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select('id, storage_path, position')
          .eq('user_id', userId)
          .order('position');

        if (!photosError && photosData) {
          const photoUrls = (photosData as PhotoRow[]).map((p) => ({
            uri: getPhotoUrl(p.storage_path),
          }));
          setPhotos(photoUrls);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const age = calculateAge(profile?.birth_date ?? null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.error')}</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.name ?? ''}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PhotoCarousel
          photos={photos}
          fallbackUri={profile.avatar_url}
          width={carouselWidth}
          aspectRatio={3 / 4}
        />

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
            {age !== null && <Text style={styles.age}>{age}</Text>}
          </View>

          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('profile.bio')}</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          ) : null}

          <View style={styles.tags}>
            {ensureArray(profile.orientation).map((o, i) => (
              <View key={`o-${o}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>{t(`orientation.${o}`)}</Text>
              </View>
            ))}
            {ensureArray(profile.looking_for).map((lf, i) => (
              <View key={`lf-${lf}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>{t(`lookingFor.${lf}`)}</Text>
              </View>
            ))}
          </View>

          {/* Identity */}
          {(profile.pronouns || profile.gender_identity) && (
            <View style={styles.section}>
              {profile.pronouns && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.pronouns.title')}</Text>
                  <Text style={styles.detailValue}>{t(`profile.pronouns.${profile.pronouns}`)}</Text>
                </View>
              )}
              {profile.gender_identity && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.genderIdentity.title')}</Text>
                  <Text style={styles.detailValue}>{t(`profile.genderIdentity.${profile.gender_identity}`)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Dating */}
          {profile.relationship_type && (
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('profile.relationshipType.title')}</Text>
                <Text style={styles.detailValue}>{t(`profile.relationshipType.${profile.relationship_type}`)}</Text>
              </View>
            </View>
          )}

          {/* Life */}
          {(ensureArray(profile.languages).length > 0 || profile.profession || profile.education) && (
            <View style={styles.section}>
              {ensureArray(profile.languages).length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.languages.title')}</Text>
                  <Text style={styles.detailValue}>{ensureArray(profile.languages).map((l) => t(`profile.languages.${l}`)).join(', ')}</Text>
                </View>
              )}
              {profile.profession && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.profession.title')}</Text>
                  <Text style={styles.detailValue}>{profile.profession}</Text>
                </View>
              )}
              {profile.education && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.education.title')}</Text>
                  <Text style={styles.detailValue}>{t(`profile.education.${profile.education}`)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Hobbies */}
          {ensureArray(profile.interests).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('profile.interests')}</Text>
              <View style={styles.tags}>
                {ensureArray(profile.interests).map((int, i) => (
                  <View key={`int-${int}-${i}`} style={styles.interestTag}>
                    <Text style={styles.interestTagText}>{t(`interests.${int}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {ensureArray(profile.music_genres).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('profile.musicGenres.title')}</Text>
              <View style={styles.tags}>
                {ensureArray(profile.music_genres).map((g, i) => (
                  <View key={`mg-${g}-${i}`} style={styles.interestTag}>
                    <Text style={styles.interestTagText}>{t(`profile.musicGenres.${g}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Physical */}
          {(profile.exercise || profile.height_cm) && (
            <View style={styles.section}>
              {profile.exercise && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.exercise.title')}</Text>
                  <Text style={styles.detailValue}>{t(`profile.exercise.${profile.exercise}`)}</Text>
                </View>
              )}
              {profile.height_cm && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.height')}</Text>
                  <Text style={styles.detailValue}>{t('profile.heightCm', { cm: profile.height_cm })}</Text>
                </View>
              )}
            </View>
          )}

          {/* Lifestyle */}
          {(profile.children || profile.smoking || profile.drinking) && (
            <View style={styles.section}>
              {profile.children && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.children')}</Text>
                  <Text style={styles.detailValue}>{t(`children.${profile.children}`)}</Text>
                </View>
              )}
              {ensureArray(profile.pets).length > 0 && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.pets')}</Text>
                  <Text style={styles.detailValue}>
                    {ensureArray(profile.pets).map((p) => t(`pets.${p}`)).join(', ')}
                  </Text>
                </View>
              )}
              {profile.smoking && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.smoking')}</Text>
                  <Text style={styles.detailValue}>{t(`smoking.${profile.smoking}`)}</Text>
                </View>
              )}
              {profile.drinking && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.drinking')}</Text>
                  <Text style={styles.detailValue}>{t(`drinking.${profile.drinking}`)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Fun / Astrology */}
          {(profile.zodiac || profile.zodiac_ascendant) && (
            <View style={styles.section}>
              {profile.zodiac && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.zodiac')}</Text>
                  <Text style={styles.detailValue}>{t(`zodiac.${profile.zodiac}`)}</Text>
                </View>
              )}
              {profile.zodiac_ascendant && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('profile.zodiacAscendant')}</Text>
                  <Text style={styles.detailValue}>{t(`zodiac.${profile.zodiac_ascendant}`)}</Text>
                </View>
              )}
            </View>
          )}

          {profile.religion && (
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('profile.religion.title')}</Text>
                <Text style={styles.detailValue}>{t(`profile.religion.${profile.religion}`)}</Text>
              </View>
            </View>
          )}

          {profile.hometown && (
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('profile.hometown')}</Text>
                <Text style={styles.detailValue}>{profile.hometown}</Text>
              </View>
            </View>
          )}

          {profile.hogwarts_house && (
            <View style={styles.section}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('profile.hogwartsHouse')}</Text>
                <Text style={styles.detailValue}>{t(`hogwarts.${profile.hogwarts_house}`)}</Text>
              </View>
            </View>
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
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
      backgroundColor: c.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
    },
    info: {
      padding: 24,
      gap: 16,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    name: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
      flexShrink: 1,
    },
    age: {
      fontSize: 24,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    section: {
      gap: 6,
    },
    sectionLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    bio: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
      lineHeight: 24,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    tag: {
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    tagText: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.primaryDark,
    },
    interestTag: {
      backgroundColor: '#E8F5E9',
      borderWidth: 1,
      borderColor: '#A5D6A7',
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    interestTagText: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: '#2E7D32',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    detailLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
    },
  });
}

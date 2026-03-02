import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { useAuthStore, type Profile } from '@/stores/authStore';
import { usePromptStore, type ProfilePrompt } from '@/stores/promptStore';

// Ensure orientation/looking_for are always clean string arrays
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

type ActivityLevel = 'today' | 'this_week' | 'this_month' | 'inactive';

function computeCompatibility(myProfile: Profile | null, otherProfile: Profile): number | null {
  if (!myProfile) return null;
  const myInterests = new Set(ensureArray(myProfile.interests));
  const otherInterests = ensureArray(otherProfile.interests);
  const sharedInterests = otherInterests.filter((i) => myInterests.has(i));
  const totalInterests = Math.max(myInterests.size, otherInterests.length, 1);

  const myLF = new Set(ensureArray(myProfile.looking_for));
  const otherLF = ensureArray(otherProfile.looking_for);
  const sharedLF = otherLF.filter((lf) => myLF.has(lf));

  const myOrient = new Set(ensureArray(myProfile.orientation));
  const otherOrient = ensureArray(otherProfile.orientation);
  const sharedOrient = otherOrient.filter((o) => myOrient.has(o));

  const score =
    (sharedInterests.length / totalInterests) * 60 +
    (sharedLF.length > 0 ? 25 : 0) +
    (sharedOrient.length > 0 ? 15 : 0);

  return Math.round(score);
}

interface ProfileCardProps {
  profile: Profile;
  photos?: { uri: string }[];
  activityLevel?: ActivityLevel | null;
  lastSeen?: string;
  showActivityLevel?: boolean;
  isSuperlike?: boolean;
  showCompatibility?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

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

const ACTIVITY_CONFIG: Record<ActivityLevel, { color: string; i18nKey: string }> = {
  today: { color: Colors.success, i18nKey: 'today.activityToday' },
  this_week: { color: Colors.warning, i18nKey: 'today.activityThisWeek' },
  this_month: { color: '#E0A050', i18nKey: 'today.activityThisMonth' },
  inactive: { color: Colors.textTertiary, i18nKey: 'today.activityInactive' },
};

function formatInactiveTime(lastSeen: string | undefined, t: (key: string, opts?: any) => string): string {
  if (!lastSeen) return t('today.activityInactive');
  const diff = Date.now() - new Date(lastSeen).getTime();
  const days = Math.floor(diff / (24 * 3600000));
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    if (weeks <= 1) return t('today.inactiveWeek');
    return t('today.inactiveWeeks', { count: weeks });
  }
  const months = Math.floor(days / 30);
  if (months === 1) return t('today.inactiveMonth');
  if (months < 12) return t('today.inactiveMonths', { count: months });
  const years = Math.floor(months / 12);
  if (years === 1) return t('today.inactiveYear');
  return t('today.inactiveYears', { count: years });
}

export function ProfileCard({ profile, photos, activityLevel, lastSeen, showActivityLevel, isSuperlike, showCompatibility }: ProfileCardProps) {
  const { t } = useTranslation();
  const age = calculateAge(profile.birth_date);
  const myProfile = useAuthStore((s) => s.profile);
  const compatibility = showCompatibility ? computeCompatibility(myProfile, profile) : null;
  const [prompts, setPrompts] = useState<ProfilePrompt[]>([]);

  useEffect(() => {
    if (profile.id && profile.id !== myProfile?.id) {
      usePromptStore.getState().fetchPromptsForUser(profile.id).then(setPrompts);
    }
  }, [profile.id]);

  return (
    <View style={styles.card}>
      <View>
        <PhotoCarousel
          photos={photos ?? []}
          fallbackUri={profile.avatar_url}
          width={CARD_WIDTH}
        />
        {compatibility !== null && compatibility >= 30 && (
          <View style={styles.compatBadge}>
            <Ionicons name="heart" size={12} color={Colors.primary} />
            <Text style={styles.compatText}>{compatibility}%</Text>
          </View>
        )}
      </View>

      {isSuperlike && (
        <View style={styles.superlikeBanner}>
          <Text style={styles.superlikeBannerText}>
            {'⭐ '}{t('superlike.receivedBadge')}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.is_verified && (
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} style={{ marginLeft: 4 }} />
          )}
          {age !== null && <Text style={styles.age}>{age}</Text>}
        </View>

        {showActivityLevel && activityLevel && (
          <View style={styles.activityRow}>
            <View
              style={[
                styles.activityDot,
                { backgroundColor: ACTIVITY_CONFIG[activityLevel].color },
              ]}
            />
            <Text style={styles.activityText}>
              {activityLevel === 'inactive'
                ? formatInactiveTime(lastSeen, t)
                : t(ACTIVITY_CONFIG[activityLevel].i18nKey)}
            </Text>
          </View>
        )}

        {profile.hometown ? (
          <View style={styles.hometownRow}>
            <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.hometownText}>{profile.hometown}</Text>
          </View>
        ) : null}

        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {prompts.length > 0 && (
          <View style={styles.promptsSection}>
            {prompts.map((p) => (
              <View key={p.id} style={styles.promptItem}>
                <Text style={styles.promptQuestion}>{t(`prompts.prompt_${p.prompt_key}`)}</Text>
                <Text style={styles.promptAnswer}>{p.answer}</Text>
              </View>
            ))}
          </View>
        )}

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
          {ensureArray(profile.interests).map((int, i) => (
            <View key={`int-${int}-${i}`} style={styles.interestTag}>
              <Text style={styles.interestTagText}>{t(`interests.${int}`)}</Text>
            </View>
          ))}
        </View>

        {(profile.zodiac || profile.height_cm || profile.hogwarts_house) && (
          <View style={styles.detailRow}>
            {profile.zodiac && (
              <View style={styles.detailItem}>
                <Ionicons name="star-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.detailText}>{t(`zodiac.${profile.zodiac}`)}</Text>
              </View>
            )}
            {profile.zodiac_ascendant && (
              <View style={styles.detailItem}>
                <Ionicons name="moon-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.detailText}>{t(`zodiac.${profile.zodiac_ascendant}`)}</Text>
              </View>
            )}
            {profile.height_cm && (
              <View style={styles.detailItem}>
                <Ionicons name="resize-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.detailText}>{t('profile.heightCm', { cm: profile.height_cm })}</Text>
              </View>
            )}
            {profile.hogwarts_house && (
              <View style={styles.detailItem}>
                <Ionicons name="shield-outline" size={14} color={Colors.primaryDark} />
                <Text style={styles.detailText}>{t(`hogwarts.${profile.hogwarts_house}`)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  photoPlaceholder: {
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    padding: 20,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    fontSize: 26,
    fontFamily: Fonts.heading,
    color: Colors.text,
    flexShrink: 1,
  },
  age: {
    fontSize: 22,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
  },
  hometownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hometownText: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  bio: {
    fontSize: 15,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    backgroundColor: Colors.primaryPastel,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primaryDark,
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
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  compatBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compatText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.primary,
  },
  promptsSection: {
    gap: 10,
  },
  promptItem: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  promptQuestion: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textTertiary,
    marginBottom: 4,
  },
  promptAnswer: {
    fontSize: 15,
    fontFamily: Fonts.body,
    color: Colors.text,
    lineHeight: 22,
  },
  superlikeBanner: {
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  superlikeBannerText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    color: '#E0A800',
  },
});

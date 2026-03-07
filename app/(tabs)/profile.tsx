import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { Config, ORIENTATIONS, LOOKING_FOR_OPTIONS, INTERESTS, CHILDREN_OPTIONS, ZODIAC_SIGNS, PET_OPTIONS, SMOKING_OPTIONS, DRINKING_OPTIONS, HOGWARTS_HOUSES, LANGUAGES, PRONOUNS, GENDER_IDENTITY, RELATIONSHIP_TYPE, EXERCISE_OPTIONS, EDUCATION_OPTIONS, RELIGION_OPTIONS, MUSIC_GENRES } from '@/constants/config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';

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
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuthStore } from '@/stores/authStore';
import { usePhotos } from '@/hooks/usePhotos';
import { useDiscoveryPreferences } from '@/hooks/useDiscoveryPreferences';
import { pickImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { requestLocationPermission, reverseGeocodeCity, searchCities, type CitySuggestion } from '@/lib/location';
import { useResponsive } from '@/hooks/useResponsive';
import { showToast } from '@/stores/toastStore';
import { useStreak } from '@/hooks/useStreak';
import { useDailyStatsStore } from '@/stores/dailyStatsStore';
import { useBoostStore } from '@/stores/boostStore';
import { supabase } from '@/lib/supabase';
import { usePromptStore, type ProfilePrompt } from '@/stores/promptStore';

const LOOKING_FOR = LOOKING_FOR_OPTIONS;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const { user, profile, updateProfile, fetchProfile } = useAuthStore();
  const { photos, addPhoto, removePhoto, reorderPhotos } = usePhotos(user?.id);
  const { preferences } = useDiscoveryPreferences();
  const { isTablet, contentMaxWidth, horizontalPadding } = useResponsive();
  useStreak(); // triggers fetch on mount

  // Refresh profile and boost state on tab focus
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchBoosts();
    }, [fetchProfile, fetchBoosts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchProfile(), fetchBoosts()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchProfile, fetchBoosts]);

  const isPremium = profile?.is_premium ?? false;
  const isTrial = profile?.is_trial ?? false;
  const premiumUntil = profile?.premium_until ?? null;
  const isPaused = profile?.is_paused ?? false;
  const { availableBoosts, boostedUntil, secondsRemaining, activateBoost, fetch: fetchBoosts } = useBoostStore();
  const isBoostActive = boostedUntil !== null && boostedUntil > new Date();
  const currentStreak = useDailyStatsStore((s) => s.currentStreak);
  const availableSuperlikes = useDailyStatsStore((s) => s.availableSuperlikes);
  const availableIceBreakers = useDailyStatsStore((s) => s.availableIceBreakers);
  const remainingLikes = useDailyStatsStore((s) => s.remainingLikes);
  const totalLikes = useDailyStatsStore((s) => s.totalLikes);

  // Profile completion: count filled required fields (diamond-marked + photos)
  // Excluded from premium requirement: hogwarts_house, gender_identity, religion, pronouns, education
  const profileRequiredChecks = [
    !!profile?.name?.trim(),
    !!profile?.birth_date,
    !!profile?.bio?.trim(),
    ensureArray(profile?.orientation).length > 0,
    ensureArray(profile?.looking_for).length > 0,
    ensureArray(profile?.interests).length > 0,
    !!profile?.children,
    !!profile?.zodiac,
    !!profile?.zodiac_ascendant,
    ensureArray(profile?.pets).length > 0,
    !!profile?.smoking,
    !!profile?.drinking,
    !!profile?.height_cm,
    !!profile?.relationship_type,
    ensureArray(profile?.languages).length > 0,
    !!profile?.profession?.trim(),
    !!profile?.exercise,
    ensureArray(profile?.music_genres).length > 0,
    photos.length > 0,
  ];
  const profileCompletedCount = profileRequiredChecks.filter(Boolean).length;
  const profileCompletionPct = Math.round((profileCompletedCount / profileRequiredChecks.length) * 100);
  const isProfileFullyComplete = profileCompletedCount === profileRequiredChecks.length;

  // Whether to show premium diamond hints on fields
  const showPremiumHints = !isPremium && !premiumUntil;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [orientations, setOrientations] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [children, setChildren] = useState<string | null>(null);
  const [zodiac, setZodiac] = useState<string | null>(null);
  const [zodiacAscendant, setZodiacAscendant] = useState<string | null>(null);
  const [pets, setPets] = useState<string[]>([]);
  const [smokingVal, setSmokingVal] = useState<string | null>(null);
  const [drinkingVal, setDrinkingVal] = useState<string | null>(null);
  const [heightCm, setHeightCm] = useState<string>('');
  const [hogwartsHouse, setHogwartsHouse] = useState<string | null>(null);
  const [hometown, setHometown] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState<string | null>(null);
  const [genderIdentity, setGenderIdentity] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState<string | null>(null);
  const [exercise, setExercise] = useState<string | null>(null);
  const [education, setEducation] = useState<string | null>(null);
  const [profession, setProfession] = useState('');
  const [religion, setReligion] = useState<string | null>(null);
  const [musicGenres, setMusicGenres] = useState<string[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const citySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showStreakInfo, setShowStreakInfo] = useState(false);
  const [trialGranted, setTrialGranted] = useState(false);

  // Prompts state
  const { myPrompts, fetchMyPrompts, upsertPrompt, deletePrompt: deletePromptStore } = usePromptStore();
  const [editingPromptPosition, setEditingPromptPosition] = useState<number | null>(null);
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [editingPromptAnswer, setEditingPromptAnswer] = useState('');
  const [showPromptPicker, setShowPromptPicker] = useState(false);

  const PROMPT_KEYS = [
    'perfect_sunday', 'red_flag', 'rewatched_show', 'fridge_staple',
    'hidden_talent', 'random_fact', 'dinner_guest', 'current_song',
    'worst_cook', 'guilty_pleasure', 'overly_excited', 'best_advice',
    'no_work', 'comfort_movie', 'youll_like_me_if',
  ];

  useEffect(() => {
    fetchMyPrompts();
  }, []);

  const isUnderage = (() => {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!d || !m || !y || year.length < 4) return false;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = (today.getMonth() + 1) - m;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
    return age < 18;
  })();

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setBio(profile.bio ?? '');
      setOrientations(profile.orientation ?? []);
      setLookingFor(profile.looking_for ?? []);
      setInterests(profile.interests ?? []);
      setChildren(profile.children ?? null);
      setZodiac(profile.zodiac ?? null);
      setZodiacAscendant(profile.zodiac_ascendant ?? null);
      setPets(profile.pets ?? []);
      setSmokingVal(profile.smoking ?? null);
      setDrinkingVal(profile.drinking ?? null);
      setHeightCm(profile.height_cm ? String(profile.height_cm) : '');
      setHogwartsHouse(profile.hogwarts_house ?? null);
      setHometown(profile.hometown ?? '');
      setLanguages(profile.languages ?? []);
      setPronouns(profile.pronouns ?? null);
      setGenderIdentity(profile.gender_identity ?? null);
      setRelationshipType(profile.relationship_type ?? null);
      setExercise(profile.exercise ?? null);
      setEducation(profile.education ?? null);
      setProfession(profile.profession ?? '');
      setReligion(profile.religion ?? null);
      setMusicGenres(profile.music_genres ?? []);
      if (profile.birth_date) {
        const [y, m, d] = profile.birth_date.split('-');
        setYear(y);
        setMonth(m);
        setDay(d);
      }
    }
  }, [profile, editing]);

  const handleAddPhoto = async (position: number) => {
    try {
      const uri = await pickImage();
      if (!uri || !user) return;
      await addPhoto(user.id, uri, position);
      await fetchProfile();
    } catch (error: any) {
      if (error?.message === 'PERMISSION_DENIED') {
        showToast(t('common.photoPermissionDenied'), 'error');
      } else {
        showToast(error?.message ?? t('common.error'), 'error');
      }
    }
  };

  const handleRemovePhoto = async (photo: Parameters<typeof removePhoto>[0]) => {
    await removePhoto(photo);
    await fetchProfile();
  };

  const toggleOrientation = (o: string) => {
    setOrientations((prev) => prev.includes(o) ? [] : [o]);
  };

  const toggleLookingFor = (lf: string) => {
    setLookingFor((prev) => prev.includes(lf) ? prev.filter((x) => x !== lf) : [...prev, lf]);
  };

  const toggleInterest = (i: string) => {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };
  const toggleSingleSelect = (current: string | null, value: string, setter: (v: string | null) => void) => {
    setter(current === value ? null : value);
  };
  const togglePet = (p: string) => {
    setPets((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };
  const PremiumLabel = ({ label }: { label: string }) => (
    <View style={styles.premiumLabelRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {showPremiumHints && <Text style={{ fontSize: 12 }}>💎</Text>}
    </View>
  );

  const toggleLanguage = (l: string) => {
    setLanguages((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  };
  const toggleMusicGenre = (g: string) => {
    setMusicGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  // Hometown autocomplete + GPS handlers
  useEffect(() => {
    return () => {
      if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);
    };
  }, []);

  const handleHometownChange = (text: string) => {
    setHometown(text);
    if (citySearchTimerRef.current) clearTimeout(citySearchTimerRef.current);

    if (text.trim().length < 2) {
      setCitySuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    setCitySearching(true);

    citySearchTimerRef.current = setTimeout(async () => {
      const results = await searchCities(text);
      setCitySuggestions(results);
      setCitySearching(false);
    }, 500);
  };

  const handleSelectCity = (suggestion: CitySuggestion) => {
    setHometown(suggestion.display);
    setCitySuggestions([]);
    setShowSuggestions(false);
  };

  const handleGpsDetect = async () => {
    setGpsLoading(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        showToast(t('profile.hometownGpsError'), 'error');
        return;
      }
      const city = await reverseGeocodeCity();
      if (city) {
        setHometown(city);
        setShowSuggestions(false);
        setCitySuggestions([]);
      } else {
        showToast(t('profile.hometownGpsError'), 'error');
      }
    } catch {
      showToast(t('profile.hometownGpsError'), 'error');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || isUnderage) return;
    setSaving(true);
    try {
      const birthDateString =
        day && month && year
          ? `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          : profile?.birth_date ?? null;

      await updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        birth_date: birthDateString,
        orientation: orientations.length > 0 ? orientations : null,
        looking_for: lookingFor.length > 0 ? lookingFor : null,
        interests: interests.length > 0 ? interests : null,
        children: children,
        zodiac: zodiac,
        zodiac_ascendant: zodiacAscendant,
        pets: pets.length > 0 ? pets : null,
        smoking: smokingVal,
        drinking: drinkingVal,
        height_cm: heightCm ? parseInt(heightCm, 10) || null : null,
        hogwarts_house: hogwartsHouse,
        hometown: hometown.trim() || null,
        languages: languages.length > 0 ? languages : null,
        pronouns: pronouns,
        gender_identity: genderIdentity,
        relationship_type: relationshipType,
        exercise: exercise,
        education: education,
        profession: profession.trim() || null,
        religion: religion,
        music_genres: musicGenres.length > 0 ? musicGenres : null,
      } as any);

      // Try to activate premium trial if user hasn't had it yet
      // The RPC checks profile completeness server-side
      if (!isPremium && !premiumUntil) {
        try {
          const { data } = await supabase.rpc('activate_premium_trial');
          if (data?.granted) {
            setSaving(false);
            setTrialGranted(true);
            return; // Stay in edit mode to show the modal
          }
        } catch {
          // Non-critical
        }
      }

      setEditing(false);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- VIEW MODE ---
  if (!editing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }, isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('tabs.profile')}</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
                <Ionicons name="create-outline" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
                <Ionicons name="settings-outline" size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pause banner */}
          {isPaused && (
            <TouchableOpacity
              style={styles.pauseBanner}
              onPress={() => router.push('/settings')}
              activeOpacity={0.8}
            >
              <Ionicons name="pause-circle" size={20} color={Colors.warning} />
              <Text style={styles.pauseBannerText}>{t('profile.pausedBanner')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.warning} />
            </TouchableOpacity>
          )}

          <View style={styles.card}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.primary} />
              </View>
            )}

            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile?.name ?? '—'}</Text>
              {profile?.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
                  <Text style={styles.verifiedBadgeText}>{t('verification.verified')}</Text>
                </View>
              )}
            </View>

            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={{ fontSize: 12 }}>💎</Text>
                <Text style={styles.premiumBadgeText}>{t('premium.badge')}</Text>
                {premiumUntil && (
                  <Text style={styles.premiumExpiry}>
                    {t('premium.expiresOn', { date: new Date(premiumUntil).toLocaleDateString() })}
                  </Text>
                )}
              </View>
            )}

            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}

            {/* Premium trial teaser — profile incomplete + never had premium */}
            {!isPremium && !premiumUntil && !isProfileFullyComplete && (
              <TouchableOpacity
                style={styles.premiumTeaser}
                onPress={() => setEditing(true)}
                activeOpacity={0.7}
              >
                <View style={styles.premiumTeaserHeader}>
                  <Text style={{ fontSize: 18 }}>💎</Text>
                  <Text style={styles.premiumTeaserPct}>{profileCompletionPct}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${profileCompletionPct}%` }]} />
                </View>
                <Text style={styles.premiumTeaserText}>{t('premium.completeProfileTeaserDiamond')}</Text>
              </TouchableOpacity>
            )}

            {/* Premium Upsell — visible for non-premium users and trial users */}
            {(!isPremium || isTrial) && (
              <View style={styles.premiumUpsell}>
                <Text style={styles.premiumUpsellTitle}>
                  {t('premium.upsellTitle')} {'✨'}
                </Text>
                <Text style={styles.premiumUpsellDescription}>
                  {t('premium.upsellDescription')}
                </Text>
                <TouchableOpacity
                  style={styles.premiumUpsellButton}
                  onPress={() => router.push('/premium')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.premiumUpsellButtonText}>{t('premium.viewPlans')}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.info}>
              {/* Basics */}
              {profile?.hometown && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.hometown')}</Text>
                  <Text style={styles.infoValue}>{profile.hometown}</Text>
                </View>
              )}
              {profile?.birth_date && (() => {
                const birth = new Date(profile.birth_date);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                  age--;
                }
                return (
                  <View style={styles.infoRow}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                    <Text style={styles.infoLabel}>{t('profile.age')}</Text>
                    <Text style={styles.infoValue}>{t('profile.ageValue', { age })}</Text>
                  </View>
                );
              })()}
              {/* Identity */}
              {profile?.pronouns && (
                <View style={styles.infoRow}>
                  <Ionicons name="chatbox-ellipses-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.pronouns.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.pronouns.${profile.pronouns}`)}</Text>
                </View>
              )}
              {profile?.gender_identity && (
                <View style={styles.infoRow}>
                  <Ionicons name="transgender-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.genderIdentity.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.genderIdentity.${profile.gender_identity}`)}</Text>
                </View>
              )}
              {/* Dating */}
              {ensureArray(profile?.orientation).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="heart-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.orientation')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.orientation).map((o) => t(`orientation.${o}`)).join(', ')}
                  </Text>
                </View>
              )}
              {ensureArray(profile?.looking_for).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="compass-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.lookingFor')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.looking_for).map((lf) => t(`lookingFor.${lf}`)).join(', ')}
                  </Text>
                </View>
              )}
              {profile?.relationship_type && (
                <View style={styles.infoRow}>
                  <Ionicons name="heart-half-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.relationshipType.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.relationshipType.${profile.relationship_type}`)}</Text>
                </View>
              )}
              {/* Life */}
              {ensureArray(profile?.languages).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="language-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.languages.title')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.languages).map((l) => t(`profile.languages.${l}`)).join(', ')}
                  </Text>
                </View>
              )}
              {profile?.profession && (
                <View style={styles.infoRow}>
                  <Ionicons name="briefcase-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.profession.title')}</Text>
                  <Text style={styles.infoValue}>{profile.profession}</Text>
                </View>
              )}
              {profile?.education && (
                <View style={styles.infoRow}>
                  <Ionicons name="school-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.education.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.education.${profile.education}`)}</Text>
                </View>
              )}
              {/* Hobbies */}
              {ensureArray(profile?.interests).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="sparkles-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.interests')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.interests).map((i) => t(`interests.${i}`)).join(', ')}
                  </Text>
                </View>
              )}
              {ensureArray(profile?.music_genres).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="musical-notes-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.musicGenres.title')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.music_genres).map((g) => t(`profile.musicGenres.${g}`)).join(', ')}
                  </Text>
                </View>
              )}
              {/* Physical */}
              {profile?.exercise && (
                <View style={styles.infoRow}>
                  <Ionicons name="barbell-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.exercise.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.exercise.${profile.exercise}`)}</Text>
                </View>
              )}
              {profile?.height_cm && (
                <View style={styles.infoRow}>
                  <Ionicons name="resize-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.height')}</Text>
                  <Text style={styles.infoValue}>{t('profile.heightCm', { cm: profile.height_cm })}</Text>
                </View>
              )}
              {/* Lifestyle */}
              {profile?.children && (
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.children')}</Text>
                  <Text style={styles.infoValue}>{t(`children.${profile.children}`)}</Text>
                </View>
              )}
              {ensureArray(profile?.pets).length > 0 && (
                <View style={styles.infoRow}>
                  <Ionicons name="paw-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.pets')}</Text>
                  <Text style={styles.infoValue}>
                    {ensureArray(profile?.pets).map((p) => t(`pets.${p}`)).join(', ')}
                  </Text>
                </View>
              )}
              {profile?.smoking && (
                <View style={styles.infoRow}>
                  <Ionicons name="leaf-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.smoking')}</Text>
                  <Text style={styles.infoValue}>{t(`smoking.${profile.smoking}`)}</Text>
                </View>
              )}
              {profile?.drinking && (
                <View style={styles.infoRow}>
                  <Ionicons name="wine-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.drinking')}</Text>
                  <Text style={styles.infoValue}>{t(`drinking.${profile.drinking}`)}</Text>
                </View>
              )}
              {/* Fun / Astrology */}
              {profile?.zodiac && (
                <View style={styles.infoRow}>
                  <Ionicons name="star-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.zodiac')}</Text>
                  <Text style={styles.infoValue}>{t(`zodiac.${profile.zodiac}`)}</Text>
                </View>
              )}
              {profile?.zodiac_ascendant && (
                <View style={styles.infoRow}>
                  <Ionicons name="moon-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.zodiacAscendant')}</Text>
                  <Text style={styles.infoValue}>{t(`zodiac.${profile.zodiac_ascendant}`)}</Text>
                </View>
              )}
              {profile?.religion && (
                <View style={styles.infoRow}>
                  <Ionicons name="leaf-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.religion.title')}</Text>
                  <Text style={styles.infoValue}>{t(`profile.religion.${profile.religion}`)}</Text>
                </View>
              )}
              {profile?.hogwarts_house && (
                <View style={styles.infoRow}>
                  <Ionicons name="shield-outline" size={16} color={Colors.primaryDark} style={styles.infoIcon} />
                  <Text style={styles.infoLabel}>{t('profile.hogwartsHouse')}</Text>
                  <Text style={styles.infoValue}>{t(`hogwarts.${profile.hogwarts_house}`)}</Text>
                </View>
              )}
            </View>

            {/* Profile Prompts — View Mode */}
            {myPrompts.length > 0 && (
              <View style={styles.promptsViewSection}>
                <Text style={styles.promptsSectionTitle}>{t('prompts.title')}</Text>
                {myPrompts.map((p) => (
                  <View key={p.id} style={styles.promptViewItem}>
                    <Text style={styles.promptViewQuestion}>{t(`prompts.prompt_${p.prompt_key}`)}</Text>
                    <Text style={styles.promptViewAnswer}>{p.answer}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Verification banner */}
          {!profile?.is_verified && (
            <TouchableOpacity
              style={[
                styles.verificationBanner,
                profile?.verification_status === 'pending' && styles.verificationBannerPending,
              ]}
              onPress={() => {
                if (profile?.verification_status !== 'pending') {
                  router.push('/verify-identity');
                }
              }}
              activeOpacity={profile?.verification_status === 'pending' ? 1 : 0.7}
            >
              <Ionicons
                name={profile?.verification_status === 'pending' ? 'time-outline' : 'shield-checkmark-outline'}
                size={20}
                color={profile?.verification_status === 'pending' ? Colors.warning : Colors.primary}
              />
              <View style={styles.verificationBannerContent}>
                <Text style={[styles.verificationBannerTitle, profile?.verification_status === 'pending' && { color: Colors.goldText }]}>
                  {profile?.verification_status === 'pending'
                    ? t('verification.pendingTitle')
                    : t('verification.promptTitle')}
                </Text>
                <Text style={[styles.verificationBannerSubtitle, profile?.verification_status === 'pending' && { color: Colors.goldText }]}>
                  {profile?.verification_status === 'pending'
                    ? t('verification.bannerPending')
                    : t('verification.banner')}
                </Text>
              </View>
              {profile?.verification_status !== 'pending' && (
                <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          )}

          {/* Boost Card */}
          {(isPremium || availableBoosts > 0 || isBoostActive) && (
            <View style={[styles.streakCard, styles.boostCard]}>
              <View style={styles.streakHeader}>
                <Ionicons name="flash" size={22} color={Colors.goldAccent} />
                <Text style={styles.streakTitle}>{t('profile.boostTitle')}</Text>
              </View>
              {isBoostActive ? (
                <View style={styles.boostActiveRow}>
                  <Text style={styles.boostCountdown}>
                    {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}
                  </Text>
                  <Text style={styles.boostActiveLabel}>{t('profile.boostActive')}</Text>
                </View>
              ) : (
                <View style={styles.boostActions}>
                  {availableBoosts > 0 ? (
                    <TouchableOpacity
                      style={styles.boostButton}
                      onPress={async () => {
                        const result = await activateBoost();
                        if (result.success) {
                          showToast(t('boost.activated'), 'success');
                        } else {
                          showToast(t('boost.errorNoBoosts'), 'error');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash" size={18} color="#fff" />
                      <Text style={styles.boostButtonText}>{t('profile.boostActivate')}</Text>
                      <View style={styles.boostBadge}>
                        <Text style={styles.boostBadgeText}>{availableBoosts}</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.boostBuyButton}
                      onPress={() => router.push('/buy-boost')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="flash-outline" size={18} color={Colors.goldAccent} />
                      <Text style={styles.boostBuyButtonText}>{t('profile.boostBuy')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Streak Card */}
          <View style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <Ionicons name="flame" size={22} color={Colors.warning} />
              <Text style={styles.streakTitle}>{t('streak.title')}</Text>
              <TouchableOpacity onPress={() => setShowStreakInfo((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showStreakInfo ? 'information-circle' : 'information-circle-outline'}
                  size={20}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
            {showStreakInfo && (
              <Text style={styles.streakInfoText}>{t('streak.info')}</Text>
            )}
            {currentStreak > 0 ? (
              <Text style={styles.streakValue}>
                {currentStreak === 1 ? t('streak.day') : t('streak.days', { count: currentStreak })}
              </Text>
            ) : (
              <Text style={styles.streakEmpty}>{t('streak.noStreak')}</Text>
            )}
            <View style={styles.streakItems}>
              <View style={styles.streakItem}>
                <Ionicons name="heart" size={16} color={Colors.primary} />
                <Text style={styles.streakItemText}>
                  {t('streak.remainingLikes', { remaining: remainingLikes, total: totalLikes })}
                </Text>
                {currentStreak >= 2 && currentStreak < 10 && (
                  <Text style={styles.streakBonus}>+1</Text>
                )}
              </View>
              <View style={styles.streakItem}>
                <Ionicons name="star" size={16} color={Colors.warning} />
                <Text style={styles.streakItemText}>
                  {t('streak.availableSuperlikes', { count: availableSuperlikes })}
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Ionicons name="chatbubble" size={16} color={Colors.primary} />
                <Text style={styles.streakItemText}>
                  {t('streak.availableIceBreakers', { count: availableIceBreakers })}
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Ionicons name="flash" size={16} color={Colors.warning} />
                <Text style={styles.streakItemText}>
                  {t('streak.availableBoosts', { count: availableBoosts })}
                </Text>
              </View>
            </View>
          </View>

          {/* Discovery Preferences */}
          <View style={styles.discoveryCard}>
            <View style={styles.discoveryHeader}>
              <Text style={styles.discoveryTitle}>{t('discovery.title')}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('discovery.ageRange')}</Text>
                <Text style={styles.infoValue}>
                  {preferences?.min_age ?? Config.minAge} — {preferences?.max_age ?? Config.maxAge} {t('discovery.years')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('discovery.distance')}</Text>
                <Text style={styles.infoValue}>
                  {preferences?.max_distance
                    ? `${preferences.max_distance} km`
                    : t('discovery.distanceAll')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('discovery.orientations')}</Text>
                <Text style={styles.infoValue}>
                  {preferences?.orientations?.length
                    ? preferences.orientations.map((o) => t(`orientation.${o}`)).join(', ')
                    : t('discovery.orientationsAll')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('discovery.lookingFor')}</Text>
                <Text style={styles.infoValue}>
                  {preferences?.looking_for?.length
                    ? preferences.looking_for.map((lf) => t(`lookingFor.${lf}`)).join(', ')
                    : t('discovery.lookingForAll')}
                </Text>
              </View>
            </View>
            <Button
              title={t('discovery.edit')}
              onPress={() => router.push('/discovery-preferences')}
              variant="outline"
            />
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- EDIT MODE ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }, isTablet && { maxWidth: contentMaxWidth, alignSelf: 'center' as const, width: '100%' as const }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('tabs.profile')}</Text>
            <TouchableOpacity onPress={() => setEditing(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Photos */}
          <PhotoGrid
            photos={photos}
            onAdd={handleAddPhoto}
            onRemove={handleRemovePhoto}
            onReorder={(ordered) => user && reorderPhotos(user.id, ordered)}
            editable
          />

          {/* Name */}
          <PremiumLabel label={t('profile.name')} />
          <Input
            value={name}
            onChangeText={setName}
            placeholder={t('profile.namePlaceholder')}
            maxLength={Config.maxNameLength}
          />

          {/* Hometown */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.hometown')}</Text>
            <View style={styles.hometownInputWrapper}>
              <TextInput
                style={styles.hometownInput}
                value={hometown}
                onChangeText={handleHometownChange}
                placeholder={t('profile.hometownPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                onFocus={() => {
                  if (hometown.trim().length >= 2 && citySuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
              />
              <TouchableOpacity
                onPress={handleGpsDetect}
                style={styles.gpsButton}
                hitSlop={8}
                disabled={gpsLoading}
              >
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                {citySearching ? (
                  <View style={styles.suggestionItem}>
                    <ActivityIndicator size="small" color={Colors.textTertiary} />
                    <Text style={styles.suggestionText}>{t('profile.hometownSearching')}</Text>
                  </View>
                ) : citySuggestions.length === 0 && hometown.trim().length >= 2 ? (
                  <View style={styles.suggestionItem}>
                    <Text style={styles.suggestionTextMuted}>{t('profile.hometownNoResults')}</Text>
                  </View>
                ) : (
                  citySuggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={`${s.display}-${idx}`}
                      style={[
                        styles.suggestionItem,
                        idx < citySuggestions.length - 1 && styles.suggestionItemBorder,
                      ]}
                      onPress={() => handleSelectCity(s)}
                    >
                      <Ionicons name="location-outline" size={16} color={Colors.textTertiary} />
                      <Text style={styles.suggestionText}>{s.display}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Birth Date */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.birthDate')} />
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <TextInput
                  style={styles.dateInput}
                  placeholder={t('profile.dayPlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={setDay}
                />
              </View>
              <Text style={styles.dateSeparator}>/</Text>
              <View style={styles.dateField}>
                <TextInput
                  style={styles.dateInput}
                  placeholder={t('profile.monthPlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={setMonth}
                />
              </View>
              <Text style={styles.dateSeparator}>/</Text>
              <View style={styles.dateFieldYear}>
                <TextInput
                  style={styles.dateInput}
                  placeholder={t('profile.yearPlaceholder')}
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                />
              </View>
            </View>
            {isUnderage && (
              <Text style={styles.underageError}>{t('profile.underageError')}</Text>
            )}
          </View>

          {/* Bio */}
          <PremiumLabel label={t('profile.bio')} />
          <Input
            value={bio}
            onChangeText={setBio}
            placeholder={t('profile.bioPlaceholder')}
            multiline
            numberOfLines={4}
            maxLength={Config.maxBioLength}
          />

          {/* --- Identity --- */}
          {/* Pronouns */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.pronouns.title')}</Text>
            <View style={styles.tags}>
              {PRONOUNS.map((p) => (
                <Tag key={p} label={t(`profile.pronouns.${p}`)} selected={pronouns === p} onPress={() => toggleSingleSelect(pronouns, p, setPronouns)} />
              ))}
            </View>
          </View>

          {/* Gender Identity */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.genderIdentity.title')}</Text>
            <View style={styles.tags}>
              {GENDER_IDENTITY.map((g) => (
                <Tag key={g} label={t(`profile.genderIdentity.${g}`)} selected={genderIdentity === g} onPress={() => toggleSingleSelect(genderIdentity, g, setGenderIdentity)} />
              ))}
            </View>
          </View>

          {/* --- Dating --- */}
          {/* Orientation */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.orientation')} />
            <View style={styles.tags}>
              {ORIENTATIONS.map((o) => (
                <Tag key={o} label={t(`orientation.${o}`)} selected={orientations.includes(o)} onPress={() => toggleOrientation(o)} />
              ))}
            </View>
          </View>

          {/* Looking For */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.lookingFor')} />
            <View style={styles.tags}>
              {LOOKING_FOR.map((lf) => (
                <Tag key={lf} label={t(`lookingFor.${lf}`)} selected={lookingFor.includes(lf)} onPress={() => toggleLookingFor(lf)} />
              ))}
            </View>
          </View>

          {/* Relationship Type */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.relationshipType.title')} />
            <View style={styles.tags}>
              {RELATIONSHIP_TYPE.map((r) => (
                <Tag key={r} label={t(`profile.relationshipType.${r}`)} selected={relationshipType === r} onPress={() => toggleSingleSelect(relationshipType, r, setRelationshipType)} />
              ))}
            </View>
          </View>

          {/* --- Life --- */}
          {/* Languages */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.languages.title')} />
            <View style={styles.tags}>
              {LANGUAGES.map((l) => (
                <Tag key={l} label={t(`profile.languages.${l}`)} selected={languages.includes(l)} onPress={() => toggleLanguage(l)} />
              ))}
            </View>
          </View>

          {/* Profession */}
          <PremiumLabel label={t('profile.profession.title')} />
          <Input
            value={profession}
            onChangeText={setProfession}
            placeholder={t('profile.profession.title')}
            maxLength={100}
          />

          {/* Education */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.education.title')}</Text>
            <View style={styles.tags}>
              {EDUCATION_OPTIONS.map((e) => (
                <Tag key={e} label={t(`profile.education.${e}`)} selected={education === e} onPress={() => toggleSingleSelect(education, e, setEducation)} />
              ))}
            </View>
          </View>

          {/* --- Hobbies --- */}
          {/* Interests */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.interests')} />
            <View style={styles.tags}>
              {INTERESTS.map((i) => (
                <Tag key={i} label={t(`interests.${i}`)} selected={interests.includes(i)} onPress={() => toggleInterest(i)} />
              ))}
            </View>
          </View>

          {/* Music Genres */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.musicGenres.title')} />
            <View style={styles.tags}>
              {MUSIC_GENRES.map((g) => (
                <Tag key={g} label={t(`profile.musicGenres.${g}`)} selected={musicGenres.includes(g)} onPress={() => toggleMusicGenre(g)} />
              ))}
            </View>
          </View>

          {/* --- Physical --- */}
          {/* Exercise */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.exercise.title')} />
            <View style={styles.tags}>
              {EXERCISE_OPTIONS.map((e) => (
                <Tag key={e} label={t(`profile.exercise.${e}`)} selected={exercise === e} onPress={() => toggleSingleSelect(exercise, e, setExercise)} />
              ))}
            </View>
          </View>

          {/* Height */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.height')} />
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <TextInput
                  style={styles.dateInput}
                  placeholder="cm"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={3}
                  value={heightCm}
                  onChangeText={setHeightCm}
                />
              </View>
              <Text style={styles.dateSeparator}>cm</Text>
            </View>
          </View>

          {/* --- Lifestyle --- */}
          {/* Children */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.children')} />
            <View style={styles.tags}>
              {CHILDREN_OPTIONS.map((c) => (
                <Tag key={c} label={t(`children.${c}`)} selected={children === c} onPress={() => toggleSingleSelect(children, c, setChildren)} />
              ))}
            </View>
          </View>

          {/* Pets */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.pets')} />
            <View style={styles.tags}>
              {PET_OPTIONS.map((p) => (
                <Tag key={p} label={t(`pets.${p}`)} selected={pets.includes(p)} onPress={() => togglePet(p)} />
              ))}
            </View>
          </View>

          {/* Smoking */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.smoking')} />
            <View style={styles.tags}>
              {SMOKING_OPTIONS.map((s) => (
                <Tag key={s} label={t(`smoking.${s}`)} selected={smokingVal === s} onPress={() => toggleSingleSelect(smokingVal, s, setSmokingVal)} />
              ))}
            </View>
          </View>

          {/* Drinking */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.drinking')} />
            <View style={styles.tags}>
              {DRINKING_OPTIONS.map((d) => (
                <Tag key={d} label={t(`drinking.${d}`)} selected={drinkingVal === d} onPress={() => toggleSingleSelect(drinkingVal, d, setDrinkingVal)} />
              ))}
            </View>
          </View>

          {/* --- Fun / Astrology --- */}
          {/* Zodiac */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.zodiac')} />
            <View style={styles.tags}>
              {ZODIAC_SIGNS.map((z) => (
                <Tag key={z} label={t(`zodiac.${z}`)} selected={zodiac === z} onPress={() => toggleSingleSelect(zodiac, z, setZodiac)} />
              ))}
            </View>
          </View>

          {/* Zodiac Ascendant */}
          <View style={styles.section}>
            <PremiumLabel label={t('profile.zodiacAscendant')} />
            <View style={styles.tags}>
              {ZODIAC_SIGNS.map((z) => (
                <Tag key={z} label={t(`zodiac.${z}`)} selected={zodiacAscendant === z} onPress={() => toggleSingleSelect(zodiacAscendant, z, setZodiacAscendant)} />
              ))}
            </View>
          </View>

          {/* Religion */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.religion.title')}</Text>
            <View style={styles.tags}>
              {RELIGION_OPTIONS.map((r) => (
                <Tag key={r} label={t(`profile.religion.${r}`)} selected={religion === r} onPress={() => toggleSingleSelect(religion, r, setReligion)} />
              ))}
            </View>
          </View>

          {/* Hogwarts House */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.hogwartsHouse')}</Text>
            <View style={styles.tags}>
              {HOGWARTS_HOUSES.map((h) => (
                <Tag key={h} label={t(`hogwarts.${h}`)} selected={hogwartsHouse === h} onPress={() => toggleSingleSelect(hogwartsHouse, h, setHogwartsHouse)} />
              ))}
            </View>
          </View>

          {/* Profile Prompts — Edit Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('prompts.title')}</Text>
            {[0, 1, 2].map((pos) => {
              const existing = myPrompts.find((p) => p.position === pos);
              return (
                <View key={pos} style={styles.promptEditSlot}>
                  {existing ? (
                    <TouchableOpacity
                      style={styles.promptEditFilled}
                      onPress={() => {
                        setEditingPromptPosition(pos);
                        setEditingPromptKey(existing.prompt_key);
                        setEditingPromptAnswer(existing.answer);
                        setShowPromptPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.promptEditHeader}>
                        <Text style={styles.promptEditQuestion} numberOfLines={1}>
                          {t(`prompts.prompt_${existing.prompt_key}`)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => deletePromptStore(pos)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.promptEditAnswer} numberOfLines={2}>{existing.answer}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.promptEditEmpty}
                      onPress={() => {
                        setEditingPromptPosition(pos);
                        setEditingPromptKey(null);
                        setEditingPromptAnswer('');
                        setShowPromptPicker(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                      <Text style={styles.promptEditAddText}>{t('prompts.addPrompt')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Prompt picker / editor inline */}
            {editingPromptPosition !== null && (
              <View style={styles.promptEditor}>
                {showPromptPicker || !editingPromptKey ? (
                  <View style={styles.promptPickerList}>
                    <Text style={styles.promptPickerTitle}>{t('prompts.selectPrompt')}</Text>
                    {PROMPT_KEYS.filter((k) => !myPrompts.some((p) => p.prompt_key === k)).map((key) => (
                      <TouchableOpacity
                        key={key}
                        style={styles.promptPickerItem}
                        onPress={() => {
                          setEditingPromptKey(key);
                          setShowPromptPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.promptPickerItemText}>{t(`prompts.prompt_${key}`)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.promptAnswerEditor}>
                    <Text style={styles.promptAnswerLabel}>{t(`prompts.prompt_${editingPromptKey}`)}</Text>
                    <TextInput
                      style={styles.promptAnswerInput}
                      value={editingPromptAnswer}
                      onChangeText={setEditingPromptAnswer}
                      placeholder={t('prompts.answerPlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      multiline
                      maxLength={200}
                    />
                    <View style={styles.promptAnswerActions}>
                      <TouchableOpacity
                        onPress={() => setEditingPromptPosition(null)}
                        style={styles.promptCancelButton}
                      >
                        <Text style={styles.promptCancelText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          if (editingPromptKey && editingPromptAnswer.trim() && editingPromptPosition !== null) {
                            await upsertPrompt(editingPromptKey, editingPromptAnswer.trim(), editingPromptPosition);
                            setEditingPromptPosition(null);
                          }
                        }}
                        style={[styles.promptSaveButton, !editingPromptAnswer.trim() && { opacity: 0.5 }]}
                        disabled={!editingPromptAnswer.trim()}
                      >
                        <Text style={styles.promptSaveText}>{t('common.save')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          <Button
            title={t('common.save')}
            onPress={handleSave}
            loading={saving}
            disabled={!name.trim() || isUnderage}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Premium trial modal */}
      <Modal visible={trialGranted} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 36 }}>💎</Text>
            <Text style={styles.modalTitle}>{t('premium.trialTitle')}</Text>
            <Text style={styles.modalDescription}>{t('premium.trialDescription')}</Text>
            <View style={styles.modalBenefits}>
              <View style={styles.modalBenefit}>
                <Ionicons name="heart" size={18} color={Colors.primary} />
                <Text style={styles.modalBenefitText}>{t('premium.benefit10Likes')}</Text>
              </View>
              <View style={styles.modalBenefit}>
                <Ionicons name="star" size={18} color={Colors.goldAccent} />
                <Text style={styles.modalBenefitText}>{t('premium.benefitSuperlike')}</Text>
              </View>
              <View style={styles.modalBenefit}>
                <Ionicons name="chatbubble" size={18} color={Colors.primary} />
                <Text style={styles.modalBenefitText}>{t('premium.benefitIceBreaker')}</Text>
              </View>
              <View style={styles.modalBenefit}>
                <Ionicons name="eye" size={18} color={Colors.primary} />
                <Text style={styles.modalBenefitText}>{t('premium.benefitReadReceipts')}</Text>
              </View>
              <View style={styles.modalBenefit}>
                <Ionicons name="time" size={18} color={Colors.primary} />
                <Text style={styles.modalBenefitText}>{t('premium.benefitLastSeen')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => { setTrialGranted(false); fetchProfile(); setEditing(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
      gap: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 16,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    card: {
      padding: 24,
      backgroundColor: c.surface,
      borderRadius: 20,
      alignItems: 'center',
      gap: 12,
      shadowColor: c.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    name: {
      fontSize: 22,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    verifiedBadgeText: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
      color: c.success,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.goldBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.goldBorder,
    },
    premiumBadgeText: {
      fontSize: 13,
      fontFamily: Fonts.bodySemiBold,
      color: c.goldAccent,
    },
    premiumExpiry: {
      fontSize: 11,
      fontFamily: Fonts.body,
      color: c.goldText,
      marginLeft: 4,
    },
    bio: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    info: {
      width: '100%',
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    infoIcon: {
      width: 20,
      textAlign: 'center',
    },
    infoLabel: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      flexShrink: 1,
      textAlign: 'right',
      marginLeft: 'auto',
    },
    section: {
      gap: 10,
    },
    sectionLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      marginLeft: 4,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dateField: {
      flex: 1,
      height: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      justifyContent: 'center',
    },
    dateFieldYear: {
      flex: 1.5,
      height: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      justifyContent: 'center',
    },
    dateInput: {
      textAlign: 'center',
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
    },
    dateSeparator: {
      fontSize: 18,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    underageError: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.error,
      marginTop: 4,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    saveButton: {
      marginTop: 4,
    },
    hometownInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    hometownInput: {
      flex: 1,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
      height: 52,
    },
    gpsButton: {
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      height: 52,
    },
    suggestionsContainer: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      marginTop: 4,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    suggestionItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    suggestionText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      flex: 1,
    },
    suggestionTextMuted: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    pauseBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.goldBg,
      borderWidth: 1,
      borderColor: c.goldBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    pauseBannerText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.goldText,
    },
    boostCard: {
      borderWidth: 1,
      borderColor: c.goldBorder,
    },
    boostActiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    boostCountdown: {
      fontSize: 32,
      fontFamily: Fonts.heading,
      color: c.goldAccent,
    },
    boostActiveLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    boostActions: {
      flexDirection: 'row',
    },
    boostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.goldAccent,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    boostButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
    boostBadge: {
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    boostBadgeText: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: '#fff',
    },
    boostBuyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.goldAccent,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    boostBuyButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.goldAccent,
    },
    streakCard: {
      padding: 20,
      backgroundColor: c.surface,
      borderRadius: 20,
      gap: 12,
      shadowColor: c.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    streakHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    streakTitle: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    streakValue: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    streakEmpty: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    streakItems: {
      gap: 8,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    streakItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    streakItemText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    streakBonus: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
      color: c.success,
    },
    streakInfoText: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 19,
      backgroundColor: c.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      overflow: 'hidden',
    },
    discoveryCard: {
      padding: 20,
      backgroundColor: c.surface,
      borderRadius: 20,
      gap: 14,
      shadowColor: c.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    discoveryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    premiumTeaser: {
      gap: 10,
      backgroundColor: c.goldBg,
      borderWidth: 1,
      borderColor: c.goldBorder,
      borderRadius: 16,
      padding: 14,
    },
    premiumTeaserHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    premiumTeaserPct: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.goldText,
    },
    progressBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.goldBorder,
      overflow: 'hidden' as const,
    },
    progressBarFill: {
      height: '100%' as const,
      borderRadius: 4,
      backgroundColor: c.goldAccent,
    },
    premiumTeaserText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.goldText,
      lineHeight: 20,
    },
    premiumLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    verificationBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.primaryPastel,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderRadius: 16,
      padding: 16,
    },
    verificationBannerPending: {
      backgroundColor: c.goldBg,
      borderColor: c.goldBorder,
    },
    verificationBannerContent: {
      flex: 1,
      gap: 2,
    },
    verificationBannerTitle: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    verificationBannerSubtitle: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
    },
    premiumUpsell: {
      backgroundColor: '#7B4A5C',
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 5,
    },
    premiumUpsellTitle: {
      fontSize: 22,
      fontFamily: Fonts.heading,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    premiumUpsellDescription: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      lineHeight: 20,
    },
    premiumUpsellButton: {
      marginTop: 6,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: '#D4A574',
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
    },
    premiumUpsellButtonText: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: '#D4A574',
    },
    discoveryTitle: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    modalCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      padding: 28,
      alignItems: 'center',
      gap: 14,
      width: '100%',
      maxWidth: 360,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    modalTitle: {
      fontSize: 22,
      fontFamily: Fonts.heading,
      color: c.text,
      textAlign: 'center',
    },
    modalDescription: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    modalBenefits: {
      width: '100%',
      gap: 10,
      paddingVertical: 4,
    },
    modalBenefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modalBenefitText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
      flex: 1,
    },
    modalButton: {
      backgroundColor: c.primary,
      paddingHorizontal: 40,
      paddingVertical: 14,
      borderRadius: 24,
      marginTop: 4,
    },
    modalButtonText: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    // Prompts view styles
    promptsViewSection: {
      marginTop: 12,
      gap: 10,
    },
    promptsSectionTitle: {
      fontSize: 16,
      fontFamily: Fonts.heading,
      color: c.text,
      marginBottom: 4,
    },
    promptViewItem: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    promptViewQuestion: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      marginBottom: 4,
    },
    promptViewAnswer: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.text,
      lineHeight: 22,
    },
    // Prompts edit styles
    promptEditSlot: {
      marginBottom: 8,
    },
    promptEditFilled: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    promptEditHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    promptEditQuestion: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      flex: 1,
    },
    promptEditAnswer: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      marginTop: 4,
    },
    promptEditEmpty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.primaryLight,
      borderStyle: 'dashed',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    promptEditAddText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.primary,
    },
    promptEditor: {
      marginTop: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderLight,
      padding: 12,
    },
    promptPickerList: {
      gap: 4,
    },
    promptPickerTitle: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginBottom: 8,
    },
    promptPickerItem: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: c.surfaceSecondary,
      marginBottom: 4,
    },
    promptPickerItemText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
    },
    promptAnswerEditor: {
      gap: 8,
    },
    promptAnswerLabel: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.textSecondary,
    },
    promptAnswerInput: {
      borderWidth: 1,
      borderColor: c.borderLight,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.text,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    promptAnswerActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    promptCancelButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    promptCancelText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    promptSaveButton: {
      backgroundColor: c.primary,
      borderRadius: 20,
      paddingVertical: 8,
      paddingHorizontal: 20,
    },
    promptSaveText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
  });
}

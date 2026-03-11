import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { Config, ORIENTATIONS, LOOKING_FOR_OPTIONS, INTERESTS, CHILDREN_OPTIONS, ZODIAC_SIGNS, PET_OPTIONS, SMOKING_OPTIONS, DRINKING_OPTIONS, HOGWARTS_HOUSES } from '@/constants/config';
import { useAuthStore } from '@/stores/authStore';
import { usePhotoStore, type Photo } from '@/stores/photoStore';
import { pickImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

const LOOKING_FOR = LOOKING_FOR_OPTIONS;

export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, updateProfile } = useAuthStore();
  const { photos, addPhoto, removePhoto, reorderPhotos } = usePhotoStore();
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const [name, setName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
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
  const [loading, setLoading] = useState(false);
  const [trialGranted, setTrialGranted] = useState(false);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const yearNum = parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1900 && yearNum <= new Date().getFullYear();

  const birthDateString =
    day && month && isValidYear
      ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      : null;

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

  const [photoLoading, setPhotoLoading] = useState(false);

  const handleAddPhoto = async (position: number) => {
    try {
      const uri = await pickImage();
      if (!uri || !user) return;
      setPhotoLoading(true);
      await addPhoto(user.id, uri, position);
    } catch (error: any) {
      if (error?.message === 'PERMISSION_DENIED') {
        showToast(t('common.photoPermissionDenied'), 'error');
      } else {
        showToast(error?.message ?? t('common.error'), 'error');
      }
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleRemovePhoto = async (photo: Photo) => {
    await removePhoto(photo);
  };

  const handleSave = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      // Save profile data WITHOUT marking complete yet
      // (marking complete triggers navigation, which would unmount the modal)
      await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          birth_date: birthDateString,
          bio: bio.trim(),
          orientation: orientations,
          looking_for: lookingFor,
          interests: interests.length > 0 ? interests : null,
          children: children,
          zodiac: zodiac,
          zodiac_ascendant: zodiacAscendant,
          pets: pets.length > 0 ? pets : null,
          smoking: smokingVal,
          drinking: drinkingVal,
          height_cm: heightCm ? parseInt(heightCm, 10) || null : null,
          hogwarts_house: hogwartsHouse,
        })
        .eq('id', user!.id);

      // Activate 7-day premium free trial ONLY if profile is fully complete
      if (isProfileFullyComplete) {
        try {
          const { data } = await supabase.rpc('activate_premium_trial');
          if (data?.granted) {
            setTrialGranted(true);
            setLoading(false);
            return; // Wait for modal dismiss before marking complete
          }
        } catch {
          // Non-critical: trial activation failure should not block profile completion
        }
      }

      // Show verification prompt before marking complete
      setShowVerifyPrompt(true);
      setLoading(false);
      return;
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTrialDismiss = async () => {
    setTrialGranted(false);
    // Show verification prompt before navigating
    setShowVerifyPrompt(true);
  };

  const handleVerifyNow = async () => {
    setShowVerifyPrompt(false);
    await updateProfile({ is_profile_complete: true } as any);
    // Small delay so navigation to tabs completes before pushing modal
    setTimeout(() => router.push('/verify-identity'), 300);
  };

  const handleVerifyLater = async () => {
    setShowVerifyPrompt(false);
    await updateProfile({ is_profile_complete: true } as any);
  };

  const isValid = name.trim() && birthDateString && !isUnderage && photos.length > 0;

  // Profile is fully complete when ALL fields are filled (hogwarts_house excluded)
  const isProfileFullyComplete =
    isValid &&
    bio.trim().length > 0 &&
    orientations.length > 0 &&
    lookingFor.length > 0 &&
    interests.length > 0 &&
    children !== null &&
    zodiac !== null &&
    zodiacAscendant !== null &&
    pets.length > 0 &&
    smokingVal !== null &&
    drinkingVal !== null &&
    (heightCm !== '' && parseInt(heightCm, 10) > 0);

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>{t('profile.completeTitle')}</Text>
          <Text style={styles.subtitle}>{t('profile.completeSubtitle')}</Text>

          {/* Premium teaser */}
          <View style={styles.premiumTeaser}>
            <Text style={{ fontSize: 18 }}>💎</Text>
            <Text style={styles.premiumTeaserText}>{t('premium.completeProfileTeaser')}</Text>
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
          <Input
            label={t('profile.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('profile.namePlaceholder')}
            maxLength={Config.maxNameLength}
          />

          {/* Birth Date */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.birthDate')}</Text>
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
          <Input
            label={t('profile.bio')}
            value={bio}
            onChangeText={setBio}
            placeholder={t('profile.bioPlaceholder')}
            multiline
            numberOfLines={4}
            maxLength={Config.maxBioLength}
          />

          {/* Orientation */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.orientation')}</Text>
            <View style={styles.tags}>
              {ORIENTATIONS.map((o) => (
                <Tag
                  key={o}
                  label={t(`orientation.${o}`)}
                  selected={orientations.includes(o)}
                  onPress={() => toggleOrientation(o)}
                />
              ))}
            </View>
          </View>

          {/* Looking For */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.lookingFor')}</Text>
            <View style={styles.tags}>
              {LOOKING_FOR.map((lf) => (
                <Tag
                  key={lf}
                  label={t(`lookingFor.${lf}`)}
                  selected={lookingFor.includes(lf)}
                  onPress={() => toggleLookingFor(lf)}
                />
              ))}
            </View>
          </View>

          {/* Interests */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.interests')}</Text>
            <View style={styles.tags}>
              {INTERESTS.map((i) => (
                <Tag key={i} label={t(`interests.${i}`)} selected={interests.includes(i)} onPress={() => toggleInterest(i)} />
              ))}
            </View>
          </View>

          {/* Zodiac */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.zodiac')}</Text>
            <View style={styles.tags}>
              {ZODIAC_SIGNS.map((z) => (
                <Tag key={z} label={t(`zodiac.${z}`)} selected={zodiac === z} onPress={() => toggleSingleSelect(zodiac, z, setZodiac)} />
              ))}
            </View>
          </View>

          {/* Zodiac Ascendant */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.zodiacAscendant')}</Text>
            <View style={styles.tags}>
              {ZODIAC_SIGNS.map((z) => (
                <Tag key={z} label={t(`zodiac.${z}`)} selected={zodiacAscendant === z} onPress={() => toggleSingleSelect(zodiacAscendant, z, setZodiacAscendant)} />
              ))}
            </View>
          </View>

          {/* Height */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.height')}</Text>
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

          {/* Children */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.children')}</Text>
            <View style={styles.tags}>
              {CHILDREN_OPTIONS.map((c) => (
                <Tag key={c} label={t(`children.${c}`)} selected={children === c} onPress={() => toggleSingleSelect(children, c, setChildren)} />
              ))}
            </View>
          </View>

          {/* Pets */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.pets')}</Text>
            <View style={styles.tags}>
              {PET_OPTIONS.map((p) => (
                <Tag key={p} label={t(`pets.${p}`)} selected={pets.includes(p)} onPress={() => togglePet(p)} />
              ))}
            </View>
          </View>

          {/* Smoking */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.smoking')}</Text>
            <View style={styles.tags}>
              {SMOKING_OPTIONS.map((s) => (
                <Tag key={s} label={t(`smoking.${s}`)} selected={smokingVal === s} onPress={() => toggleSingleSelect(smokingVal, s, setSmokingVal)} />
              ))}
            </View>
          </View>

          {/* Drinking */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('profile.drinking')}</Text>
            <View style={styles.tags}>
              {DRINKING_OPTIONS.map((d) => (
                <Tag key={d} label={t(`drinking.${d}`)} selected={drinkingVal === d} onPress={() => toggleSingleSelect(drinkingVal, d, setDrinkingVal)} />
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

          <Button
            title={t('profile.save')}
            onPress={handleSave}
            loading={loading}
            disabled={!isValid}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Premium trial welcome modal */}
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
              onPress={handleTrialDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonText}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Verification prompt modal */}
      <Modal visible={showVerifyPrompt} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.verifyIconCircle}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.modalTitle}>{t('verification.promptTitle')}</Text>
            <Text style={styles.modalDescription}>{t('verification.promptMessage')}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleVerifyNow}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.modalButtonText}>{t('verification.verifyNow')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleVerifyLater}
              activeOpacity={0.7}
            >
              <Text style={styles.verifyLaterText}>{t('verification.verifyLater')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 32,
      paddingBottom: 40,
      gap: 20,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
      paddingTop: 24,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      lineHeight: 22,
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
      fontFamily: Fonts.bodyMedium,
      color: c.error,
      marginTop: 4,
      marginLeft: 4,
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
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    premiumTeaser: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.goldBg,
      borderWidth: 1,
      borderColor: c.goldBorder,
      borderRadius: 16,
      padding: 14,
    },
    premiumTeaserText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.goldText,
      flex: 1,
      lineHeight: 20,
    },
    saveButton: {
      marginTop: 12,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
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
    verifyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primaryPastel,
      justifyContent: 'center',
      alignItems: 'center',
    },
    verifyLaterText: {
      fontSize: 15,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      marginTop: 4,
    },
  });
}

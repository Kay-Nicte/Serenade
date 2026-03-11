import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import {
  Config,
  ORIENTATIONS,
  LOOKING_FOR_OPTIONS,
  SMOKING_OPTIONS,
  DRINKING_OPTIONS,
  CHILDREN_OPTIONS,
  PET_OPTIONS,
  ZODIAC_SIGNS,
  HOGWARTS_HOUSES,
  RELATIONSHIP_TYPE,
  GENDER_IDENTITY,
  LANGUAGES,
  EXERCISE_OPTIONS,
  EDUCATION_OPTIONS,
  RELIGION_OPTIONS,
  MUSIC_GENRES,
} from '@/constants/config';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useDiscoveryPreferences } from '@/hooks/useDiscoveryPreferences';
import { useProfileStore } from '@/stores/profileStore';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function DiscoveryPreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { preferences, isLoading, updatePreferences } = useDiscoveryPreferences();
  const { fetchCandidates } = useProfileStore();

  const [minAge, setMinAge] = useState(String(Config.discoveryDefaults.minAge));
  const [maxAge, setMaxAge] = useState(String(Config.discoveryDefaults.maxAge));
  const [orientations, setOrientations] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(String(Config.discoveryDefaults.maxDistance));
  const [distanceEnabled, setDistanceEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  // Advanced filters
  const [smoking, setSmoking] = useState<string[]>([]);
  const [drinking, setDrinking] = useState<string[]>([]);
  const [children, setChildren] = useState<string[]>([]);
  const [pets, setPets] = useState<string[]>([]);
  const [zodiac, setZodiac] = useState<string[]>([]);
  const [hogwarts, setHogwarts] = useState<string[]>([]);
  const [minHeight, setMinHeight] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [relationshipType, setRelationshipType] = useState<string[]>([]);
  const [genderIdentity, setGenderIdentity] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [exercise, setExercise] = useState<string[]>([]);
  const [education, setEducation] = useState<string[]>([]);
  const [religion, setReligion] = useState<string[]>([]);
  const [musicGenres, setMusicGenres] = useState<string[]>([]);

  // Include unspecified switches
  const [smokingInclude, setSmokingInclude] = useState(true);
  const [drinkingInclude, setDrinkingInclude] = useState(true);
  const [childrenInclude, setChildrenInclude] = useState(true);
  const [petsInclude, setPetsInclude] = useState(true);
  const [zodiacInclude, setZodiacInclude] = useState(true);
  const [hogwartsInclude, setHogwartsInclude] = useState(true);
  const [heightInclude, setHeightInclude] = useState(true);
  const [relationshipTypeInclude, setRelationshipTypeInclude] = useState(true);
  const [genderIdentityInclude, setGenderIdentityInclude] = useState(true);
  const [languagesInclude, setLanguagesInclude] = useState(true);
  const [exerciseInclude, setExerciseInclude] = useState(true);
  const [educationInclude, setEducationInclude] = useState(true);
  const [religionInclude, setReligionInclude] = useState(true);
  const [musicGenresInclude, setMusicGenresInclude] = useState(true);

  useEffect(() => {
    if (preferences) {
      setMinAge(String(preferences.min_age));
      setMaxAge(String(preferences.max_age));
      setOrientations(preferences.orientations ?? []);
      setLookingFor(preferences.looking_for ?? []);
      if (preferences.max_distance !== null) {
        setDistanceEnabled(true);
        setMaxDistance(String(preferences.max_distance));
      } else {
        setDistanceEnabled(false);
        setMaxDistance(String(Config.discoveryDefaults.maxDistance));
      }
      setSmoking(preferences.smoking ?? []);
      setDrinking(preferences.drinking ?? []);
      setChildren(preferences.children ?? []);
      setPets(preferences.pets ?? []);
      setZodiac(preferences.zodiac ?? []);
      setHogwarts(preferences.hogwarts_house ?? []);
      setMinHeight(preferences.min_height ? String(preferences.min_height) : '');
      setMaxHeight(preferences.max_height ? String(preferences.max_height) : '');
      setSmokingInclude(preferences.smoking_include_unspecified ?? true);
      setDrinkingInclude(preferences.drinking_include_unspecified ?? true);
      setChildrenInclude(preferences.children_include_unspecified ?? true);
      setPetsInclude(preferences.pets_include_unspecified ?? true);
      setZodiacInclude(preferences.zodiac_include_unspecified ?? true);
      setHogwartsInclude(preferences.hogwarts_include_unspecified ?? true);
      setHeightInclude(preferences.height_include_unspecified ?? true);
      setRelationshipType(preferences.relationship_type ?? []);
      setGenderIdentity(preferences.gender_identity ?? []);
      setLanguages(preferences.languages ?? []);
      setExercise(preferences.exercise ?? []);
      setEducation(preferences.education ?? []);
      setReligion(preferences.religion ?? []);
      setMusicGenres(preferences.music_genres ?? []);
      setRelationshipTypeInclude(preferences.relationship_type_include_unspecified ?? true);
      setGenderIdentityInclude(preferences.gender_identity_include_unspecified ?? true);
      setLanguagesInclude(preferences.languages_include_unspecified ?? true);
      setExerciseInclude(preferences.exercise_include_unspecified ?? true);
      setEducationInclude(preferences.education_include_unspecified ?? true);
      setReligionInclude(preferences.religion_include_unspecified ?? true);
      setMusicGenresInclude(preferences.music_genres_include_unspecified ?? true);
    }
  }, [preferences]);

  const toggleOrientation = (o: string) => {
    setOrientations((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
    );
  };

  const toggleLookingFor = (lf: string) => {
    setLookingFor((prev) =>
      prev.includes(lf) ? prev.filter((x) => x !== lf) : [...prev, lf]
    );
  };

  const toggleArray = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    const min = parseInt(minAge, 10) || Config.discoveryDefaults.minAge;
    const max = parseInt(maxAge, 10) || Config.discoveryDefaults.maxAge;

    if (min < Config.minAge || max > Config.maxAge || min > max) {
      showToast(t('common.error'), 'error');
      return;
    }

    const parsedMinHeight = minHeight ? parseInt(minHeight, 10) : null;
    const parsedMaxHeight = maxHeight ? parseInt(maxHeight, 10) : null;

    if (parsedMinHeight && parsedMaxHeight && parsedMinHeight > parsedMaxHeight) {
      showToast(t('common.error'), 'error');
      return;
    }

    setSaving(true);
    try {
      await updatePreferences({
        min_age: min,
        max_age: max,
        orientations: orientations.length > 0 ? orientations : null,
        looking_for: lookingFor.length > 0 ? lookingFor : null,
        max_distance: distanceEnabled ? (parseInt(maxDistance, 10) || Config.discoveryDefaults.maxDistance) : null,
        smoking: smoking.length > 0 ? smoking : null,
        drinking: drinking.length > 0 ? drinking : null,
        children: children.length > 0 ? children : null,
        pets: pets.length > 0 ? pets : null,
        zodiac: zodiac.length > 0 ? zodiac : null,
        hogwarts_house: hogwarts.length > 0 ? hogwarts : null,
        min_height: parsedMinHeight,
        max_height: parsedMaxHeight,
        smoking_include_unspecified: smokingInclude,
        drinking_include_unspecified: drinkingInclude,
        children_include_unspecified: childrenInclude,
        pets_include_unspecified: petsInclude,
        zodiac_include_unspecified: zodiacInclude,
        hogwarts_include_unspecified: hogwartsInclude,
        height_include_unspecified: heightInclude,
        relationship_type: relationshipType.length > 0 ? relationshipType : null,
        gender_identity: genderIdentity.length > 0 ? genderIdentity : null,
        languages: languages.length > 0 ? languages : null,
        exercise: exercise.length > 0 ? exercise : null,
        education: education.length > 0 ? education : null,
        religion: religion.length > 0 ? religion : null,
        music_genres: musicGenres.length > 0 ? musicGenres : null,
        relationship_type_include_unspecified: relationshipTypeInclude,
        gender_identity_include_unspecified: genderIdentityInclude,
        languages_include_unspecified: languagesInclude,
        exercise_include_unspecified: exerciseInclude,
        education_include_unspecified: educationInclude,
        religion_include_unspecified: religionInclude,
        music_genres_include_unspecified: musicGenresInclude,
      });
      router.back();
      fetchCandidates(); // non-blocking refresh
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      console.error('Discovery save error:', msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderFilterSection = (
    label: string,
    options: readonly string[],
    selected: string[],
    translationPrefix: string,
    onToggle: (value: string) => void,
    includeUnspecified: boolean,
    onToggleInclude: (value: boolean) => void
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.tags}>
        {options.map((option) => (
          <Tag
            key={option}
            label={t(`${translationPrefix}.${option}`)}
            selected={selected.includes(option)}
            onPress={() => onToggle(option)}
          />
        ))}
      </View>
      {selected.length === 0 && (
        <Text style={styles.hint}>{t('discovery.allValues')}</Text>
      )}
      {selected.length > 0 && (
        <View style={styles.includeRow}>
          <Text style={styles.includeLabel}>{t('discovery.includeUnspecified')}</Text>
          <Switch
            value={includeUnspecified}
            onValueChange={onToggleInclude}
            trackColor={{ false: Colors.border, true: Colors.primaryLight }}
            thumbColor={includeUnspecified ? Colors.primary : Colors.surface}
          />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('discovery.title')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.subtitle}>{t('discovery.subtitle')}</Text>

          {/* Age Range */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('discovery.ageRange')}</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>{t('discovery.minAge')}</Text>
                <View style={styles.rangeInputWrap}>
                  <TextInput
                    style={styles.rangeInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={minAge}
                    onChangeText={setMinAge}
                    placeholder={String(Config.discoveryDefaults.minAge)}
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
              <Text style={styles.rangeSeparator}>—</Text>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>{t('discovery.maxAge')}</Text>
                <View style={styles.rangeInputWrap}>
                  <TextInput
                    style={styles.rangeInput}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={maxAge}
                    onChangeText={setMaxAge}
                    placeholder={String(Config.discoveryDefaults.maxAge)}
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('discovery.distance')}</Text>
            <View style={styles.rangeRow}>
              <View style={[styles.rangeField, { flex: 2 }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { if (!distanceEnabled) setDistanceEnabled(true); }}
                  style={[styles.rangeInputWrap, !distanceEnabled && styles.inputDisabled]}
                >
                  <TextInput
                    style={styles.rangeInput}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={distanceEnabled ? maxDistance : ''}
                    onChangeText={(v) => {
                      setDistanceEnabled(true);
                      setMaxDistance(v);
                    }}
                    placeholder={String(Config.discoveryDefaults.maxDistance)}
                    placeholderTextColor={Colors.textTertiary}
                    editable={distanceEnabled}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.rangeSeparator}>km</Text>
            </View>
            <TouchableOpacity onPress={() => setDistanceEnabled(!distanceEnabled)}>
              <Text style={styles.hintLink}>
                {distanceEnabled ? t('discovery.distanceClear') : t('discovery.distanceAll')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orientations */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('discovery.orientations')}</Text>
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
            {orientations.length === 0 && (
              <Text style={styles.hint}>{t('discovery.orientationsAll')}</Text>
            )}
          </View>

          {/* Looking For */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('discovery.lookingFor')}</Text>
            <View style={styles.tags}>
              {LOOKING_FOR_OPTIONS.map((lf) => (
                <Tag
                  key={lf}
                  label={t(`lookingFor.${lf}`)}
                  selected={lookingFor.includes(lf)}
                  onPress={() => toggleLookingFor(lf)}
                />
              ))}
            </View>
            {lookingFor.length === 0 && (
              <Text style={styles.hint}>{t('discovery.lookingForAll')}</Text>
            )}
          </View>

          {/* Gender Identity */}
          {renderFilterSection(
            t('profile.genderIdentity.title'),
            GENDER_IDENTITY,
            genderIdentity,
            'profile.genderIdentity',
            (v) => toggleArray(setGenderIdentity, v),
            genderIdentityInclude,
            setGenderIdentityInclude
          )}

          {/* Relationship Type */}
          {renderFilterSection(
            t('profile.relationshipType.title'),
            RELATIONSHIP_TYPE,
            relationshipType,
            'profile.relationshipType',
            (v) => toggleArray(setRelationshipType, v),
            relationshipTypeInclude,
            setRelationshipTypeInclude
          )}

          {/* Languages */}
          {renderFilterSection(
            t('profile.languages.title'),
            LANGUAGES,
            languages,
            'profile.languages',
            (v) => toggleArray(setLanguages, v),
            languagesInclude,
            setLanguagesInclude
          )}

          {/* Education */}
          {renderFilterSection(
            t('profile.education.title'),
            EDUCATION_OPTIONS,
            education,
            'profile.education',
            (v) => toggleArray(setEducation, v),
            educationInclude,
            setEducationInclude
          )}

          {/* Exercise */}
          {renderFilterSection(
            t('profile.exercise.title'),
            EXERCISE_OPTIONS,
            exercise,
            'profile.exercise',
            (v) => toggleArray(setExercise, v),
            exerciseInclude,
            setExerciseInclude
          )}

          {/* Music Genres */}
          {renderFilterSection(
            t('profile.musicGenres.title'),
            MUSIC_GENRES,
            musicGenres,
            'profile.musicGenres',
            (v) => toggleArray(setMusicGenres, v),
            musicGenresInclude,
            setMusicGenresInclude
          )}

          {/* Religion */}
          {renderFilterSection(
            t('profile.religion.title'),
            RELIGION_OPTIONS,
            religion,
            'profile.religion',
            (v) => toggleArray(setReligion, v),
            religionInclude,
            setReligionInclude
          )}

          {/* Smoking */}
          {renderFilterSection(
            t('discovery.smoking'),
            SMOKING_OPTIONS,
            smoking,
            'smoking',
            (v) => toggleArray(setSmoking, v),
            smokingInclude,
            setSmokingInclude
          )}

          {/* Drinking */}
          {renderFilterSection(
            t('discovery.drinking'),
            DRINKING_OPTIONS,
            drinking,
            'drinking',
            (v) => toggleArray(setDrinking, v),
            drinkingInclude,
            setDrinkingInclude
          )}

          {/* Children */}
          {renderFilterSection(
            t('discovery.children'),
            CHILDREN_OPTIONS,
            children,
            'children',
            (v) => toggleArray(setChildren, v),
            childrenInclude,
            setChildrenInclude
          )}

          {/* Pets */}
          {renderFilterSection(
            t('discovery.pets'),
            PET_OPTIONS,
            pets,
            'pets',
            (v) => toggleArray(setPets, v),
            petsInclude,
            setPetsInclude
          )}

          {/* Zodiac */}
          {renderFilterSection(
            t('discovery.zodiacFilter'),
            ZODIAC_SIGNS,
            zodiac,
            'zodiac',
            (v) => toggleArray(setZodiac, v),
            zodiacInclude,
            setZodiacInclude
          )}

          {/* Hogwarts House */}
          {renderFilterSection(
            t('discovery.hogwartsFilter'),
            HOGWARTS_HOUSES,
            hogwarts,
            'hogwarts',
            (v) => toggleArray(setHogwarts, v),
            hogwartsInclude,
            setHogwartsInclude
          )}

          {/* Height */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('discovery.height')}</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>{t('discovery.heightMin')}</Text>
                <View style={styles.rangeInputWrap}>
                  <TextInput
                    style={styles.rangeInput}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={minHeight}
                    onChangeText={setMinHeight}
                    placeholder="140"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
              <Text style={styles.rangeSeparator}>—</Text>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>{t('discovery.heightMax')}</Text>
                <View style={styles.rangeInputWrap}>
                  <TextInput
                    style={styles.rangeInput}
                    keyboardType="number-pad"
                    maxLength={3}
                    value={maxHeight}
                    onChangeText={setMaxHeight}
                    placeholder="200"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              </View>
              <Text style={styles.rangeSeparator}>{t('discovery.heightCm')}</Text>
            </View>
            {(minHeight !== '' || maxHeight !== '') && (
              <View style={styles.includeRow}>
                <Text style={styles.includeLabel}>{t('discovery.includeUnspecified')}</Text>
                <Switch
                  value={heightInclude}
                  onValueChange={setHeightInclude}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={heightInclude ? Colors.primary : Colors.surface}
                />
              </View>
            )}
          </View>

          <Button
            title={t('common.save')}
            onPress={handleSave}
            loading={saving || isLoading}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 20,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textSecondary,
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
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
    },
    rangeField: {
      flex: 1,
      gap: 4,
    },
    rangeLabel: {
      fontSize: 12,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      marginLeft: 4,
    },
    rangeInputWrap: {
      height: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      justifyContent: 'center',
    },
    rangeInput: {
      textAlign: 'center',
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
    },
    rangeSeparator: {
      fontSize: 18,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      marginBottom: 14,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    hint: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      marginLeft: 4,
    },
    hintLink: {
      fontSize: 12,
      fontFamily: Fonts.bodyMedium,
      color: c.primaryDark,
      marginLeft: 4,
    },
    inputDisabled: {
      opacity: 0.4,
    },
    includeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    includeLabel: {
      fontSize: 13,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      flex: 1,
      marginRight: 12,
    },
    saveButton: {
      marginTop: 4,
    },
  });
}

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Config, ORIENTATIONS, LOOKING_FOR_OPTIONS, type Orientation, type LookingFor } from '@/constants/config';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/components/ui/Tag';
import { PhotoGrid } from '@/components/PhotoGrid';
import { useAuthStore } from '@/stores/authStore';
import { usePhotos } from '@/hooks/usePhotos';
import { pickImage } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';

const LOOKING_FOR = LOOKING_FOR_OPTIONS;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { user, profile, updateProfile, signOut, fetchProfile } = useAuthStore();
  const { photos, addPhoto, removePhoto } = usePhotos(user?.id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [orientation, setOrientation] = useState<string | null>(null);
  const [lookingFor, setLookingFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setBio(profile.bio ?? '');
      setOrientation(profile.orientation);
      setLookingFor(profile.looking_for);
      if (profile.birth_date) {
        const [y, m, d] = profile.birth_date.split('-');
        setYear(y);
        setMonth(m);
        setDay(d);
      }
    }
  }, [profile, editing]);

  const handleAddPhoto = async (position: number) => {
    const uri = await pickImage();
    if (uri && user) {
      await addPhoto(user.id, uri, position);
      await fetchProfile();
    }
  };

  const handleRemovePhoto = async (photo: Parameters<typeof removePhoto>[0]) => {
    await removePhoto(photo);
    await fetchProfile();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
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
        orientation: orientation as Orientation,
        looking_for: lookingFor as LookingFor,
      });
      setEditing(false);
    } catch {
      Alert.alert(t('common.error'), t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  // --- VIEW MODE ---
  if (!editing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{t('tabs.profile')}</Text>
            <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.primary} />
              </View>
            )}

            <Text style={styles.name}>{profile?.name ?? '—'}</Text>

            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}

            <View style={styles.info}>
              {profile?.birth_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.birthDate')}</Text>
                  <Text style={styles.infoValue}>{profile.birth_date}</Text>
                </View>
              )}
              {profile?.orientation && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.orientation')}</Text>
                  <Text style={styles.infoValue}>
                    {t(`orientation.${profile.orientation}`)}
                  </Text>
                </View>
              )}
              {profile?.looking_for && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('profile.lookingFor')}</Text>
                  <Text style={styles.infoValue}>
                    {t(`lookingFor.${profile.looking_for}`)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottom}>
            <Button
              title={t('profile.signOut')}
              onPress={handleSignOut}
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
          contentContainerStyle={styles.scrollContent}
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
                  placeholder="DD"
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
                  placeholder="MM"
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
                  placeholder="AAAA"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                />
              </View>
            </View>
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
                  selected={orientation === o}
                  onPress={() => setOrientation(o)}
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
                  selected={lookingFor === lf}
                  onPress={() => setLookingFor(lf)}
                />
              ))}
            </View>
          </View>

          <Button
            title={t('common.save')}
            onPress={handleSave}
            loading={saving}
            disabled={!name.trim()}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text,
  },
  card: {
    padding: 24,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
    shadowColor: Colors.text,
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
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    color: Colors.text,
  },
  bio: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  info: {
    width: '100%',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.text,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  dateFieldYear: {
    flex: 1.5,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  dateInput: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.text,
  },
  dateSeparator: {
    fontSize: 18,
    fontFamily: Fonts.body,
    color: Colors.textTertiary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  saveButton: {
    marginTop: 4,
  },
  bottom: {
    paddingTop: 12,
  },
});

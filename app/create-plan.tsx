import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { usePlansStore } from '@/stores/plansStore';
import { showToast } from '@/stores/toastStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LocationInput } from '@/components/LocationInput';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

type Category = 'viajes' | 'ocio' | 'cultura';

export default function CreatePlanScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const createPlan = usePlansStore((s) => s.createPlan);

  const CATEGORIES: { key: Category; labelKey: string }[] = [
    { key: 'viajes', labelKey: 'plans.categoryTravel' },
    { key: 'ocio', labelKey: 'plans.categoryLeisure' },
    { key: 'cultura', labelKey: 'plans.categoryCulture' },
  ];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [category, setCategory] = useState<Category>('ocio');
  const [eventDate, setEventDate] = useState(new Date());
  const [dateSelected, setDateSelected] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState('');
  const [loading, setLoading] = useState(false);

  const getCategoryColor = (cat: Category) => {
    if (cat === 'viajes') return '#C8956C';
    if (cat === 'cultura') return Colors.primary;
    return Colors.primaryDark;
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setEventDate(selectedDate);
      setDateSelected(true);
      // Show time picker after date is selected
      setTimeout(() => setShowTimePicker(true), 300);
    }
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const combined = new Date(eventDate);
      combined.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setEventDate(combined);
    }
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast(t('plans.titleLabel') + ' *', 'error');
      return;
    }
    if (!locationName.trim()) {
      showToast(t('plans.locationLabel') + ' *', 'error');
      return;
    }
    if (!dateSelected) {
      showToast(t('plans.dateLabel') + ' *', 'error');
      return;
    }

    if (!locationLat || !locationLng) {
      showToast(t('plans.locationLabel') + ' — selecciona de la lista', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await createPlan({
        title: title.trim(),
        description: description.trim() || null,
        category,
        location_name: locationName.trim(),
        latitude: locationLat,
        longitude: locationLng,
        event_date: eventDate.toISOString(),
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      });

      if (result.success) {
        showToast(t('plans.planCreated'), 'success');
        router.back();
      } else {
        showToast(t('plans.errorCreating'), 'error');
      }
    } catch {
      showToast(t('plans.errorCreating'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ResponsiveContainer>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('plans.create')}</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Input
              label={t('plans.titleLabel') + ' *'}
              placeholder={t('plans.titlePlaceholder')}
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label={t('plans.descriptionLabel')}
              placeholder={t('plans.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <LocationInput
              label={t('plans.locationLabel') + ' *'}
              placeholder={t('plans.locationPlaceholder')}
              value={locationName}
              onSelect={(loc) => {
                setLocationName(loc.name);
                setLocationLat(loc.latitude);
                setLocationLng(loc.longitude);
              }}
            />

            {/* Category selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('plans.categoryLabel')}</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryButton,
                      category === cat.key && {
                        backgroundColor: getCategoryColor(cat.key),
                        borderColor: getCategoryColor(cat.key),
                      },
                    ]}
                    onPress={() => setCategory(cat.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat.key && styles.categoryButtonTextSelected,
                      ]}
                    >
                      {t(cat.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('plans.dateLabel')} *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <Text style={[styles.dateText, !dateSelected && { color: Colors.textTertiary }]}>
                  {dateSelected
                    ? `${formatDate(eventDate)} — ${formatTime(eventDate)}`
                    : t('plans.dateLabel')}
                </Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={eventDate}
                mode="time"
                onChange={handleTimeChange}
              />
            )}

            <Input
              label={t('plans.maxAttendeesLabel')}
              placeholder={t('plans.maxAttendeesPlaceholder')}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              keyboardType="number-pad"
            />

            <Button
              title={t('plans.create')}
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: 8 }}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    form: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 40,
      gap: 18,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      marginLeft: 4,
    },
    categoryRow: {
      flexDirection: 'row',
      gap: 10,
    },
    categoryButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
    },
    categoryButtonText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    categoryButtonTextSelected: {
      color: '#FFFFFF',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      backgroundColor: c.surface,
    },
    dateText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
      flex: 1,
    },
  });
}

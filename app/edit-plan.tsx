import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { usePlansStore } from '@/stores/plansStore';
import { showToast } from '@/stores/toastStore';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LocationInput } from '@/components/LocationInput';
import {
  ActivityIndicator,
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

export default function EditPlanScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fetchPlans = usePlansStore((s) => s.fetchPlans);
  const plan = usePlansStore((s) => s.plans.find((p) => p.id === id));

  const CATEGORIES: { key: Category; labelKey: string }[] = [
    { key: 'viajes', labelKey: 'plans.categoryTravel' },
    { key: 'ocio', labelKey: 'plans.categoryLeisure' },
    { key: 'cultura', labelKey: 'plans.categoryCulture' },
  ];

  const [title, setTitle] = useState(plan?.title ?? '');
  const [description, setDescription] = useState(plan?.description ?? '');
  const [locationName, setLocationName] = useState(plan?.location_name ?? '');
  const [locationLat, setLocationLat] = useState<number | undefined>();
  const [locationLng, setLocationLng] = useState<number | undefined>();
  const [category, setCategory] = useState<Category>((plan?.category as Category) ?? 'ocio');
  const [eventDate, setEventDate] = useState(plan ? new Date(plan.event_date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState(plan?.max_attendees?.toString() ?? '');
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

  const formatDate = (d: Date) =>
    d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const handleSubmit = async () => {
    if (!title.trim() || !locationName.trim()) {
      showToast(t('plans.errorCreating'), 'error');
      return;
    }

    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        location_name: locationName.trim(),
        event_date: eventDate.toISOString(),
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      };
      if (locationLat != null && locationLng != null) {
        updateData.location = `POINT(${locationLng} ${locationLat})`;
      }

      const { error } = await supabase.from('plans').update(updateData).eq('id', id);
      if (error) throw error;

      await fetchPlans();
      showToast(t('plans.planCreated'), 'success');
      router.back();
    } catch (e) {
      console.error('[Plans] Edit error:', e);
      showToast(t('plans.errorCreating'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ResponsiveContainer>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('plans.edit')}</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Input label={t('plans.titleLabel') + ' *'} placeholder={t('plans.titlePlaceholder')} value={title} onChangeText={setTitle} />
            <Input label={t('plans.descriptionLabel')} placeholder={t('plans.descriptionPlaceholder')} value={description} onChangeText={setDescription} multiline />

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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('plans.categoryLabel')}</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity key={cat.key} style={[styles.categoryButton, category === cat.key && { backgroundColor: getCategoryColor(cat.key), borderColor: getCategoryColor(cat.key) }]} onPress={() => setCategory(cat.key)} activeOpacity={0.7}>
                    <Text style={[styles.categoryButtonText, category === cat.key && styles.categoryButtonTextSelected]}>{t(cat.labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('plans.dateLabel')} *</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                <Text style={styles.dateText}>{formatDate(eventDate)} — {formatTime(eventDate)}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && <DateTimePicker value={eventDate} mode="date" minimumDate={new Date()} onChange={handleDateChange} />}
            {showTimePicker && <DateTimePicker value={eventDate} mode="time" onChange={handleTimeChange} />}

            <Input label={t('plans.maxAttendeesLabel')} placeholder={t('plans.maxAttendeesPlaceholder')} value={maxAttendees} onChangeText={setMaxAttendees} keyboardType="number-pad" />

            <Button title={t('plans.edit')} onPress={handleSubmit} loading={loading} style={{ marginTop: 8 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </ResponsiveContainer>
    </SafeAreaView>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 20, fontFamily: Fonts.heading, color: c.text },
    form: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, gap: 18 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontFamily: Fonts.bodyMedium, color: c.textSecondary, marginLeft: 4 },
    categoryRow: { flexDirection: 'row', gap: 10 },
    categoryButton: { flex: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    categoryButtonText: { fontSize: 14, fontFamily: Fonts.bodySemiBold, color: c.text },
    categoryButtonTextSelected: { color: '#FFFFFF' },
    dateButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 16, backgroundColor: c.surface },
    dateText: { fontSize: 16, fontFamily: Fonts.body, color: c.text, flex: 1 },
  });
}

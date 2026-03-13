import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import * as Location from 'expo-location';

interface LocationResult {
  name: string;
  latitude: number;
  longitude: number;
}

interface LocationInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onSelect: (location: { name: string; latitude: number; longitude: number }) => void;
}

export function LocationInput({ label, placeholder, value, onSelect }: LocationInputProps) {
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchLocation = async (text: string) => {
    if (text.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const geocoded = await Location.geocodeAsync(text);
      const locationResults: LocationResult[] = [];

      for (const geo of geocoded.slice(0, 5)) {
        try {
          const reverse = await Location.reverseGeocodeAsync({
            latitude: geo.latitude,
            longitude: geo.longitude,
          });
          if (reverse.length > 0) {
            const r = reverse[0];
            const parts = [r.city, r.region, r.country].filter(Boolean);
            const name = parts.join(', ');
            // Avoid duplicates
            if (!locationResults.some((lr) => lr.name === name)) {
              locationResults.push({
                name,
                latitude: geo.latitude,
                longitude: geo.longitude,
              });
            }
          }
        } catch {
          // Skip this result
        }
      }

      setResults(locationResults);
      setShowResults(locationResults.length > 0);
    } catch {
      setResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => searchLocation(text), 600);
  };

  const handleSelectResult = (result: LocationResult) => {
    setQuery(result.name);
    setShowResults(false);
    setResults([]);
    onSelect(result);
  };

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const reverse = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (reverse.length > 0) {
        const r = reverse[0];
        const name = [r.city, r.region, r.country].filter(Boolean).join(', ');
        setQuery(name);
        setShowResults(false);
        onSelect({ name, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch {
      // silent
    } finally {
      setDetectingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={handleChangeText}
            onFocus={() => { if (results.length > 0) setShowResults(true); }}
          />
          {searching && (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.spinner} />
          )}
        </View>
        <TouchableOpacity
          style={[styles.locationButton, { backgroundColor: Colors.primaryPastel }]}
          onPress={handleDetectLocation}
          activeOpacity={0.7}
          disabled={detectingLocation}
        >
          {detectingLocation ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="locate" size={22} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {showResults && (
        <View style={styles.dropdown}>
          {results.map((item, index) => (
            <TouchableOpacity
              key={`${item.name}-${index}`}
              style={styles.resultItem}
              onPress={() => handleSelectResult(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.resultText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      gap: 6,
      zIndex: 10,
    },
    label: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      marginLeft: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: 16,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.text,
      height: 52,
    },
    spinner: {
      marginLeft: 8,
    },
    locationButton: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdown: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 4,
      overflow: 'hidden',
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: c.borderLight,
    },
    resultText: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.text,
      flex: 1,
    },
  });
}

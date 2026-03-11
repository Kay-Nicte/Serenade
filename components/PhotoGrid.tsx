import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Config } from '@/constants/config';
import { getPhotoUrl } from '@/lib/storage';
import type { Photo } from '@/stores/photoStore';

interface PhotoGridProps {
  photos: Photo[];
  onAdd: (position: number) => void;
  onRemove: (photo: Photo) => void;
  editable?: boolean;
}

const GRID_COLUMNS = 3;
const GRID_GAP = 8;

export function PhotoGrid({ photos, onAdd, onRemove, editable = true }: PhotoGridProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = 32 * 2;
  const itemWidth = (screenWidth - containerPadding - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const itemHeight = itemWidth * (4 / 3);

  const photoByPosition = new Map(photos.map((p) => [p.position, p]));

  const handleRemove = (photo: Photo) => {
    Alert.alert(
      t('profile.removePhoto'),
      t('profile.removePhotoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.done'), style: 'destructive', onPress: () => onRemove(photo) },
      ]
    );
  };

  const slots = Array.from({ length: Config.maxPhotos }, (_, i) => i);

  return (
    <View style={styles.grid}>
      {slots.map((position) => {
        const photo = photoByPosition.get(position);

        if (photo) {
          return (
            <View key={position} style={[styles.slot, { width: itemWidth, height: itemHeight }]}>
              <Image
                source={{ uri: getPhotoUrl(photo.storage_path) }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
              {position === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>{t('profile.primaryPhoto')}</Text>
                </View>
              )}
              {editable && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemove(photo)}
                  hitSlop={4}
                >
                  <Ionicons name="close-circle" size={22} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={position}
            style={[styles.slot, styles.emptySlot, { width: itemWidth, height: itemHeight }]}
            onPress={() => editable && onAdd(position)}
            disabled={!editable}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={28} color={Colors.primary} />
            {position === 0 && (
              <Text style={styles.addLabel}>{t('profile.primaryPhoto')}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  slot: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  emptySlot: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.surface,
    borderRadius: 11,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(230, 168, 180, 0.85)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  primaryBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textOnPrimary,
  },
  addLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
    color: Colors.primary,
  },
});

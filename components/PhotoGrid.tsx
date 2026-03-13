import { useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { showConfirm } from '@/components/ConfirmDialog';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { Config } from '@/constants/config';
import { getPhotoUrl } from '@/lib/storage';
import { useResponsive } from '@/hooks/useResponsive';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';
import type { Photo } from '@/stores/photoStore';

interface PhotoGridProps {
  photos: Photo[];
  onAdd: (position: number) => void;
  onRemove: (photo: Photo) => void;
  onReorder?: (orderedPhotos: Photo[]) => void;
  editable?: boolean;
}

const GRID_COLUMNS = 3;
const GRID_GAP = 8;

export function PhotoGrid({ photos, onAdd, onRemove, onReorder, editable = true }: PhotoGridProps) {
  const { t } = useTranslation();
  const { width: screenWidth, isTablet, contentMaxWidth } = useResponsive();
  const effectiveWidth = isTablet ? Math.min(screenWidth, contentMaxWidth) : screenWidth;
  const containerPadding = 32 * 2;
  const totalWidth = effectiveWidth - containerPadding;
  const itemWidth = (totalWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const itemHeight = itemWidth * (4 / 3);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  // Local state for sortable grid data
  const [localPhotos, setLocalPhotos] = useState<Photo[]>(() =>
    [...photos].sort((a, b) => a.position - b.position)
  );
  const reorderingRef = useRef(false);

  useEffect(() => {
    if (reorderingRef.current) return;
    setLocalPhotos([...photos].sort((a, b) => a.position - b.position));
  }, [photos]);

  const handleRemove = (photo: Photo) => {
    showConfirm({
      title: t('profile.removePhoto'),
      message: t('profile.removePhotoConfirm'),
      destructive: true,
      onConfirm: () => onRemove(photo),
    });
  };

  const handleDragEnd = useCallback(
    ({ data }: { data: Photo[] }) => {
      reorderingRef.current = true;
      setLocalPhotos(data);
      if (onReorder) {
        onReorder(data);
        setTimeout(() => { reorderingRef.current = false; }, 3000);
      }
    },
    [onReorder]
  );

  const renderItem = useCallback<SortableGridRenderItem<Photo>>(
    ({ item }) => (
      <View style={[styles.slot, { height: itemHeight }]}>
        <Image
          source={{ uri: getPhotoUrl(item.storage_path) }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        {localPhotos[0]?.id === item.id && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>{t('profile.primaryPhoto')}</Text>
          </View>
        )}
        {editable && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemove(item)}
            hitSlop={4}
          >
            <Ionicons name="close-circle" size={22} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    ),
    [localPhotos, itemHeight, editable, Colors, t]
  );

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  // Number of empty slots
  const emptyCount = Config.maxPhotos - localPhotos.length;

  return (
    <View>
      {localPhotos.length > 0 && editable && onReorder ? (
        <Sortable.Grid
          columns={GRID_COLUMNS}
          data={localPhotos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onDragEnd={handleDragEnd}
          rowGap={GRID_GAP}
          columnGap={GRID_GAP}
          rowHeight={itemHeight}
        />
      ) : localPhotos.length > 0 ? (
        <View style={styles.staticGrid}>
          {localPhotos.map((photo, idx) => (
            <View key={photo.id} style={[styles.slot, { width: itemWidth, height: itemHeight }]}>
              <Image
                source={{ uri: getPhotoUrl(photo.storage_path) }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
              {idx === 0 && (
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
          ))}
        </View>
      ) : null}

      {/* Empty slots */}
      {editable && emptyCount > 0 && (
        <View style={styles.emptyRow}>
          {Array.from({ length: emptyCount }, (_, i) => {
            const slotIndex = localPhotos.length + i;
            return (
              <TouchableOpacity
                key={`empty-${slotIndex}`}
                style={[styles.slot, styles.emptySlot, { width: itemWidth, height: itemHeight }]}
                onPress={() => onAdd(slotIndex)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={28} color={Colors.primary} />
                {slotIndex === 0 && (
                  <Text style={styles.addLabel}>{t('profile.primaryPhoto')}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {editable && localPhotos.length >= 2 && (
        <Text style={styles.reorderHint}>{t('profile.reorderHint')}</Text>
      )}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    staticGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    emptyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      marginTop: GRID_GAP,
    },
    slot: {
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    emptySlot: {
      backgroundColor: c.surfaceSecondary,
      borderWidth: 2,
      borderColor: c.border,
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
      backgroundColor: c.surface,
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
      color: c.textOnPrimary,
    },
    addLabel: {
      fontSize: 10,
      fontFamily: Fonts.bodyMedium,
      color: c.primary,
    },
    reorderHint: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textAlign: 'center',
      marginTop: 8,
    },
  });
}

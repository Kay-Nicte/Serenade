import { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface PhotoCarouselProps {
  photos: { uri: string }[];
  fallbackUri?: string | null;
  width: number;
  aspectRatio?: number;
}

export function PhotoCarousel({
  photos,
  fallbackUri,
  width,
  aspectRatio = 3 / 4,
}: PhotoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const height = width / aspectRatio;

  const displayPhotos =
    photos.length > 0
      ? photos
      : fallbackUri
        ? [{ uri: fallbackUri }]
        : [];

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setActiveIndex(index);
  };

  if (displayPhotos.length === 0) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Ionicons name="person" size={80} color={Colors.primaryLight} />
      </View>
    );
  }

  if (displayPhotos.length === 1) {
    return (
      <Image
        source={{ uri: displayPhotos[0].uri }}
        style={{ width, height }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View style={{ width, height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        decelerationRate="fast"
      >
        {displayPhotos.map((photo, index) => (
          <Image
            key={index}
            source={{ uri: photo.uri }}
            style={{ width, height }}
            contentFit="cover"
            transition={200}
          />
        ))}
      </ScrollView>

      {displayPhotos.length > 1 && (
        <View style={styles.dots}>
          {displayPhotos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: Colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.textOnPrimary,
  },
  dotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});

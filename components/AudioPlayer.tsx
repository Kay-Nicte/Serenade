import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';

// Singleton: only one audio plays at a time
let activeSound: Audio.Sound | null = null;
let activeStopCallback: (() => void) | null = null;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  uri: string;
  isMine: boolean;
}

export function AudioPlayer({ uri, isMine }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Preload on mount to get duration immediately; reuse the same Sound on play
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          (status) => {
            if (!status.isLoaded || cancelled) return;
            if (status.durationMillis) setDuration(status.durationMillis / 1000);
            setPosition(status.positionMillis / 1000);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
              // stopAsync resets position to 0 without replaying
              sound.stopAsync().catch(() => {});
            }
          }
        );
        if (cancelled) {
          sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        // Read duration from initial status
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
      } catch {
        // ignore load errors
      }
    })();

    return () => {
      cancelled = true;
      if (soundRef.current) {
        if (activeSound === soundRef.current) {
          activeSound = null;
          activeStopCallback = null;
        }
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [uri]);

  const handlePress = async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // Stop any other playing audio
      if (activeSound && activeSound !== soundRef.current) {
        await activeSound.pauseAsync();
        activeStopCallback?.();
      }

      if (soundRef.current) {
        await soundRef.current.playAsync();
        activeSound = soundRef.current;
        activeStopCallback = stopPlayback;
        setIsPlaying(true);
      }
    } catch {
      // playback error — ignore
    }
  };

  const progress = duration > 0 ? position / duration : 0;

  const primaryColor = isMine ? 'rgba(255,255,255,0.9)' : Colors.primary;
  const secondaryColor = isMine ? 'rgba(255,255,255,0.3)' : Colors.primaryLight;
  const textColor = isMine ? 'rgba(255,255,255,0.7)' : Colors.textSecondary;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.playButton}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={22}
          color={primaryColor}
        />
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        <View style={[styles.progressTrack, { backgroundColor: secondaryColor }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: primaryColor },
            ]}
          />
        </View>
        <Text style={[styles.durationText, { color: textColor }]}>
          {formatDuration(isPlaying ? position : duration)}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      minWidth: 180,
      gap: 10,
    },
    playButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    waveformContainer: {
      flex: 1,
      gap: 4,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    durationText: {
      fontSize: 11,
      fontFamily: Fonts.body,
    },
  });
}

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { updatePresence } from '@/lib/presence';
import { pickImage, takePhoto, uploadChatImage, uploadChatAudio } from '@/lib/storage';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { ActionSheet, type ActionSheetOption } from '@/components/ActionSheet';
import { GifPicker } from '@/components/GifPicker';
import { showToast } from '@/stores/toastStore';

interface ChatInputProps {
  onSend: (content: string, imageUrl?: string, audioUrl?: string) => void;
  matchId: string;
  disabled?: boolean;
  disabledMessage?: string;
  isPremium?: boolean;
}

function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function ChatInput({ onSend, matchId, disabled, disabledMessage, isPremium }: ChatInputProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const Colors = useColors();
  const styles = makeStyles(Colors);

  const {
    state: recorderState,
    setState: setRecorderState,
    duration: recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const stopTyping = useCallback(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      updatePresence(true, null);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [stopTyping]);

  const handleChangeText = (value: string) => {
    setText(value);

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        updatePresence(true, matchId);
      }

      // Reset debounce timer
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    } else {
      stopTyping();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    stopTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSend(trimmed);
    setText('');
  };

  const handleImageFromGallery = async () => {
    try {
      const uri = await pickImage();
      if (!uri) return;
      setIsUploading(true);
      const imageUrl = await uploadChatImage(matchId, uri);
      onSend('', imageUrl);
    } catch {
      // error shown via chat error state
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageFromCamera = async () => {
    try {
      const uri = await takePhoto();
      if (!uri) return;
      setIsUploading(true);
      const imageUrl = await uploadChatImage(matchId, uri);
      onSend('', imageUrl);
    } catch {
      // error shown via chat error state
    } finally {
      setIsUploading(false);
    }
  };

  const handleGifSelect = (gifUrl: string) => {
    setGifPickerVisible(false);
    onSend('', gifUrl);
  };

  const imagePickerOptions: ActionSheetOption[] = [
    {
      label: t('chat.fromGallery'),
      icon: 'image-outline',
      onPress: handleImageFromGallery,
    },
    {
      label: t('chat.fromCamera'),
      icon: 'camera-outline',
      onPress: handleImageFromCamera,
    },
  ];

  const handleMicPress = async () => {
    if (!isPremium) {
      showToast(t('chat.audioPremium'), 'success', 2500, () => router.push('/premium'));
      return;
    }
    const started = await startRecording();
    if (!started) {
      // Permission denied
    }
  };

  const handleSendAudio = async () => {
    setRecorderState('uploading');
    const uri = await stopRecording();
    if (!uri) return;

    try {
      setIsUploading(true);
      const audioUrl = await uploadChatAudio(matchId, uri);
      onSend('', undefined, audioUrl);
    } catch {
      // error shown via chat error state
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelAudio = async () => {
    await cancelRecording();
  };

  if (disabled) {
    return (
      <View style={[styles.container, styles.containerDisabled]}>
        <Ionicons name="ban" size={18} color={Colors.textTertiary} />
        <Text style={styles.disabledText}>{disabledMessage ?? t('chat.blocked')}</Text>
      </View>
    );
  }

  // Recording UI
  if (recorderState === 'recording' || recorderState === 'uploading') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelAudio}
          disabled={recorderState === 'uploading'}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={Colors.error} />
        </TouchableOpacity>

        <View style={styles.recordingInfo}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTime}>
            {formatRecordingTime(recordingDuration)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendAudio}
          disabled={recorderState === 'uploading'}
          activeOpacity={0.7}
        >
          {recorderState === 'uploading' ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <Ionicons name="send" size={20} color={Colors.textOnPrimary} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.imageButton}
        onPress={() => setImagePickerVisible(true)}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="image-outline" size={24} color={Colors.primary} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.imageButton}
        onPress={() => setGifPickerVisible(true)}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        <Ionicons name="film-outline" size={24} color={Colors.primary} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleChangeText}
        placeholder={t('chat.placeholder')}
        placeholderTextColor={Colors.textTertiary}
        multiline
        maxLength={1000}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />

      {text.trim() ? (
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          activeOpacity={0.7}
        >
          <Ionicons name="send" size={20} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.micButton, !isPremium && styles.micButtonFree]}
          onPress={handleMicPress}
          activeOpacity={0.7}
        >
          <Ionicons
            name="mic"
            size={22}
            color={isPremium ? Colors.primary : Colors.textTertiary}
          />
        </TouchableOpacity>
      )}

      <ActionSheet
        visible={imagePickerVisible}
        title={t('chat.sendPhoto')}
        options={imagePickerOptions}
        onClose={() => setImagePickerVisible(false)}
      />

      <GifPicker
        visible={gifPickerVisible}
        onSelect={handleGifSelect}
        onClose={() => setGifPickerVisible(false)}
      />
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
      paddingBottom: Platform.OS === 'ios' ? 24 : 8,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      gap: 8,
    },
    imageButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: c.surfaceSecondary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.text,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    micButtonFree: {
      opacity: 0.6,
    },
    containerDisabled: {
      justifyContent: 'center',
      gap: 6,
    },
    disabledText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    // Recording UI
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.error,
    },
    recordingTime: {
      fontSize: 16,
      fontFamily: Fonts.bodyMedium,
      color: c.text,
    },
  });
}

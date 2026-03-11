import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { GESTURES } from '@/constants/gestures';
import { useVerificationStore } from '@/stores/verificationStore';
import { useAuthStore } from '@/stores/authStore';
import { uploadVerificationSelfie } from '@/lib/storage';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

type Step = 'instruction' | 'camera' | 'preview';

export default function VerifyIdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const { currentGesture, fetchRandomGesture, submitRequest } = useVerificationStore();

  const [step, setStep] = useState<Step>('instruction');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [gestureLoading, setGestureLoading] = useState(true);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const Colors = useColors();
  const styles = makeStyles(Colors);

  useEffect(() => {
    (async () => {
      setGestureLoading(true);
      await fetchRandomGesture();
      setGestureLoading(false);
    })();
  }, []);

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo) {
      setPhotoUri(photo.uri);
      setStep('preview');
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setStep('camera');
  };

  const handleSubmit = async () => {
    if (!photoUri || !currentGesture || !user) return;
    setSubmitting(true);
    try {
      const storagePath = await uploadVerificationSelfie(user.id, photoUri);
      const result = await submitRequest(storagePath, currentGesture);
      if (result.success) {
        await fetchProfile();
        showToast(t('verification.manualReviewNotice'), 'success', 0);
        router.back();
      } else if (result.error === 'already_pending') {
        showToast(t('verification.pendingMessage'), 'info');
        router.back();
      } else {
        showToast(t('common.error'), 'error');
      }
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const gestureConfig = currentGesture ? GESTURES[currentGesture] : null;

  // Permission not granted
  if (!permission?.granted && step !== 'instruction') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.permissionText}>{t('verification.cameraPermission')}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Step 1: Instruction
  if (step === 'instruction') {
    return (
      <SafeAreaView style={styles.container}>
        <ResponsiveContainer>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.centered}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
          </View>

          <Text style={styles.title}>{t('verification.title')}</Text>
          <Text style={styles.subtitle}>{t('verification.subtitle')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: Colors.goldBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
            <Ionicons name="gift-outline" size={16} color={Colors.goldText} />
            <Text style={{ fontSize: 13, fontFamily: Fonts.bodySemiBold, color: Colors.goldText }}>
              {t('verification.promoSubtitle')}
            </Text>
          </View>

          {gestureLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 32 }} />
          ) : gestureConfig && currentGesture ? (
            <View style={styles.gestureCard}>
              <Text style={styles.gestureLabel}>{t('verification.gestureInstruction')}</Text>
              <Ionicons name={gestureConfig.icon as any} size={48} color={Colors.primary} />
              <Text style={styles.gestureName}>{t(`verification.gesture_${currentGesture}`)}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={async () => {
              if (!permission?.granted) {
                await requestPermission();
              }
              setStep('camera');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="camera" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.primaryButtonText}>{t('verification.takePhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.laterText}>{t('verification.verifyLater')}</Text>
          </TouchableOpacity>
        </View>
        </ResponsiveContainer>
      </SafeAreaView>
    );
  }

  // Step 2: Camera
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />

        <SafeAreaView style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setStep('instruction')} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {gestureConfig && currentGesture && (
            <View style={styles.cameraGestureBanner}>
              <Ionicons name={gestureConfig.icon as any} size={20} color="#FFFFFF" />
              <Text style={styles.cameraGestureText}>
                {t(`verification.gesture_${currentGesture}`)}
              </Text>
            </View>
          )}

          <View style={styles.cameraActions}>
            <TouchableOpacity style={styles.captureButton} onPress={handleTakePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Step 3: Preview
  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleRetake} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.previewContainer}>
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        )}

        {gestureConfig && currentGesture && (
          <View style={styles.previewGestureBadge}>
            <Ionicons name={gestureConfig.icon as any} size={16} color={Colors.primary} />
            <Text style={styles.previewGestureText}>
              {t(`verification.gesture_${currentGesture}`)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.previewActions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={Colors.textOnPrimary} />
              <Text style={styles.primaryButtonText}>{t('verification.submit')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleRetake}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={Colors.primary} />
          <Text style={styles.secondaryButtonText}>{t('verification.retakePhoto')}</Text>
        </TouchableOpacity>
      </View>
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
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 16,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primaryPastel,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontFamily: Fonts.heading,
      color: c.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    gestureCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    gestureLabel: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    gestureName: {
      fontSize: 18,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      textAlign: 'center',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 24,
      marginTop: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primaryPastel,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.primaryLight,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.primary,
    },
    laterText: {
      fontSize: 15,
      fontFamily: Fonts.bodyMedium,
      color: c.textTertiary,
      marginTop: 4,
    },
    permissionText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginTop: 16,
    },
    // Camera
    cameraContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },
    cameraHeader: {
      paddingHorizontal: 8,
      paddingTop: 8,
    },
    cameraGestureBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    cameraGestureText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: '#FFFFFF',
    },
    cameraActions: {
      alignItems: 'center',
      paddingBottom: 40,
    },
    captureButton: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    captureInner: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#FFFFFF',
    },
    // Preview
    previewContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    preview: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 20,
    },
    previewGestureBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.primaryPastel,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      marginTop: 12,
    },
    previewGestureText: {
      fontSize: 14,
      fontFamily: Fonts.bodyMedium,
      color: c.primaryDark,
    },
    previewActions: {
      paddingHorizontal: 32,
      paddingBottom: 24,
      gap: 12,
      alignItems: 'center',
    },
  });
}

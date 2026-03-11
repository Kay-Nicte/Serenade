import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { GESTURES } from '@/constants/gestures';
import { supabase } from '@/lib/supabase';
import { Config } from '@/constants/config';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

interface VerificationRequest {
  id: string;
  user_id: string;
  gesture: string;
  selfie_storage_path: string;
  created_at: string;
  profile: {
    name: string | null;
    avatar_url: string | null;
    birth_date: string | null;
    bio: string | null;
    created_at: string;
  };
  // Resolved client-side after fetching
  selfie_signed_url?: string | null;
  profile_photo_urls?: string[];
}

export default function AdminVerificationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_get_pending_verifications');
      if (error) throw error;
      const raw: VerificationRequest[] = (data as any[]) ?? [];

      // Generate signed URLs for selfies and fetch profile photos
      const enriched = await Promise.all(
        raw.map(async (req) => {
          // Signed URL for selfie (private bucket)
          let selfie_signed_url: string | null = null;
          if (req.selfie_storage_path) {
            const { data: signedData } = await supabase.storage
              .from('verification-selfies')
              .createSignedUrl(req.selfie_storage_path, 3600);
            selfie_signed_url = signedData?.signedUrl ?? null;
          }

          // Fetch profile photos from photos table
          let profile_photo_urls: string[] = [];
          const { data: photosData } = await supabase
            .from('photos')
            .select('storage_path')
            .eq('user_id', req.user_id)
            .order('position', { ascending: true });
          if (photosData) {
            profile_photo_urls = photosData.map((p: any) => {
              const { data: urlData } = supabase.storage
                .from(Config.storageBucket)
                .getPublicUrl(p.storage_path);
              return urlData.publicUrl;
            });
          }

          return { ...req, selfie_signed_url, profile_photo_urls };
        }),
      );

      setRequests(enriched);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { data, error } = await supabase.rpc('admin_review_verification', {
        request_id: requestId,
        approve: true,
        reject_reason: null,
      });
      if (error) throw error;
      const matchCount = (data as any)?.matches_created ?? 0;
      showToast(t('admin.verificationApproved', { count: matchCount }), 'success');
      await fetchRequests();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase.rpc('admin_review_verification', {
        request_id: requestId,
        approve: false,
        reject_reason: rejectReason.trim() || null,
      });
      if (error) throw error;
      showToast(t('admin.verificationRejected'), 'info');
      setRejectingId(null);
      setRejectReason('');
      await fetchRequests();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const gestureConfig = (gesture: string) => GESTURES[gesture] ?? null;

  const renderRequest = ({ item }: { item: VerificationRequest }) => {
    const gesture = gestureConfig(item.gesture);
    const isProcessing = processingId === item.id;
    const isRejecting = rejectingId === item.id;
    const userName = item.profile?.name ?? '—';
    const avatarUrl = item.profile?.avatar_url ?? null;

    return (
      <View style={styles.card}>
        {/* User info header */}
        <View style={styles.userRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.miniAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.miniAvatar, styles.miniAvatarPlaceholder]}>
              <Ionicons name="person" size={16} color={Colors.primaryLight} />
            </View>
          )}
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.dateText}>
            {new Date(item.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}
          </Text>
        </View>

        {/* Gesture label */}
        {gesture && (
          <View style={styles.gestureRow}>
            <Text style={styles.gestureLabel}>{t('admin.requestedGesture')}:</Text>
            <Ionicons name={gesture.icon as any} size={18} color={Colors.primary} />
            <Text style={styles.gestureText}>{t(`verification.gesture_${item.gesture}`)}</Text>
          </View>
        )}

        {/* Selfie photo */}
        <Text style={styles.sectionLabel}>{t('admin.selfiePhoto')}</Text>
        {item.selfie_signed_url ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setViewerUrl(item.selfie_signed_url!)}>
            <Image source={{ uri: item.selfie_signed_url }} style={styles.selfieImage} contentFit="cover" transition={200} />
          </TouchableOpacity>
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={32} color={Colors.textTertiary} />
          </View>
        )}

        {/* Profile photos for comparison */}
        {(item.profile_photo_urls?.length ?? 0) > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('admin.profilePhotos')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
              {item.profile_photo_urls!.map((uri, index) => (
                <TouchableOpacity key={index} activeOpacity={0.8} onPress={() => setViewerUrl(uri)}>
                  <Image source={{ uri }} style={styles.profilePhoto} contentFit="cover" transition={200} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Reject reason input */}
        {isRejecting && (
          <View style={styles.rejectSection}>
            <TextInput
              style={styles.rejectInput}
              placeholder={t('admin.rejectReason')}
              placeholderTextColor={Colors.textTertiary}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {isRejecting ? (
            <>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setRejectingId(null); setRejectReason(''); }}
                disabled={isProcessing}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(item.id)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="close" size={18} color={Colors.textOnPrimary} />
                    <Text style={styles.rejectButtonText}>{t('admin.reject')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.rejectOutlineButton}
                onPress={() => setRejectingId(item.id)}
                disabled={isProcessing}
              >
                <Ionicons name="close" size={18} color={Colors.error} />
                <Text style={styles.rejectOutlineButtonText}>{t('admin.reject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => handleApprove(item.id)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={Colors.textOnPrimary} />
                    <Text style={styles.approveButtonText}>{t('admin.approve')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('admin.verifications')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('admin.noVerifications')}</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          onRefresh={fetchRequests}
          refreshing={isLoading}
        />
      )}

      {/* Fullscreen photo viewer */}
      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {viewerUrl && (
            <Image
              source={{ uri: viewerUrl }}
              style={styles.viewerImage}
              contentFit="contain"
              transition={200}
            />
          )}
        </View>
      </Modal>
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 16,
      fontFamily: Fonts.body,
      color: c.textSecondary,
      textAlign: 'center',
    },
    list: {
      padding: 16,
      gap: 16,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    miniAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    miniAvatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userName: {
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      flex: 1,
    },
    dateText: {
      fontSize: 12,
      fontFamily: Fonts.body,
      color: c.textTertiary,
    },
    gestureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.primaryPastel,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    gestureLabel: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
    },
    gestureText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.primaryDark,
      flex: 1,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: Fonts.bodyMedium,
      color: c.textSecondary,
      marginTop: 4,
    },
    selfieImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
    },
    noImage: {
      width: '100%',
      aspectRatio: 3 / 4,
      borderRadius: 12,
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photosRow: {
      gap: 8,
    },
    profilePhoto: {
      width: 80,
      height: 100,
      borderRadius: 8,
    },
    rejectSection: {
      gap: 8,
    },
    rejectInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.text,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    approveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.success,
      paddingVertical: 12,
      borderRadius: 12,
    },
    approveButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    rejectOutlineButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.surfaceSecondary,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    rejectOutlineButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.error,
    },
    rejectButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.error,
      paddingVertical: 12,
      borderRadius: 12,
    },
    rejectButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.textOnPrimary,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSecondary,
      paddingVertical: 12,
      borderRadius: 12,
    },
    cancelButtonText: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.textSecondary,
    },
    viewerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewerClose: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    viewerImage: {
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height * 0.8,
    },
  });
}

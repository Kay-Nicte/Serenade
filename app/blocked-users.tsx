import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { useBlock } from '@/hooks/useBlock';
import { useMatchStore } from '@/stores/matchStore';
import type { BlockedUser } from '@/stores/blockStore';
import { showToast } from '@/stores/toastStore';
import { showConfirm } from '@/components/ConfirmDialog';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const { blockedUsers, isLoading, unblockUser } = useBlock();

  const handleUnblock = (user: BlockedUser) => {
    showConfirm({
      title: t('block.unblockConfirmTitle', { name: user.blocked_name ?? '' }),
      message: t('block.unblockConfirmMessage', { name: user.blocked_name ?? '' }),
      confirmLabel: t('block.unblock'),
      destructive: false,
      onConfirm: async () => {
        try {
          await unblockUser(user.blocked_id);
          await useMatchStore.getState().fetchMatches();
        } catch {
          showToast(t('block.errorUnblocking'), 'error');
        }
      },
    });
  };

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.row}>
      {item.blocked_avatar_url ? (
        <Image
          source={{ uri: item.blocked_avatar_url }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={24} color={Colors.primaryLight} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {item.blocked_name ?? ''}
      </Text>
      <TouchableOpacity
        onPress={() => handleUnblock(item)}
        style={styles.unblockButton}
        activeOpacity={0.7}
      >
        <Text style={styles.unblockText}>{t('block.unblock')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('block.blockedUsers')}</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="shield-checkmark-outline" size={64} color={Colors.primaryLight} />
          <Text style={styles.emptyText}>{t('block.noBlockedUsers')}</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
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
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
      backgroundColor: c.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 20,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginLeft: 4,
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
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: {
      flex: 1,
      fontSize: 16,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
      marginLeft: 12,
    },
    unblockButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.error,
    },
    unblockText: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.error,
    },
  });
}

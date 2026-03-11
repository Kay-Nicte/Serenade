import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Fonts } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { showConfirm } from '@/components/ConfirmDialog';
import { showToast } from '@/stores/toastStore';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

interface UserRow {
  id: string;
  name: string | null;
  avatar_url: string | null;
  is_moderator: boolean;
  is_admin: boolean;
}

export default function ManageModeratorsScreen() {
  const { t } = useTranslation();
  const Colors = useColors();
  const styles = makeStyles(Colors);
  const router = useRouter();

  const [moderators, setModerators] = useState<UserRow[]>([]);
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchModerators = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, is_moderator, is_admin')
        .eq('is_moderator', true)
        .order('name');
      if (error) throw error;
      setModerators(data ?? []);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchModerators();
  }, [fetchModerators]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc('admin_search_users', {
        search_query: query.trim(),
      });
      if (error) throw error;
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      // Search failed silently
    } finally {
      setSearching(false);
    }
  };

  const handleToggleModerator = (user: UserRow) => {
    const action = user.is_moderator ? 'remove' : 'add';
    showConfirm({
      title: action === 'add'
        ? t('admin.addModeratorTitle')
        : t('admin.removeModeratorTitle'),
      message: action === 'add'
        ? t('admin.addModeratorMessage', { name: user.name ?? '' })
        : t('admin.removeModeratorMessage', { name: user.name ?? '' }),
      confirmLabel: action === 'add' ? t('admin.addModerator') : t('admin.removeModerator'),
      destructive: action === 'remove',
      onConfirm: async () => {
        try {
          const { error } = await supabase.rpc('set_moderator', {
            target_user_id: user.id,
            make_moderator: action === 'add',
          });
          if (error) throw error;
          showToast(
            action === 'add' ? t('admin.moderatorAdded') : t('admin.moderatorRemoved'),
            'success'
          );
          await fetchModerators();
          // Refresh search results too
          if (searchQuery.trim().length >= 2) {
            handleSearch(searchQuery);
          }
        } catch {
          showToast(t('common.error'), 'error');
        }
      },
    });
  };

  const renderUser = ({ item }: { item: UserRow }) => (
    <View style={styles.userCard}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={20} color={Colors.primaryLight} />
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name ?? '—'}</Text>
        {item.is_admin && (
          <Text style={styles.adminLabel}>Admin</Text>
        )}
        {item.is_moderator && !item.is_admin && (
          <Text style={styles.modLabel}>{t('admin.moderatorBadge')}</Text>
        )}
      </View>
      {!item.is_admin && (
        <TouchableOpacity
          style={[styles.toggleButton, item.is_moderator && styles.toggleButtonRemove]}
          onPress={() => handleToggleModerator(item)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.is_moderator ? 'remove-circle-outline' : 'add-circle-outline'}
            size={18}
            color={item.is_moderator ? Colors.error : Colors.success}
          />
          <Text style={[styles.toggleText, item.is_moderator ? { color: Colors.error } : { color: Colors.success }]}>
            {item.is_moderator ? t('admin.removeModerator') : t('admin.addModerator')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('admin.manageModerators')}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={Colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder={t('admin.searchUsers')}
          placeholderTextColor={Colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={Colors.primary} />}
      </View>

      {/* Search results */}
      {searchQuery.trim().length >= 2 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.searchResults')}</Text>
          {searchResults.length === 0 && !searching ? (
            <Text style={styles.emptyText}>{t('admin.noUsersFound')}</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderUser}
              scrollEnabled={false}
            />
          )}
        </View>
      )}

      {/* Current moderators */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.currentModerators')}</Text>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
        ) : moderators.length === 0 ? (
          <Text style={styles.emptyText}>{t('admin.noModerators')}</Text>
        ) : (
          <FlatList
            data={moderators}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            scrollEnabled={false}
          />
        )}
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
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 20,
      fontFamily: Fonts.heading,
      color: c.text,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderLight,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.body,
      color: c.text,
      padding: 0,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 14,
      fontFamily: Fonts.bodySemiBold,
      color: c.textSecondary,
      marginBottom: 10,
      textTransform: 'uppercase',
    },
    emptyText: {
      fontSize: 14,
      fontFamily: Fonts.body,
      color: c.textTertiary,
      textAlign: 'center',
      paddingVertical: 16,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarPlaceholder: {
      backgroundColor: c.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 15,
      fontFamily: Fonts.bodySemiBold,
      color: c.text,
    },
    adminLabel: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: c.warning,
    },
    modLabel: {
      fontSize: 11,
      fontFamily: Fonts.bodySemiBold,
      color: c.secondary,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.surfaceSecondary,
    },
    toggleButtonRemove: {},
    toggleText: {
      fontSize: 12,
      fontFamily: Fonts.bodySemiBold,
    },
  });
}

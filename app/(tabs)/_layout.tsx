import { useCallback, useEffect, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuthStore } from '@/stores/authStore';
import { useIceBreakerStore } from '@/stores/iceBreakerStore';
import { PremiumExpiryModal } from '@/components/PremiumExpiryModal';
import { supabase } from '@/lib/supabase';

function useAdminPendingCount(isAdmin: boolean) {
  const [count, setCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!isAdmin) {
      setCount(0);
      return;
    }
    try {
      const [reportsRes, verificationsRes] = await Promise.all([
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.rpc('admin_get_pending_verifications'),
      ]);

      const reportCount = reportsRes.count ?? 0;
      const verificationCount = Array.isArray(verificationsRes.data) ? verificationsRes.data.length : 0;
      setCount(reportCount + verificationCount);
    } catch {
      // Non-critical
    }
  }, [isAdmin]);

  // Refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, [fetchCounts])
  );

  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(fetchCounts, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin, fetchCounts]);

  return count;
}

export default function TabLayout() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.is_admin === true;
  const pendingCount = useIceBreakerStore((s) => s.pendingIceBreakers.length);
  const adminPendingCount = useAdminPendingCount(isAdmin);

  return (
    <>
    <PremiumExpiryModal />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.borderLight,
        },
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t('tabs.matches'),
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="sparkles-outline" size={size} color={color} />
              {pendingCount > 0 && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeText}>
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('tabs.admin'),
          href: isAdmin ? '/(tabs)/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="shield-outline" size={size} color={color} />
              {adminPendingCount > 0 && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeText}>
                    {adminPendingCount > 9 ? '9+' : adminPendingCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
    </>
  );
}

const tabStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    color: Colors.textOnPrimary,
  },
});

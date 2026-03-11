import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

// Catch-all for unmatched routes — redirect to welcome.
// AuthGuard will then send the user to the right place based on auth state.
export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(auth)/welcome');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

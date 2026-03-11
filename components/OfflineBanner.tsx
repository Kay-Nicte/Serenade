import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';

export function OfflineBanner() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={16} color={Colors.textOnPrimary} />
      <Text style={styles.text}>{t('common.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.warning,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.textOnPrimary,
  },
});

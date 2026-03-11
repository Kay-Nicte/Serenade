import { View, type ViewStyle } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Centers content with a max width on tablets/landscape.
 * Wrap screen content (inside SafeAreaView) with this component.
 */
export function ResponsiveContainer({ children, style }: Props) {
  const { contentMaxWidth, isTablet } = useResponsive();

  if (!isTablet) {
    return <View style={[{ flex: 1 }, style]}>{children}</View>;
  }

  return (
    <View style={[{ flex: 1, alignItems: 'center' }, style]}>
      <View style={{ flex: 1, width: '100%', maxWidth: contentMaxWidth }}>
        {children}
      </View>
    </View>
  );
}

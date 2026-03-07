export const lightColors = {
  primary: '#E6A8B4',
  primaryDark: '#D4899A',
  primaryLight: '#F2CDD5',
  primaryPastel: '#FFF0F3',

  secondary: '#8B5E83',
  secondaryLight: '#B08AAC',

  background: '#FFFBFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#FDF2F4',

  text: '#2D1F2D',
  textSecondary: '#6B5A6B',
  textTertiary: '#9B8A9B',
  textOnPrimary: '#FFFFFF',

  border: '#E8D8E8',
  borderLight: '#F0E6F0',

  success: '#7BC77B',
  error: '#E07070',
  warning: '#E0C070',

  goldBg: '#FBF4EB',
  goldBorder: '#E2D0B8',
  goldText: '#7A5C2E',
  goldAccent: '#B8893A',

  overlay: 'rgba(45, 31, 45, 0.5)',

  tabBar: '#FFFFFF',
  tabBarActive: '#E6A8B4',
  tabBarInactive: '#9B8A9B',
} as const;

export const darkColors = {
  primary: '#E6A8B4',
  primaryDark: '#D4899A',
  primaryLight: '#F2CDD5',
  primaryPastel: '#3D2030',

  secondary: '#8B5E83',
  secondaryLight: '#B08AAC',

  background: '#1C1218',
  surface: '#261A22',
  surfaceSecondary: '#2E2029',

  text: '#F5EFF5',
  textSecondary: '#C4B0C4',
  textTertiary: '#8A758A',
  textOnPrimary: '#FFFFFF',

  border: '#3D2D3A',
  borderLight: '#2E2030',

  success: '#7BC77B',
  error: '#E07070',
  warning: '#E0C070',

  goldBg: '#2A2220',
  goldBorder: '#4A3D32',
  goldText: '#C8AD8A',
  goldAccent: '#B89B6A',

  overlay: 'rgba(0,0,0,0.7)',

  tabBar: '#1C1218',
  tabBarActive: '#E6A8B4',
  tabBarInactive: '#8A758A',
} as const;

export type AppColors = typeof lightColors;

// Keep for backwards compatibility in non-component contexts
export const Colors = lightColors;

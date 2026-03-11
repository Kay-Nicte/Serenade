import { type ExpoConfig, type ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Serena',
  slug: 'Serena',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'serena',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Serena necesita acceso a tu cámara para tomar fotos de perfil.',
      NSPhotoLibraryUsageDescription:
        'Serena necesita acceso a tu galería para seleccionar fotos de perfil.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6A8B4',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    output: 'static' as const,
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFF0F3',
      },
    ],
    'expo-font',
    'expo-localization',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Serena necesita acceso a tu galería para seleccionar fotos de perfil.',
        cameraPermission:
          'Serena necesita acceso a tu cámara para tomar fotos de perfil.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-notifications',
      {
        color: '#E6A8B4',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    },
  },
});

import { type ExpoConfig, type ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Serenade',
  slug: 'Serenade',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'serenade',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.ixabel.serenade',
    supportsTablet: true,
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      NSCameraUsageDescription:
        'Serenade necesita acceso a tu cámara para tomar fotos de perfil.',
      NSPhotoLibraryUsageDescription:
        'Serenade necesita acceso a tu galería para seleccionar fotos de perfil.',
      NSLocationWhenInUseUsageDescription:
        'Serenade necesita tu ubicación para compartirla en citas seguras y mostrar perfiles cercanos.',
      NSMicrophoneUsageDescription:
        'Serenade necesita acceso a tu micrófono para enviar mensajes de audio.',
    },
  },
  android: {
    package: 'com.ixabel.serenade',
    googleServicesFile: './google-services.json',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    edgeToEdgeEnabled: true,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECORD_AUDIO',
    ],
  },
  web: {
    output: 'static' as const,
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-dev-client',
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 320,
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
          'Serenade necesita acceso a tu galería para seleccionar fotos de perfil.',
        cameraPermission:
          'Serenade necesita acceso a tu cámara para tomar fotos de perfil.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Serenade necesita tu ubicación para compartirla en citas seguras y mostrar perfiles cercanos.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#E6A8B4',
      },
    ],
    [
      'expo-av',
      {
        microphonePermission:
          'Serenade necesita acceso a tu micrófono para enviar mensajes de audio.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  updates: {
    url: 'https://u.expo.dev/98901d6c-f25e-401c-bbc2-bda2120a90a8',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenueCatAppleKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY,
    revenueCatGoogleKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY,
    giphyApiKey: process.env.EXPO_PUBLIC_GIPHY_API_KEY,
    giphyApiKeyIos: process.env.EXPO_PUBLIC_GIPHY_API_KEY_IOS,
    eas: {
      projectId: '98901d6c-f25e-401c-bbc2-bda2120a90a8',
    },
  },
});

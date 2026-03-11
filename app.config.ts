import { type ExpoConfig, type ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Serenade',
  slug: 'Serenade',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'serenade',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.ixabel.serenade',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Serenade needs access to your camera to take profile photos.',
      NSPhotoLibraryUsageDescription:
        'Serenade needs access to your photo library to select profile photos.',
      NSLocationWhenInUseUsageDescription:
        'Serenade needs your location to share it on safe dates and show nearby profiles.',
      NSMicrophoneUsageDescription:
        'Serenade needs access to your microphone to send audio messages.',
      ITSAppUsesNonExemptEncryption: false,
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
          'Serenade needs access to your photo library to select profile photos.',
        cameraPermission:
          'Serenade needs access to your camera to take profile photos.',
      },
    ],
    '@react-native-community/datetimepicker',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Serenade needs your location to share it on safe dates and show nearby profiles.',
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
          'Serenade needs access to your microphone to send audio messages.',
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

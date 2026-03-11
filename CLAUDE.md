# Serenade - Project Instructions

## Tech Stack
- Expo SDK 52 (React Native) with expo-router
- Supabase (auth, database, storage, realtime)
- RevenueCat (subscriptions)
- Zustand (state management)
- i18next (translations: es, en, eu, ca, fr, gl, it, de, pt)
- TypeScript

## Agent Workflow (Token Optimization)

Use different models for different phases. Switch with `/model` and clear context with `/clear`.

### 1. Researcher (Opus)
- Investigates the task: reads docs, SDKs, existing code, known issues
- Creates a detailed implementation plan
- Identifies edge cases and platform differences (Android vs iOS)
- Output: clear step-by-step plan as a message before `/clear`

### 2. Implementer (Sonnet)
- Executes the plan from the researcher
- Reads existing code, makes changes following the plan
- Does NOT improvise beyond the plan
- Keeps changes minimal and focused

### 3. Tester (Haiku)
- Writes tests based on the implementation
- Does NOT decide what to test — follows the plan
- Runs existing tests to verify nothing broke

### 4. Fixer (Sonnet)
- Diagnoses bugs and errors
- Analyzes impact before fixing
- Checks platform-specific behavior (Android/iOS)

### 5. Explorer (Haiku)
- Read-only: answers quick questions about the codebase
- Use for "where is X?", "how does Y work?", "what calls Z?"

### Flow
```
/model opus        → Research & plan
/clear
/model sonnet      → Implement the plan
/clear
/model haiku       → Write tests
/clear
/model sonnet      → Fix any issues
```

## Key Directories
- `app/` - Expo Router screens and layouts
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks
- `stores/` - Zustand state stores
- `lib/` - Utilities (supabase, auth, notifications, presence, purchases)
- `constants/` - Config, colors, fonts
- `i18n/` - Translation files

## Important Patterns
- Auth flow: AuthGuard in `app/_layout.tsx` handles all routing based on auth state
- Supabase v2.97.0 uses PKCE flow for email actions (password reset sends `?code=` not `#access_token=`)
- Google OAuth uses implicit flow (tokens in URL fragment)
- `extractSessionFromUrl` in `_layout.tsx` handles both PKCE and implicit flows
- OTA updates via expo-updates with user-prompted reload
- Profile state tracked via `isProfileFetched` flag to prevent race conditions in AuthGuard

## Build & Deploy
- Android: `eas build --platform android --profile production`
- iOS: `eas build --platform ios --profile production`
- OTA update: `eas update --branch production`
- Credentials managed remotely on EAS servers

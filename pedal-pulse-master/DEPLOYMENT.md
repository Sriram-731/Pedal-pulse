# Pedagog Pulse - Deployment & Setup Guide

This guide describes how to deploy the Pedal Pulse React Native application and its Supabase backend.

## 1. Backend Setup (Supabase)

Pedal Pulse is built completely with an open-source compatible tech stack, allowing you to self-host Supabase or use their managed cloud tier.

1. Create a new Supabase project (or setup local docker instance).
2. Run the initial SQL script located in `supabase/migrations/20260221000000_initial_schema.sql` via the Supabase SQL editor.
3. Run the Row Level Security (RLS) SQL script located in `supabase/migrations/20260221000001_rls_policies.sql`.
4. Ensure Email Auth is enabled under Authentication > Providers. (Disable 'Confirm email' for testing ease).
5. Open your Expo React Native project and fill the keys:

Create a `.env` in the root of `pedal-pulse/`:
```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 2. Push Notifications (Firebase)

The project leverages `expo-notifications`. To send notifications to Android over FCM:
1. Go to Firebase Console -> Add Project.
2. Under Project Settings -> Cloud Messaging, enable Firebase Cloud Messaging API (V1).
3. In Expo dashboard, supply your Google Services JSON for building if using EAS.

## 3. MapLibre Integration

MapLibre does not require paid tokens. However, the vector tiles URL currently pointing to Carto requires no key for moderate development:
`https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`

For high volume production, replace the `TILE_URL` in `MapScreen.tsx` with a proper hosting solution like Maptiler or self-hosted OpenMapTiles.

## 4. Building for Production

Pedal Pulse uses Expo Application Services (EAS). Build using:
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build Android APK / AAB
eas build -p android --profile production

# Build iOS Archive
eas build -p ios --profile production
```

## 5. Testing & Edge Cases Handled
- **Offline Mode:** MapLibre offline caching automatically handles map rendering.
- **Crash Detection:** Uses strictly bounded limits for Accelerometer/Gyroscope ensuring no false positives when just dropping the phone vs a real crash (impact + spin).
- **Background GPS:** Expo location services continue updating `useRideStore` if foreground service permissions are requested.
- **Cheating/Deviation Control:** `checkRaceCorridorDeviation()` guarantees the user stays within a configurable corridor (default 50m) utilizing PostGIS / TurfJS Point to Linestring distance checks.

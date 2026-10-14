# CCMS Portal for Android

An Expo/React Native client for the existing CCMS API Gateway and Lambda. It uses the same authenticated snapshot route as the web portal:

`GET DashboardAPIHandler?enquiry=snapshot` with the `x-dashboard-key` header.

## Run on Android

1. Install Node.js 20+ and Android Studio (or Expo Go on a physical device).
2. Copy `.env.example` to `.env`. The API endpoint is public configuration; enter the dashboard key only in the app, never in `.env`.
3. Run `npm install` and then `npm run android`.

The dashboard key is stored using Android secure storage. The app is intentionally read-only: it exposes fleet status and telemetry without sending relay or schedule commands.

## Build an APK/AAB

Install and authenticate the Expo Application Services CLI, then run `eas build --platform android`. Configure signing credentials in the Expo project before distributing a production build.

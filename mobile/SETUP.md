# Family Tree (Expo) — setup & build

React Native rewrite of the family-tree app on Expo (managed). One codebase →
Android, iOS, and web (react-native-web).

## Run

```bash
cd mobile
npm install --legacy-peer-deps     # tfjs peers need legacy resolution
npx expo start                     # press w (web), a (Android), i (iOS)
npx expo start --web               # web only
```

`.env` holds the keys (already present): `EXPO_PUBLIC_FIREBASE_*`,
`EXPO_PUBLIC_GEMINI_API_KEY`.

## Google Sign-In (optional)

Email/password works out of the box. To enable the "Continue with Google"
button, create OAuth client IDs in Google Cloud console and add to `.env`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
```

The button stays disabled until at least one is set. Authorized redirect URI for
web is your Expo/host origin; for native use the `familytree` scheme.

## EAS build (APK / IPA)

Project is linked to EAS project `ac3bc5f6-7329-479e-8917-90a5b995d0fa`
(`app.json` → `extra.eas.projectId`). Profiles are in `eas.json`.

```bash
npm i -g eas-cli         # or use npx eas-cli@latest
eas login
npx eas-cli@latest init --id ac3bc5f6-7329-479e-8917-90a5b995d0fa
eas build -p android --profile preview     # APK for sideloading
eas build -p ios --profile preview         # needs an Apple account
eas build --profile production             # store builds
```

## Face match — native note

The face engine uses TensorFlow.js:
- **Web**: runs in-browser on the WebGL backend (fully working, verified).
- **Native (Android/iOS)**: runs via `@tensorflow/tfjs-react-native`, which needs
  a real native runtime (expo-gl, expo-camera). It does **not** run in Expo Go —
  build a dev/preview client with EAS (above) and test face match there.

## Architecture map

- `app/` — expo-router screens: `home`, `login`, `member`, `profile`, `link`,
  `tree` (3 viz views), `facematch`, `chat`, `export`.
- `src/shared/` — pure logic (types, adjacency, layouts, validation, relationship
  actions, gemini, export/import builders). DOM-free, ported from the web app.
- `src/viz/` — Tree / Radial / Timeline on react-native-svg + gesture pan/zoom.
- `src/face/` — face engine (platform-split `.web` / `.native`) + match/cache.
- `src/export/` — file IO (web download / native share) + tree image.
- `src/theme/` — dark-default tokens + GlassSurface (expo-blur).
- `src/firebase/` — config, auth, firestore, useFamilyTree.

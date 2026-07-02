// Firebase init. Reuses the existing family-tree-6a597 project.
// On native, auth state is persisted via AsyncStorage; on web, default.
import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  // @ts-expect-error getReactNativePersistence has loose typing in some setups
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check (web) — attests requests come from the real app, not a script reusing
// the public config. Enable by setting EXPO_PUBLIC_RECAPTCHA_SITE_KEY (Firebase
// console → App Check → reCAPTCHA v3). Native needs Play Integrity/DeviceCheck (later).
if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) { console.warn('App Check init failed', e); }
}

let auth: Auth;
if (Platform.OS === 'web') {
  // Explicit local persistence so the session survives a page refresh.
  try {
    auth = initializeAuth(app, { persistence: browserLocalPersistence });
  } catch {
    auth = getAuth(app); // already initialized (Fast Refresh)
  }
} else {
  try {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // already initialized (Fast Refresh)
    auth = getAuth(app);
  }
}

export { app, auth };
export const db = getFirestore(app);

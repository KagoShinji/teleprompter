import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp =
  typeof window !== "undefined" && isConfigured
    ? getApps().length
      ? getApp()
      : initializeApp(firebaseConfig)
    : null;

export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (!firebaseApp || typeof window === "undefined" || !(await isSupported())) {
    return null;
  }
  return getAnalytics(firebaseApp);
}

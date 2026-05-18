"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
  type User,
} from "firebase/auth";

type FirebasePublicConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
};

let cachedAuth: Auth | null | undefined;

function getFirebaseConfig(): FirebasePublicConfig | null {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.appId
  ) {
    return null;
  }

  return config as FirebasePublicConfig;
}

function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebaseConfig();

  if (!config) return null;
  return getApps().length ? getApp() : initializeApp(config);
}

export function isFirebaseConfigured() {
  return Boolean(getFirebaseConfig());
}

export function getFirebaseAuth() {
  if (cachedAuth !== undefined) return cachedAuth;
  const app = getFirebaseApp();
  cachedAuth = app ? getAuth(app) : null;
  return cachedAuth;
}

export function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export async function getFirebaseIdToken(user: User | null) {
  return (await user?.getIdToken(false)) ?? null;
}

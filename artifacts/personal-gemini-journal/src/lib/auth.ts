import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { setAuthTokenGetter } from '@workspace/api-client-react';

export type FirebaseConfigState = {
  configured: boolean;
  projectId: string;
  apiKey: string;
};

const TOKEN_KEY = 'personal-gemini-journal.firebase-token';
const EMAIL_KEY = 'personal-gemini-journal.email';

export function getFirebaseConfig(): FirebaseConfigState {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY ?? '');
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '');
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '');
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID ?? '');
  return { configured: Boolean(apiKey && projectId && authDomain && appId), apiKey, projectId };
}

const config = getFirebaseConfig();
const firebaseApp = config.configured
  ? getApps()[0] ??
    initializeApp({
      apiKey: config.apiKey,
      authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? ''),
      projectId: config.projectId,
      storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? ''),
      messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''),
      appId: String(import.meta.env.VITE_FIREBASE_APP_ID ?? ''),
    })
  : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
let cachedToken = localStorage.getItem(TOKEN_KEY) ?? '';

if (firebaseAuth) {
  void setPersistence(firebaseAuth, browserLocalPersistence);
  setAuthTokenGetter(async () => firebaseAuth.currentUser?.getIdToken() ?? null);
}

export function getFirebaseIdToken(): string {
  return cachedToken;
}

export function hasFirebaseSession(): boolean {
  return Boolean(firebaseAuth?.currentUser || cachedToken);
}

export async function clearFirebaseSession(): Promise<void> {
  cachedToken = '';
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export function authRequest() {
  return {};
}

export function subscribeFirebaseAuth(listener: (user: User | null) => void) {
  if (!firebaseAuth) {
    listener(null);
    return () => undefined;
  }
  return onAuthStateChanged(firebaseAuth, (user) => {
    if (!user) {
      cachedToken = '';
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      listener(null);
      return;
    }
    void user.getIdToken().then((token) => {
      cachedToken = token;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(EMAIL_KEY, user.email ?? '');
      listener(user);
    }).catch(() => listener(null));
  });
}

export async function signInWithFirebasePassword(email: string, password: string): Promise<string> {
  const config = getFirebaseConfig();
  if (!config.configured) throw new Error('Firebase is not configured for this deployment.');
  if (!firebaseAuth) {
    throw new Error('Firebase Auth could not be initialized for this deployment.');
  }
  try {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const token = await credential.user.getIdToken();
    cachedToken = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMAIL_KEY, credential.user.email ?? email);
    return token;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    throw new Error(code.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/.*\)\.?$/, '') || 'Firebase sign-in could not be completed.');
  }
}
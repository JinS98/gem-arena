import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

let services: FirebaseServices | undefined;

export function getFirebase(): FirebaseServices {
  if (services) return services;
  if (!config.apiKey || !config.projectId) {
    throw new Error('Firebase .env 설정이 필요합니다.');
  }

  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, 'asia-northeast3');

  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  services = { app, auth, db, functions };
  return services;
}

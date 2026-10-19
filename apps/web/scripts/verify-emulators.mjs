import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const config = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-gem-arena.firebaseapp.com',
  projectId: 'demo-gem-arena',
  appId: 'demo-gem-arena',
};

const app = initializeApp(config, 'verified-user');
const guestApp = initializeApp(config, 'guest');

try {
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await signInAnonymously(auth);
  assert.ok(credential.user.uid);

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const room = doc(db, 'rooms', 'day-04-probe');
  await assert.rejects(getDoc(room), error => error.code === 'permission-denied');
  await assert.rejects(setDoc(room, { probe: true }), error => error.code === 'permission-denied');

  const functions = getFunctions(app, 'asia-northeast3');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const health = await httpsCallable(functions, 'emulatorHealth')({});
  assert.deepEqual(health.data, { ok: true });

  const guestFunctions = getFunctions(guestApp, 'asia-northeast3');
  connectFunctionsEmulator(guestFunctions, '127.0.0.1', 5001);
  await assert.rejects(
    httpsCallable(guestFunctions, 'emulatorHealth')({}),
    error => error.code === 'functions/unauthenticated',
  );

  console.log('Auth 익명 로그인, Firestore 읽기/쓰기 거부, Functions 인증 검증 통과');
} finally {
  await Promise.all([deleteApp(app), deleteApp(guestApp)]);
}

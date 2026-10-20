import { browserLocalPersistence, setPersistence, signInAnonymously, updateProfile, type User } from 'firebase/auth';
import { getFirebase } from './firebase';
import { nicknameError, normalizeNickname } from './nickname';

export { nicknameError, normalizeNickname } from './nickname';

let sessionPromise: Promise<User> | undefined;

/** Auth 복원이 끝난 뒤에만 새 익명 계정을 만든다. 중복 마운트도 같은 요청을 공유한다. */
export function ensureAnonymousSession(): Promise<User> {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    const { auth } = getFirebase();
    await auth.authStateReady();
    if (auth.currentUser) return auth.currentUser;
    await setPersistence(auth, browserLocalPersistence);
    return (await signInAnonymously(auth)).user;
  })().finally(() => {
    sessionPromise = undefined;
  });
  return sessionPromise;
}

/** 방 닉네임의 기본값만 Auth 프로필에 보관한다. 방별 확정값은 방 참가 API가 저장한다. */
export async function savePreferredNickname(user: User, value: string): Promise<string> {
  const error = nicknameError(value);
  if (error) throw new RangeError(error);
  const nickname = normalizeNickname(value);
  await updateProfile(user, { displayName: nickname });
  return nickname;
}

import { HttpsError, onCall } from 'firebase-functions/v2/https';

export { createRoom, joinRoom } from './rooms.js';

// 로컬 연결 확인용 읽기 전용 함수.
export const emulatorHealth = onCall({ region: 'asia-northeast3' }, request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  return { ok: true };
});

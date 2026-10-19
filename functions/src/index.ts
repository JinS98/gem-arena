import { HttpsError, onCall } from 'firebase-functions/v2/https';

// 로컬 연결 확인용 읽기 전용 함수. 게임 상태 변경 API는 이후 일차에 구현합니다.
export const emulatorHealth = onCall({ region: 'asia-northeast3' }, request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  return { ok: true };
});

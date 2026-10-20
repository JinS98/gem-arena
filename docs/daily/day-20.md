# 20일차 — 방 생성·초대 코드·참가 검증

**단계:** 멀티플레이  
**예상 시간:** 3~4시간  
**상태:** 완료

## 오늘의 목표

인증된 플레이어가 비공개 방을 만들고 초대 코드로 참가한다. 다른 브라우저에서도 같은 대기실의 참가자 목록을 확인한다.

## 작업 체크리스트

- [x] 현재 구현 상태와 관련 요구사항 확인
- [x] 입력·출력·예외 조건 정리
- [x] `createRoom`·`joinRoom` Callable Function 및 Firestore 저장 구현
- [x] 참가자 전용 방 읽기 규칙과 클라이언트 직접 쓰기 차단
- [x] 로비의 생성·코드 참가와 대기실 화면 연결
- [x] 에뮬레이터 통합 검증 및 서로 다른 브라우저 확인
- [x] 실행 방법과 다음 작업 범위 기록

## 관련 파일/폴더

`functions/src/rooms.ts`, `functions/src/index.ts`, `firestore.rules`, `apps/web/src/services/rooms.ts`, `apps/web/src/pages/LobbyPage.tsx`, `apps/web/src/pages/RoomPage.tsx`, `apps/web/src/styles.scss`, `apps/web/scripts/verify-rooms.mjs`

## 입력·출력·예외 조건

- `createRoom({ nickname })`: 로그인 필요. 닉네임 앞뒤 공백을 제거해 2~16자로 검사한다. 서버가 겹치지 않는 8자리 초대 코드를 만들고 방장 좌석 0을 저장한다. 응답은 `roomId`, `roomCode`, `seatIndex`이다.
- `joinRoom({ roomCode, nickname })`: 로그인 필요. 코드는 대소문자를 구분하지 않고 앞뒤 공백을 제거한다. 코드가 없는 방, 중복 참가, 진행·종료 중인 방, 4명 정원 초과를 거부한다. 같은 닉네임은 허용한다.
- 두 API는 Firestore 트랜잭션으로 초대 코드 색인, 방, 참가자 문서를 일관되게 갱신한다. 동시 참가에서도 좌석이 중복되거나 정원을 넘지 않는다.
- 방과 참가자 문서는 그 방의 참가자만 읽을 수 있다. 초대 코드 색인은 클라이언트에서 읽을 수 없고, 모든 방 데이터 쓰기는 Callable Function에서만 처리한다.

## 검증 시나리오

| 조건 | 기대 결과 | 결과 |
|---|---|---|
| 인증한 브라우저 A에서 생성 | 코드와 방장 좌석 0 표시 | 통과 |
| 다른 브라우저 B에서 코드 참가 | 좌석 1 배정, 양쪽 대기실에 2명 표시 | 통과 |
| 로그인하지 않은 생성·참가 | `unauthenticated` | 통과 |
| 유효하지 않은 닉네임·코드 | `invalid-argument` | 통과 |
| 모르는 코드 | `not-found` | 통과 |
| 비참가자의 방·명단 읽기, 클라이언트의 직접 쓰기 | `permission-denied` | 통과 |
| 중복 참가·진행 중인 방·정원 초과 | 각각 명시적 오류 | 통과 |
| 마지막 자리 동시 참가 | 한 명만 성공, 총 4명 | 통과 |

## 완료 기준

**다른 브라우저로 방 생성·참가를 검증한다** — 독립 프로필 2개에서 완료.

## 실행 방법

1. `npm run emulators`로 Auth·Firestore·Functions 에뮬레이터를 시작한다.
2. 별도 터미널에서 `npm run dev:emulators`를 실행하고 `/lobby`에 접속한다.
3. 두 브라우저 또는 독립 프로필에서 각각 익명 로그인한다. A에서 닉네임을 입력하고 **새 방 만들기**, B에서 같은 코드로 **방 참가**를 누른다.
4. 자동 검증은 에뮬레이터를 먼저 종료한 뒤 `npm run test:rooms`로 실행한다. 기존 연결 검증은 `npm run test:emulators`이다.

## Firebase Console 설정 순서

로컬 에뮬레이터에서 20일차 기능을 확인할 때는 Firebase Console 설정이나 Blaze 요금제가 필요하지 않다. 실제 Firebase 프로젝트에서 사용하려면 다음 순서로 준비한다.

1. 이미 설정한 **Authentication → 로그인 방법 → 익명**이 활성화되어 있는지 확인한다.
2. **Firestore Database**가 아직 없다면 기본 데이터베이스를 만든다. Standard edition과 프로덕션 모드를 선택한다. 새로 위치를 정한다면 현재 Functions 설정과 같은 서울(`asia-northeast3`)을 사용할 수 있다. 기존 데이터베이스가 있으면 다시 만들 필요는 없다. [Firestore 시작 안내](https://firebase.google.com/docs/firestore/quickstart)
3. 실제 프로젝트에 Cloud Functions를 배포할 때는 **Blaze 요금제**가 필요하다. [Functions 배포 안내](https://firebase.google.com/docs/functions/get-started)
4. 실제 프로젝트에 적용할 때 Functions와 저장소의 Firestore 규칙을 함께 배포한다. 규칙 배포는 Console의 기존 규칙을 덮어쓴다. 20일차 작업에서는 실제 프로젝트에 배포하지 않았다. [규칙 배포 안내](https://firebase.google.com/docs/rules/manage-deploy)

## 작업 기록

- 구현 내용: 서버 발급 초대 코드와 방/참가자 문서, 생성·참가 Callable, 참가자 전용 읽기 규칙, 로비 입력과 대기실 구독을 연결했다.
- 실행한 테스트/결과: `npm run typecheck`, `npm run build`, `npm test`, `node apps/web/scripts/verify-rooms.mjs` 통과. 독립 Edge 프로필 2개에서 생성·참가 후 양쪽에 2명 표시 확인.
- 이슈/의사결정: Firestore 문서를 클라이언트가 직접 생성하지 않도록 서버 트랜잭션만 쓰기를 허용한다. 대기실의 준비·시작 버튼은 21일차에 구현한다.
- 다음 작업에 전달할 사항: 21일차에는 현재 `rooms/{roomId}`와 `players/{uid}`에 준비 상태 갱신, 방장 시작, 시작 조건 검증을 추가한다. 배포 전에는 실제 Firebase 프로젝트에서 Firestore 생성 및 Functions/Rules 배포가 필요하다.

## 참고

- [전체 일정](../README.md)
- [기획 요구사항](../requirements.md)
- [API 계약](../api-contract.md)
- [데이터 모델](../data-model.md)

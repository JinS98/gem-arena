# 20일차 — 방 생성·초대 코드·참가 검증

> **Blaze 없이 사용하는 현재 구현 (2026-10-21):** 아래의 Callable Function 기반 작업 기록은 최초 구현을 설명합니다. 현재 `createRoom`과 `joinRoom`은 웹 Firestore SDK를 사용합니다. 초대 코드가 `rooms/{roomCode}` 문서 ID이며, 참가자는 참가 전 방을 읽지 않고 본인 정보만 추가합니다. `firestore.rules`는 참가자 읽기, 제한된 방 생성·참가 쓰기만 허용합니다. 실제 프로젝트에서는 익명 로그인·Firestore를 준비하고 `firebase deploy --only firestore:rules --project gem-arena`로 규칙을 게시한 다음 `npm run dev`를 실행합니다. 방 생성·참가에 Cloud Functions나 Blaze 요금제는 필요하지 않습니다. `npm run test:rooms`는 Auth·Firestore 에뮬레이터에서 이 경로의 정원·동시 참가·읽기 권한을 확인합니다. 준비·시작 기능은 이후 일차에 이 문서 모델을 기준으로 추가해야 합니다.

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

`firestore.rules`, `apps/web/src/services/rooms.ts`, `apps/web/src/pages/LobbyPage.tsx`, `apps/web/src/pages/RoomPage.tsx`, `apps/web/src/styles.scss`, `apps/web/scripts/verify-client-rooms.mjs`

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
3. 저장소의 `firestore.rules`를 `firebase deploy --only firestore:rules --project gem-arena`로 게시한다. 규칙은 Console의 기존 규칙을 덮어쓴다. 현재 규칙은 `gem-arena` 프로젝트에 게시했다. [규칙 배포 안내](https://firebase.google.com/docs/rules/manage-deploy)
4. `apps/web/.env`에 실제 웹 앱 설정을 넣고 `VITE_USE_FIREBASE_EMULATORS=false`로 지정한 뒤 `npm run dev`를 실행한다. 방 생성·참가에는 Cloud Functions 배포나 Blaze 요금제가 필요하지 않다.

## 작업 기록

- 구현 내용: 최초 Callable 기반 구현을 Firestore 클라이언트 SDK의 방 생성·참가로 교체했다. 방 코드를 문서 ID로 사용하고, 참가자 전용 읽기와 제한된 생성·참가 규칙을 적용했다.
- 실행한 테스트/결과: `npm run typecheck`, `npm run build`, `npm test`, `npm run test:rooms`, `npm run test:emulators` 통과. 규칙의 생성·참가·비회원 거부·정원·동시 참가를 검증했다.
- 이슈/의사결정: 참가 전 방 읽기를 허용하지 않으므로 없는 코드·정원 초과·시작한 방은 통합 안내를 표시한다. 2026-10-21에 실제 `gem-arena` 프로젝트에 Firestore 규칙을 게시했다.
- 다음 작업에 전달할 사항: 21일차의 준비 상태 갱신·방장 시작은 단일 `rooms/{roomCode}` 문서와 별도 보안 규칙에 맞춰 구현해야 한다. 실제 게임 상태 변경·비공개 데이터는 아직 연결되지 않았다.

## 참고

- [전체 일정](../README.md)
- [기획 요구사항](../requirements.md)
- [API 계약](../api-contract.md)
- [데이터 모델](../data-model.md)

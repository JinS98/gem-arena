# 멀티플레이 API 계약 (계획)

> **20일차 현재 구현:** `createRoom`과 `joinRoom`은 Callable이 아니라 웹 Firestore SDK와 보안 규칙을 사용합니다. 초대 코드가 `rooms/{roomCode}` 문서 ID입니다. 방 생성은 로그인 사용자 본인의 초기 정보만 쓰고, 참가 시에는 읽기 없이 본인 정보만 추가합니다. 비참가자는 방을 조회할 수 없어 없는 코드·정원 초과·시작한 방을 `ROOM_UNAVAILABLE`로 안내합니다. 아래의 나머지 Callable API는 추후 설계안입니다.

모든 API는 익명 로그인을 포함한 Firebase 인증을 요구한다. 초대 코드는 서버에서 생성·검증하며, 클라이언트는 Firestore 게임 문서를 직접 수정하지 않는다. 세부 정책은 [요구사항](requirements.md)을 따른다.

| API | 입력 | 성공 출력 | 필수 검증·실패 조건 |
|---|---|---|---|
| `createRoom` | `nickname` | `roomId`, `roomCode`, 방장 자리 | 닉네임 2~16자, 인증, 코드 충돌 시 서버 재시도 |
| `joinRoom` | `roomCode`, `nickname` | `roomId`, 참가 자리 | 인증, 닉네임·코드 유효성, 방 존재·대기 상태·정원·중복 참가 |
| `setReady` | `roomId`, `ready` | 갱신된 준비 상태 | 인증, 방 멤버십, 대기 상태 |
| `startGame` | `roomId` | 게임 시작 상태와 버전 | 인증, 방장, 2~4명 모두 준비, 게임 미시작 |
| `submitAction` | `roomId`, `actionId`, `expectedVersion`, `action` | 적용된 게임 버전·행동 확인 | 인증, 멤버십, 현재 턴, 게임 단계, 액션 규칙, 버전, 멱등성 |
| `leaveRoom` | `roomId` | 대기실 퇴장 또는 진행 중 기권 결과 | 인증, 방 멤버십, 진행 단계별 정책 |

`submitAction`은 같은 `actionId`와 같은 요청 내용의 재전송이면 이전 성공 응답을 반환하고 게임 상태를 다시 변경하지 않는다. 같은 `actionId`를 다른 내용으로 사용하면 `ACTION_ID_REUSED`로 거부한다. 새 `actionId`의 `expectedVersion`이 현재 버전과 다르면 `VERSION_CONFLICT`를 반환한다.

`action`의 세부 유효 조건은 [기본판 규칙 명세](game-rules.md)에 따른다. `DISCARD_GEMS`와 `CHOOSE_NOBLE`은 턴 마무리 단계의 입력이며 새 기본 행동이 아니다. `PASS`는 합법적인 기본 행동이 전혀 없을 때만 허용하는 온라인 안전장치다.

대표 오류: `UNAUTHENTICATED`, `INVALID_NICKNAME`, `INVALID_ROOM_CODE`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_NOT_WAITING`, `NOT_ROOM_MEMBER`, `NOT_HOST`, `NOT_READY`, `NOT_YOUR_TURN`, `INVALID_ACTION`, `VERSION_CONFLICT`, `ACTION_ID_REUSED`, `GAME_FINISHED`. 클라이언트는 오류를 사용자에게 설명하고 서버 상태를 다시 구독한다.

`createRoom`과 `joinRoom`은 20일차에 구현했다. 두 함수는 Firebase Auth 인증을 요구하며 `roomId`, `roomCode`, `seatIndex`를 반환한다. 오류는 Callable `HttpsError`의 `details.reason`에 `UNAUTHENTICATED`, `INVALID_NICKNAME`, `INVALID_ROOM_CODE`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_NOT_WAITING`, `ALREADY_IN_ROOM` 중 해당 값을 담는다. 그 외 함수는 이후 일차의 설계 계약이다.

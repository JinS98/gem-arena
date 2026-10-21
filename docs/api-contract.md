# 멀티플레이 API 계약 (계획)

> **20일차 현재 구현:** `createRoom`과 `joinRoom`은 웹 Firestore SDK와 보안 규칙을 사용합니다. 초대 코드가 `rooms/{roomCode}` 문서 ID입니다. 방 생성은 로그인 사용자 본인의 초기 정보만 쓰고, 참가 시에는 읽기 없이 본인 정보만 추가합니다. 비참가자는 방을 조회할 수 없어 없는 코드·정원 초과·시작한 방을 `ROOM_UNAVAILABLE`로 안내합니다.

> **21일차 구현:** `setReady`와 `startGame`도 웹 Firestore SDK를 사용합니다. 참가자 본인의 준비 전환과 방장만 가능한 시작을 보안 규칙이 검증합니다. `startGame`은 방 상태를 `playing`으로 전환하며 초기 게임 상태 생성은 이후 일차 범위입니다.

> **22~24일차 로컬 구현:** 서버 전용 게임 상태·공개 뷰·개인 예약 뷰를 분리하고, `submitAction` Callable이 인증·멤버십·차례·버전·엔진 규칙을 검사합니다. 24일차에 `actionId` 처리 기록과 동시 요청 충돌 처리를 추가했습니다. 실제 프로젝트에는 초기화 서버와 Callable을 연결·배포하지 않았으므로 아직 멀티 턴을 진행할 수 없습니다.

모든 API는 익명 로그인을 포함한 Firebase 인증을 요구한다. 방 생성·참가·준비·시작은 클라이언트 SDK와 제한된 Firestore 규칙으로 처리한다. 게임 상태 변경은 23일차에 신뢰 서버용 Callable로 로컬 구현했다. 세부 정책은 [요구사항](requirements.md)을 따른다.

| API | 입력 | 성공 출력 | 필수 검증·실패 조건 |
|---|---|---|---|
| `createRoom` | `nickname` | `roomId`, `roomCode`, 방장 자리 | 닉네임 2~16자, 인증, 코드 충돌 시 재요청 |
| `joinRoom` | `roomCode`, `nickname` | `roomId`, 참가 자리 | 인증, 닉네임·코드 유효성, 방 존재·대기 상태·정원·중복 참가 |
| `setReady` | `roomCode`, `ready` | 준비 전환 완료 | 인증, 방 멤버십, 대기 상태, 본인 필드만 변경 |
| `startGame` | `roomCode` | `playing` 상태 전환 완료 | 인증, 방장, 2~4명 모두 준비, 게임 미시작 |
| `submitAction` | `roomId`, `actionId`, `expectedVersion`, `action` | 적용된 게임 버전·행동 확인 | 인증, 멤버십, 현재 턴, 게임 단계, 액션 규칙, 버전, 멱등성 |
| `leaveRoom` | `roomId` | 대기실 퇴장 또는 진행 중 기권 결과 | 인증, 방 멤버십, 진행 단계별 정책 |

`submitAction`은 같은 사용자·방의 `actionId`와 같은 요청 내용의 재전송이면 이전 성공 응답을 반환하고 게임 상태를 다시 변경하지 않는다. 같은 `actionId`를 다른 행동이나 `expectedVersion`과 함께 사용하면 `ACTION_ID_REUSED`로 거부한다. 새 ID의 `expectedVersion`이 현재 버전과 다르면 `VERSION_CONFLICT`를 반환한다. 성공 처리 기록은 서버 전용 `actionReceipts/{uid}/actions/{actionId}`에 보관하며 클라이언트가 읽거나 쓸 수 없다. 실패 요청은 기록하지 않는다.

`action`의 세부 유효 조건은 [기본판 규칙 명세](game-rules.md)에 따른다. `DISCARD_GEMS`와 `CHOOSE_NOBLE`은 턴 마무리 단계의 입력이며 새 기본 행동이 아니다. `PASS`는 합법적인 기본 행동이 전혀 없을 때만 허용하는 온라인 안전장치다.

대표 오류: `UNAUTHENTICATED`, `INVALID_NICKNAME`, `INVALID_ROOM_CODE`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `ROOM_NOT_WAITING`, `NOT_ROOM_MEMBER`, `NOT_HOST`, `NOT_READY`, `NOT_YOUR_TURN`, `INVALID_ACTION`, `VERSION_CONFLICT`, `ACTION_ID_REUSED`, `GAME_FINISHED`. 클라이언트는 오류를 사용자에게 설명하고 서버 상태를 다시 구독한다.

`createRoom`과 `joinRoom`은 20일차, `setReady`와 `startGame`은 21일차에 구현했다. 방 서비스의 사전 검증 오류는 `RoomActionError.details.reason`에 담는다. 실제 쓰기 권한은 Firestore 규칙이 최종 판정하며, 경합으로 조건이 바뀐 경우 `permission-denied`가 발생할 수 있다. `submitAction`은 23일차에 로컬 Callable로 구현했으며, `leaveRoom`은 이후 일차의 설계 계약이다.

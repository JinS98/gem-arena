# Callable API 계약 (계획)

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

**현재 함수는 구현되지 않았으며 위 표는 설계 계약이다.**

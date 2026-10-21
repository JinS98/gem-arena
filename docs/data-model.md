# 데이터 모델

> **현재 방 모델:** `rooms/{roomCode}` 문서에 `roomCode`, `hostUid`, `status`, `capacity`, `playerOrder`, `players`, `createdAt`, `updatedAt`을 저장합니다. `players`는 UID를 키로 하는 맵이며 값은 `uid`, `nickname`, `ready`, `forfeited`, `joinedAt`입니다. 좌석 번호는 `playerOrder` 순서로 계산합니다. 22~25일차의 게임 상태 문서는 아래에 설명합니다.

21일차 시작 전이는 같은 방 문서의 `status`를 `playing`으로 변경하고 `startedAt`을 추가합니다. 본인 준비 상태는 `players.{uid}.ready`에 기록합니다. 로컬 에뮬레이터에서는 25일차 `roomStarted` 트리거가 이 전이 직후 게임 덱과 턴 상태를 생성합니다.

22일차 로컬 구현은 `rooms/{roomCode}/privateState/server`에 전체 덱·모든 예약 정보를, `rooms/{roomCode}/game/publicState`에 덱 장수·공개 시장·점수 등을, `rooms/{roomCode}/privatePlayers/{uid}`에 해당 사용자의 예약 카드 ID만 넣습니다. 공개 문서는 방 참가자만, 개인 문서는 해당 UID의 참가자만 읽고, 서버 문서는 모든 클라이언트가 읽지 못합니다. 세 종류 모두 클라이언트 쓰기를 거부합니다. 신뢰 서버용 `initializeGameViews`가 시작한 방에만 문서를 원자적으로 생성하며, 실제 프로젝트에서 이를 호출할 백엔드는 아직 연결되지 않았습니다.

23~24일차 로컬 `submitAction`은 `privateState/server`를 읽어 인증·턴·행동을 검증하고, 갱신된 서버 상태와 공개·개인 뷰를 한 Firestore 트랜잭션으로 기록합니다. 성공한 행동의 요청과 응답은 `actionReceipts/{uid}/actions/{actionId}`에 같은 트랜잭션으로 기록합니다. 이 문서는 서버 전용이며 클라이언트의 읽기·쓰기를 거부합니다.

25일차 로컬 `roomStarted` 트리거는 방 문서가 `waiting`에서 `playing`으로 바뀔 때 초기 게임 문서를 만듭니다. 웹은 `publicState`와 본인 `privatePlayers/{uid}`를 실시간 구독하고 두 문서의 `version`이 같을 때만 새 상태를 표시합니다. 이전 일치 버전이 있으면 갱신 중에도 이를 유지합니다. 실제 프로젝트에는 트리거와 Callable을 아직 배포하지 않았습니다.

26일차 로컬 `leaveRoom`은 대기 중 퇴장 시 `playerOrder`와 `players`에서 UID를 제거하고 방장을 남은 첫 참가자에게 넘깁니다. 진행 중에는 방의 `players.{uid}.forfeited`와 서버 상태의 `players.{uid}.forfeited`를 함께 설정합니다. 서버 상태에서 보석은 은행으로 반환하고 해당 플레이어의 카드·귀족·예약·점수는 제거합니다. 공개 뷰에는 기권 여부를 표시하고 개인 예약 뷰는 빈 목록으로 갱신합니다. 기권한 UID는 `playerOrder`에 남아 결과를 읽되 턴·승패·패스 종료에서는 제외됩니다. 한 명만 남으면 게임과 방을 `finished`로 표시합니다. `leaveReceipts/{uid}`는 서버 전용 퇴장 결과로, 응답 유실 뒤 같은 UID의 재요청에 원래 결과를 반환합니다.

엔진 타입은 `packages/game-engine/src/types/index.ts` 참고.

## 정적 게임 데이터 (5일차)

`packages/game-engine/src/data/catalog.ts`가 개발 카드 90장(단계별 40/30/20장, 각 보너스 색별 8/6/4장)과 귀족 10명을 제공합니다. 카드 ID는 `L{단계}-{보너스색 대문자}-{색별 번호}`(예: `L1-WHITE-01`), 귀족 ID는 요구 색 세 개를 담은 `N-{색}-{색}-{색}` 형식입니다. ID는 덱·시장·구매/예약 상태에 보관하며 실제 데이터는 `getDevelopmentCard`/`getNoble`로 조회합니다.

카드는 `level`, `bonusColor`, `points`, 일반 보석 5색의 `cost`를 가집니다. 귀족은 `points: 3`과 일반 보석 5색의 `requirements`를 가집니다. 귀족마다 서로 다른 세 색의 영구 할인 3개씩을 요구하며, 나머지 두 색은 0개입니다. 카드 수치는 Gem Arena용 독자 패턴을 보너스 색별로 회전해 생성합니다. `validateCatalog`는 고정 목록의 개수와 색별 분포, 고유 ID, 정수·음수·누락/여분 필드, 귀족 요구량을 확인합니다. 반환값이 빈 배열이면 유효합니다. 6일차 초기화에서 이 ID 목록을 셔플해 사용합니다.

## 초기 서버 게임 상태 (6일차)

`createInitialGameState(playerIds, seed)`는 참가 순서로 나열한 서로 다른 2~4명의 UID와 `0`~`4294967295`의 정수 시드를 받습니다. 잘못된 인원·ID·시드는 `RangeError`로 거부합니다. 반환 상태는 `phase: 'playing'`, `version: 0`, 참가 순서의 `playerOrder`와 `seatIndex`, 모두 0인 플레이어 보석·점수·카드 목록으로 시작합니다. 첫 턴의 `turnIndex`는 시드 기반으로 선택하고 `firstPlayerIndex`에 보존합니다.

일반 보석 은행은 2/3/4명일 때 색마다 4/5/7개이며 황금 보석은 5개입니다. 단계별 40/30/20장 카드 ID를 각각 셔플해 4장씩 시장에 놓고 나머지 36/26/16장을 서버 전용 덱에 둡니다. 귀족 10명 중 인원보다 1명 많은 3/4/5명을 공개합니다. 같은 참가 순서와 시드는 같은 결과를 만들며 원본 카드 목록은 변경하지 않습니다. 호출자는 시드를 서버에서 생성하고 재현이 필요하면 서버 전용으로 보관합니다. `ServerGameState.decks`를 공개 상태로 보내서는 안 됩니다.

## 카드 구매 상태 변경 (9일차)

`buyCard(state, playerId, action)`는 현재 턴의 플레이어가 시장 카드 또는 자신의 예약 카드를 결제한 후 새 `ServerGameState`를 반환합니다. 할인은 구매 전 `purchasedCardIds`에서 계산합니다. 결제 보석은 은행으로 돌아가고 카드 ID와 점수가 플레이어에게 더해집니다. 시장에서 구매하면 해당 단계 `decks[level][0]`으로 **같은 시장 칸**을 보충하고 덱이 비었으면 그 칸을 `null`로 둡니다. 예약 카드 구매는 예약 목록에서만 카드를 제거하며 시장·덱에 손대지 않습니다. 이 함수는 턴과 버전을 변경하지 않으며, 후속 reducer가 턴 종료·귀족 방문·버전을 처리합니다.

## 카드 예약 상태 변경 (10일차)

`reserveCard(state, playerId, action)`은 현재 플레이어가 시장의 카드 ID 또는 비공개 덱 단계를 지정해 예약한 새 서버 상태와 초과 보석 수를 반환합니다. 공개 카드 예약은 해당 시장 칸을 같은 단계 덱 맨 앞 카드로 보충하고, 비공개 덱 예약은 맨 앞 카드를 예약자 목록으로 옮기며 시장을 바꾸지 않습니다. 예약 카드는 최대 3장입니다. 은행의 황금이 있으면 한 개를 받고 없으면 카드만 예약합니다. 10개 한도 초과 시 `excess`를 후속 `discarding` 단계에 연결합니다.

`ServerGameState`는 모든 플레이어의 예약 ID와 비공개 덱을 포함하는 **서버 전용 상태**입니다. 덱 예약 ID는 해당 플레이어의 `reservedCardIds`에만 추가하지만 전체 상태를 클라이언트로 보내면 비밀이 노출됩니다. 공개·개인 뷰가 별도로 있어도 이 객체는 클라이언트에 전송하지 않습니다.

## 귀족 방문 상태 (11일차)

플레이어의 `nobleIds`는 방문 완료된 귀족 ID를 담고, `score`에는 카드 점수와 귀족 점수가 함께 누적됩니다. `ServerGameState.turnNobleResolved`는 현재 턴의 귀족 판정 완료 여부이며 시작 시 `false`입니다. 기본 행동과 필요한 보석 반환 이후 `resolveNobleVisit`을 호출합니다. 자격자가 없으면 완료 표시만, 한 명이면 즉시 방문과 3점 추가를, 여러 명이면 `phase: 'choosingNoble'`을 반환합니다. 여러 명 중 하나를 `chooseNoble`로 고른 뒤 완료 표시하고 `playing`으로 되돌립니다. `completeTurn`이 다음 턴을 시작할 때 이 값을 `false`로 재설정합니다.

## 최종 라운드와 승자 상태 (12일차)

`firstPlayerIndex`는 초기 무작위 첫 플레이어의 고정 좌석 번호입니다. `turnIndex`는 매 턴 이동합니다. 한 라운드의 마지막 좌석은 `(firstPlayerIndex + playerOrder.length - 1) % playerOrder.length`로 계산합니다. 이 기준이 있어야 첫 플레이어가 참가 순서의 0번이 아니어도 모든 플레이어의 턴 수가 같습니다.

`completeTurn`은 `phase: 'playing'`이고 현재 플레이어의 `turnNobleResolved`가 `true`일 때만 실행합니다. 현재 점수가 15점 이상이면 `finalRoundTriggeredBy`에 최초 도달 플레이어를 기록하고, 라운드 마지막 좌석의 턴이 끝나면 `phase: 'finished'`와 `winnerIds`를 설정합니다. 다음 턴으로 진행하면 `turnNobleResolved`를 `false`로 초기화합니다. 종료 상태의 `turnIndex`는 마지막 턴 플레이어를 가리키며 `version`은 reducer가 갱신합니다. `determineWinnerIds`는 점수 우선, 구매 카드 수가 적은 순으로 공동 승리까지 판정합니다. 기권자 제외는 기권 상태를 추가하는 26일차 작업에서 연결합니다.

## 상태 전이 reducer (13일차)

`reduceGameAction(state, playerId, action)`은 현재 턴 플레이어의 행동 하나를 검증해 새 `ServerGameState`를 반환합니다. `playing`에서는 보석 획득·카드 구매·예약·조건부 패스를, `discarding`에서는 초과 보석 반환만, `choosingNoble`에서는 귀족 선택만 허용합니다. 기본 행동 후 보석이 10개를 넘으면 반환을 기다리고, 그렇지 않으면 귀족 방문과 턴 완료까지 처리합니다. 정상 행동마다 `version`을 정확히 1 증가시키며 거부된 행동은 입력 상태를 변경하지 않습니다.

`consecutivePasses`는 자산·점수 변화가 없는 연속 패스 수입니다. 합법적인 기본 행동이 생기면 패스를 거부하고, 기본 행동이나 패스로 인한 귀족 방문은 연속 패스를 끊습니다. 참가자 모두 연속 패스하면 현재 점수와 동점 규칙으로 종료합니다. 이 값은 초기 상태에서 0이며 기권자가 생기면 활성 인원 기준으로 조정해야 합니다. API의 인증·버전 충돌·`actionId` 멱등성은 서버 구현에서 처리합니다.

```text
rooms/{roomCode}                                      방 상태·멤버십·플레이어 맵
rooms/{roomCode}/game/publicState                     공개 시장·턴·점수
rooms/{roomCode}/privateState/server                  서버 전용 덱·전체 게임 상태
rooms/{roomCode}/privatePlayers/{uid}                 해당 플레이어의 비공개 예약 카드
rooms/{roomCode}/actionReceipts/{uid}/actions/{actionId} 멱등성 처리 기록
```

현재 클라이언트는 참가자인 경우 방과 공개 게임 문서를 읽고, 자신의 `privatePlayers/{uid}`만 읽을 수 있습니다. `privateState/server`와 `actionReceipts`는 클라이언트의 읽기·쓰기를 모두 거부합니다. 서버 Admin SDK는 Security Rules를 우회하므로 인증·인가를 함수에서 검증합니다.

20~21일차 구현에서 방 문서는 `roomCode`, `hostUid`, `status`, `playerOrder`, `capacity`, `createdAt`, `updatedAt`과 UID별 `players` 맵을 저장합니다. 플레이어 맵에는 `uid`, `nickname`, `ready`, `forfeited`, `joinedAt`이 있습니다. 좌석은 `playerOrder` 순서로 계산합니다. 준비·시작 전이는 방 문서에서 검증합니다.

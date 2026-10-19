# 데이터 모델

엔진 타입은 `packages/game-engine/src/types/index.ts` 참고.

## 정적 게임 데이터 (5일차)

`packages/game-engine/src/data/catalog.ts`가 개발 카드 90장(단계별 40/30/20장, 각 보너스 색별 8/6/4장)과 귀족 10명을 제공합니다. 카드 ID는 `L{단계}-{보너스색 대문자}-{색별 번호}`(예: `L1-WHITE-01`), 귀족 ID는 요구 색 세 개를 담은 `N-{색}-{색}-{색}` 형식입니다. ID는 덱·시장·구매/예약 상태에 보관하며 실제 데이터는 `getDevelopmentCard`/`getNoble`로 조회합니다.

카드는 `level`, `bonusColor`, `points`, 일반 보석 5색의 `cost`를 가집니다. 귀족은 `points: 3`과 일반 보석 5색의 `requirements`를 가집니다. 귀족마다 서로 다른 세 색의 영구 할인 3개씩을 요구하며, 나머지 두 색은 0개입니다. 카드 수치는 Gem Arena용 독자 패턴을 보너스 색별로 회전해 생성합니다. `validateCatalog`는 고정 목록의 개수와 색별 분포, 고유 ID, 정수·음수·누락/여분 필드, 귀족 요구량을 확인합니다. 반환값이 빈 배열이면 유효합니다. 6일차 초기화에서 이 ID 목록을 셔플해 사용합니다.

## 초기 서버 게임 상태 (6일차)

`createInitialGameState(playerIds, seed)`는 참가 순서로 나열한 서로 다른 2~4명의 UID와 `0`~`4294967295`의 정수 시드를 받습니다. 잘못된 인원·ID·시드는 `RangeError`로 거부합니다. 반환 상태는 `phase: 'playing'`, `version: 0`, 참가 순서의 `playerOrder`와 `seatIndex`, 모두 0인 플레이어 보석·점수·카드 목록으로 시작합니다. 첫 턴의 `turnIndex`는 시드 기반으로 선택합니다.

일반 보석 은행은 2/3/4명일 때 색마다 4/5/7개이며 황금 보석은 5개입니다. 단계별 40/30/20장 카드 ID를 각각 셔플해 4장씩 시장에 놓고 나머지 36/26/16장을 서버 전용 덱에 둡니다. 귀족 10명 중 인원보다 1명 많은 3/4/5명을 공개합니다. 같은 참가 순서와 시드는 같은 결과를 만들며 원본 카드 목록은 변경하지 않습니다. 호출자는 시드를 서버에서 생성하고 재현이 필요하면 서버 전용으로 보관합니다. `ServerGameState.decks`를 공개 상태로 보내서는 안 됩니다.

```text
rooms/{roomId}                      방 상태·멤버십
rooms/{roomId}/players/{uid}        공개 프로필·준비 상태
rooms/{roomId}/game/publicState     공개 시장·턴·점수
rooms/{roomId}/privateState/server  서버 전용 덱·전체 게임 상태
rooms/{roomId}/privatePlayers/{uid} 개인 비공개 예약 카드
rooms/{roomId}/actions/{actionId}   멱등성 기록
```

클라이언트는 `privateState/server` 읽기 불가. `privatePlayers/{uid}`는 해당 uid만 읽기 가능. 서버 Admin SDK는 Security Rules를 우회하므로 인증·인가를 함수에서 검증합니다.

1일차 요구사항에 따라 방에는 방장 UID·단계(대기/진행/종료)·참가 순서가 필요합니다. 플레이어에는 준비 상태와 기권 상태가 필요합니다. 실제 필드와 전이 로직은 구현 일차에 정의하며, 위 경로만으로 권한이 보장되는 것은 아닙니다.

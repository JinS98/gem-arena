# 데이터 모델

엔진 타입은 `packages/game-engine/src/types/index.ts` 참고.

## 정적 게임 데이터 (5일차)

`packages/game-engine/src/data/catalog.ts`가 개발 카드 90장(단계별 40/30/20장, 각 보너스 색별 8/6/4장)과 귀족 10명을 제공합니다. 카드 ID는 `L{단계}-{보너스색 대문자}-{색별 번호}`(예: `L1-WHITE-01`), 귀족 ID는 요구 색 세 개를 담은 `N-{색}-{색}-{색}` 형식입니다. ID는 덱·시장·구매/예약 상태에 보관하며 실제 데이터는 `getDevelopmentCard`/`getNoble`로 조회합니다.

카드는 `level`, `bonusColor`, `points`, 일반 보석 5색의 `cost`를 가집니다. 귀족은 `points: 3`과 일반 보석 5색의 `requirements`를 가집니다. 귀족마다 서로 다른 세 색의 영구 할인 3개씩을 요구하며, 나머지 두 색은 0개입니다. 카드 수치는 Gem Arena용 독자 패턴을 보너스 색별로 회전해 생성합니다. `validateCatalog`는 고정 목록의 개수와 색별 분포, 고유 ID, 정수·음수·누락/여분 필드, 귀족 요구량을 확인합니다. 반환값이 빈 배열이면 유효합니다. 6일차 초기화에서 이 ID 목록을 셔플해 사용합니다.

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

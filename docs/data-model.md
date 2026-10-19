# 데이터 모델

엔진 타입은 `packages/game-engine/src/types/index.ts` 참고.

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

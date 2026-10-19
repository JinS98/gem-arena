# 아키텍처

```text
React + Zustand(UI) → Callable Functions(검증) → game-engine(순수 규칙)
          ↑                         ↓
     Firestore onSnapshot ← Transaction(서버 확정 상태)
```

- `apps/web`: 화면과 입력, 서버 상태 구독. 서버 게임 상태를 직접 수정하지 않음.
- `packages/game-engine`: Firebase/React와 독립적인 순수 규칙과 상태 전이.
- `functions`: 인증, 멤버십, 현재 턴, 게임 버전, 멱등성 검증.
- Firestore: 공개 게임 상태/서버 전용 상태/플레이어별 비공개 예약 분리.
- 동일 actionId 재전송과 expectedVersion 충돌을 트랜잭션으로 처리.

## 1일차 운영 결정

- 대기 중 퇴장하면 멤버십을 제거한다. 방장 퇴장 시 가장 먼저 참가한 남은 플레이어에게 방장을 넘긴다.
- 연결 끊김은 퇴장으로 취급하지 않는다. 같은 익명 UID의 재접속을 기다리며 자동 기권·턴 타이머는 두지 않는다.
- 진행 중 명시적 `leaveRoom`은 기권으로 처리한다. 보유 보석은 은행으로 돌려주고 카드·귀족·예약 카드는 게임에서 제외하며, 이후 턴에서 제외한다. 활성 플레이어가 한 명만 남으면 그 플레이어의 승리로 종료한다.
- 익명 UID를 잃으면 기존 자리를 복구하지 않는다. 새 UID의 진행 중 게임 참가도 허용하지 않는다. 이 경우 게임이 정체될 수 있으며 MVP의 알려진 한계다.
- 이 정책의 사용자 흐름·성공 기준은 [요구사항](requirements.md), API 입력·출력·실패 조건은 [Callable API 계약](api-contract.md)에 기록한다.

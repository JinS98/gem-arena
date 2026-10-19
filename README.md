# 💎 Gem Arena

스플렌더 스타일의 **2~4인 온라인 턴제 전략 게임**을 위한 개발 초기 프로젝트입니다.

> 현재 상태: **프로젝트 뼈대 + 화면 미리보기 + 엔진 도메인 타입·카드/귀족 데이터·초기화·보석/결제 규칙**. 온라인 게임/서버 API는 아직 구현되지 않았습니다.

## 빠른 시작

- Node.js 22 권장 (Corepack으로 pnpm 9.15.9 사용)
- `corepack pnpm install`
- `npm run dev` → Vite 개발 서버
- `npm test` → 게임 엔진의 초기 테스트
- `npm run build` → 엔진과 웹 빌드
- `npm run typecheck` → 엔진을 빌드한 뒤 전체 워크스페이스 타입 검사
- 실제 Firebase 프로젝트를 연결할 때만 `.env.example`을 `apps/web/.env`로 복사하고 콘솔 값을 입력

의존성 설치는 저장소의 `pnpm-lock.yaml`을 사용하는 `corepack pnpm install`로 진행합니다. `npm run dev`와 `npm run typecheck`는 웹에서 엔진 타입을 가져올 수 있도록 엔진 패키지를 먼저 빌드합니다.

## 워크스페이스

| 경로 | 역할 |
|---|---|
| `apps/web` | React/Vite 화면과 UI 상태 |
| `packages/game-engine` | 공유 게임 타입과 순수 규칙 |
| `functions` | 이후 구현할 Firebase 서버 함수 |

엔진은 독자 수치의 개발 카드 90장(1/2/3단계 40/30/20장)과 귀족 10명을 고정 ID로 제공합니다. `DEVELOPMENT_CARDS`, `NOBLES`를 초기 덱 구성에 사용하고 `getDevelopmentCard(id)`, `getNoble(id)`로 조회합니다. `validateCatalog(cards, nobles)`는 개수·단계/색 분포·ID 중복·점수·비용/요구량을 검사하고 오류 경로를 반환합니다. 카드 비용과 귀족 조건에는 일반 보석 5색만 들어가며 황금 보석은 포함되지 않습니다.

`createInitialGameState(playerIds, seed)`는 참가 순서대로 2~4명의 ID와 32비트 정수 시드를 받아 인원별 은행, 단계별 카드 덱·공개 시장, 귀족, 무작위 첫 턴을 만듭니다. 같은 입력과 시드면 결과가 같습니다. 호출 서버가 예측하기 어려운 시드를 생성하고 필요하면 서버 전용으로 보관해야 합니다. 반환값에는 비공개 덱 순서가 들어 있으므로 클라이언트에 그대로 전송하지 않습니다.

보석 규칙은 `canTakeGems`, `takeGems`, `excessGemCount`, `discardExcessGems`로 제공합니다. 획득·반환 함수는 원본 은행과 보유량을 바꾸지 않고 새 수량을 반환하며, 불법 조합이나 초과분과 다른 반환량은 `RangeError`로 거부합니다. `takeGems`의 `excess`가 0보다 크면 이후 상태 전이에서 `discarding` 단계로 연결해야 합니다.

구매 결제는 `countCardBonuses(purchasedCardIds)`, `remainingCardCost(cost, bonuses)`, `canPayForCard(cost, bonuses, held, payment)`, `payForCard(bank, held, cost, bonuses, payment)`로 계산합니다. 황금 보석은 남은 모든 색의 비용을 대신할 수 있으며 제출한 일반·황금 보석은 정확히 남은 비용과 일치해야 합니다. `payForCard`는 보석 이동만 처리합니다.

`buyCard(state, playerId, action)`는 현재 플레이어의 시장 또는 본인 예약 카드 구매에 결제 규칙을 적용하고, 카드 소유·점수·시장·덱을 함께 갱신합니다. 시장 구매 시 해당 단계 덱 맨 앞 카드로 같은 칸을 보충하며 덱이 비면 `null`로 유지합니다. 이 순수 함수는 턴·버전을 진행하지 않습니다. 턴 종료와 멱등성 처리는 후속 reducer·서버 작업에서 연결합니다.

`reserveCard(state, playerId, action)`는 공개 카드 ID 또는 비공개 덱 단계 중 하나를 예약합니다. 최대 3장까지 보관하고 은행에 황금이 있으면 1개를 받습니다. 반환값의 `excess`가 양수면 후속 reducer가 `discarding`으로 연결해야 합니다. 반환된 전체 상태에는 비공개 덱과 예약 카드 ID가 있으므로 클라이언트에 그대로 전송하지 않습니다. 공개/개인 상태 분리는 22일차에 연결합니다.

귀족 방문은 `eligibleNobleIds`, `resolveNobleVisit`, `chooseNoble`로 처리합니다. 구매 카드의 영구 할인만 조건에 포함하며, 턴 마무리 시 한 명만 자격이 있으면 자동 방문하고 여러 명이면 `choosingNoble`에서 한 명을 고릅니다. `turnNobleResolved`는 같은 턴의 중복 방문을 막으며 다음 턴 시작 시 reducer가 초기화해야 합니다.

## Firebase 로컬 에뮬레이터

실제 Firebase 프로젝트나 로그인 없이 `demo-gem-arena` 프로젝트 ID로 Auth·Firestore·Functions를 실행합니다. Firebase CLI는 프로젝트 개발 의존성에 포함되어 있습니다. Firestore 에뮬레이터에는 Java JDK 11 이상이 필요합니다(현재 검증 환경은 JDK 21). JDK를 새로 설치했다면 터미널을 다시 열어 `java -version`을 확인하세요.

1. 터미널 하나에서 `npm run emulators` 실행
2. 다른 터미널에서 `npm run dev:emulators` 실행
3. 자동 검증은 에뮬레이터를 종료한 상태에서 `npm run test:emulators` 실행

웹의 에뮬레이터 모드는 `apps/web/.env.emulator`의 데모 설정을 사용합니다. 현재 Firestore 규칙은 모든 클라이언트 읽기·쓰기를 거부합니다. `emulatorHealth`는 로그인한 호출자에게만 응답하는 읽기 전용 연결 확인 함수입니다. 게임 API와 로그인 화면은 이후 일차에 구현합니다.

## 문서

- [`docs/README.md`](docs/README.md): 문서 인덱스와 31일차 진행표
- `docs/daily/day-01.md` ~ `day-31.md`: **각 일차별 목표·작업 체크리스트·파일 위치·테스트·완료 기준**
- [`docs/requirements.md`](docs/requirements.md): 1일차 확정 MVP 범위·사용자 흐름·운영 정책
- `docs/architecture.md`, `game-rules.md`, `data-model.md`, `api-contract.md`: 설계 참고

## 원칙

1. 게임 상태 변경 권한은 Cloud Functions 서버에만 둡니다.
2. 공개 문서와 비공개 카드/덱을 분리합니다.
3. UI 상태(Zustand)와 서버 확정 상태(Firestore)를 혼동하지 않습니다.
4. 공개 배포 시 원작 명칭·이미지·카드 데이터의 권리를 확인하고 독자 자산을 사용합니다.

[노션 기획서](https://app.notion.com/p/3fec883fa20281a9b445eac2b9e1ea5b)

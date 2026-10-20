# 💎 Gem Arena

스플렌더 스타일의 **2~4인 온라인 턴제 전략 게임**을 위한 개발 초기 프로젝트입니다.

> 현재 상태: **로컬 2~4인 한 판 플레이 + 3인 상황별 연습 화면 + 게임 엔진 + 멀티플레이 입장 준비**. 온라인 방 생성과 게임 서버 API는 아직 구현되지 않았습니다.

## 빠른 시작

- Node.js 22 권장 (Corepack으로 pnpm 9.15.9 사용)
- `corepack pnpm install`
- `npm run dev` → Vite 개발 서버
- `npm test` → 게임 엔진 및 닉네임 검증 테스트
- `npm run build` → 엔진과 웹 빌드
- `npm run typecheck` → 엔진을 빌드한 뒤 전체 워크스페이스 타입 검사
- 실제 Firebase 프로젝트를 연결할 때만 `.env.example`을 `apps/web/.env`로 복사하고 콘솔 값을 입력

의존성 설치는 저장소의 `pnpm-lock.yaml`을 사용하는 `corepack pnpm install`로 진행합니다. `npm run dev`와 `npm run typecheck`는 웹에서 엔진 타입을 가져올 수 있도록 엔진 패키지를 먼저 빌드합니다.

`npm run dev` 실행 후 브라우저에서 `http://localhost:5173/game/demo`를 여세요. `인원`에서 2~4명을 고르고 `새 로컬 게임`을 누르면 시작 안내 모달이 열립니다. `게임 시작하기`를 누른 순간 첫 플레이어의 3분이 시작되며, 한 기기에서 번갈아 플레이할 수 있습니다. 보석 획득·반환, 시장 또는 예약 카드 구매, 시장 카드와 단계별 비공개 덱 카드 예약, 귀족 선택을 진행합니다. 행동과 획득 효과가 끝나면 다음 턴으로 자동 전환됩니다. 30초가 남으면 알림이 울리고, 시간이 끝나면 필요한 반환·귀족 선택을 처리한 뒤 다음 턴으로 넘어갑니다. 가능한 기본 행동이 없을 때만 패스할 수 있습니다. 15점에 도달한 라운드의 마지막 턴이 끝나면 결과가 표시됩니다. `같은 인원으로 새 게임`은 덱과 첫 플레이어를 새로 섞고 시작 안내를 다시 엽니다.

첫 화면은 기존의 7점 3인 연습 상황입니다. `귀족·종료 상황`에서 1단계 빨간 카드 구매 → 귀족 선택 → 15점 종료를 빠르게 확인할 수 있고, `9개 보유 상황`, `최종 턴 상황`도 제공합니다. 로컬 게임에서는 `샘플로 돌아가기`로 이 화면을 다시 엽니다. 로컬 게임 상태는 브라우저 메모리에만 있으며 새로고침하면 초기 연습 상황으로 돌아갑니다. 이 경로의 전체 덱과 플레이어 상태는 로컬 전용입니다. 실제 방의 비공개 덱·예약 카드 분리는 후속 일차에 연결합니다.

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

`buyCard(state, playerId, action)`는 현재 플레이어의 시장 또는 본인 예약 카드 구매에 결제 규칙을 적용하고, 카드 소유·점수·시장·덱을 함께 갱신합니다. 시장 구매 시 해당 단계 덱 맨 앞 카드로 같은 칸을 보충하며 덱이 비면 `null`로 유지합니다. 이 순수 함수는 턴·버전을 진행하지 않습니다.

`reserveCard(state, playerId, action)`는 공개 카드 ID 또는 비공개 덱 단계 중 하나를 예약합니다. 최대 3장까지 보관하고 은행에 황금이 있으면 1개를 받습니다. 반환값의 `excess`가 양수면 reducer가 `discarding`으로 연결합니다. 반환된 전체 상태에는 비공개 덱과 예약 카드 ID가 있으므로 클라이언트에 그대로 전송하지 않습니다. 공개/개인 상태 분리는 22일차에 연결합니다.

귀족 방문은 `eligibleNobleIds`, `resolveNobleVisit`, `chooseNoble`로 처리합니다. 구매 카드의 영구 할인만 조건에 포함하며, 턴 마무리 시 한 명만 자격이 있으면 자동 방문하고 여러 명이면 `choosingNoble`에서 한 명을 고릅니다. `turnNobleResolved`는 같은 턴의 중복 방문을 막습니다.

`completeTurn(state, playerId)`는 귀족 판정이 완료된 턴의 점수를 확인하고 다음 턴으로 넘깁니다. 15점 이상이면 `firstPlayerIndex`를 기준으로 현재 라운드의 남은 턴을 마친 뒤 종료합니다. `determineWinnerIds(state)`는 최고 점수, 그다음 구매 카드 수가 적은 순으로 승자를 정하며 둘 다 같으면 공동 승자를 반환합니다. 두 함수는 원본 상태를 변경하지 않고 `version`도 올리지 않습니다.

`reduceGameAction(state, playerId, action)`은 기본 행동 하나와 필요한 보석 반환·귀족 선택을 단계에 따라 처리합니다. 유효한 요청마다 `version`을 한 번 올리며, 보석·카드·점수·원본 객체를 변경하지 않는 순수 상태 전이를 반환합니다. 합법적인 기본 행동이 전혀 없을 때만 `PASS`를 허용하고 전원이 자산·점수 변화 없이 연속 패스하면 종료합니다. 인증, `expectedVersion`, `actionId` 중복 처리는 서버 API 단계에서 검증합니다.

## Firebase 로컬 에뮬레이터

실제 Firebase 프로젝트나 로그인 없이 `demo-gem-arena` 프로젝트 ID로 Auth·Firestore·Functions를 실행합니다. Firebase CLI는 프로젝트 개발 의존성에 포함되어 있습니다. Firestore 에뮬레이터에는 Java JDK 11 이상이 필요합니다(현재 검증 환경은 JDK 21). JDK를 새로 설치했다면 터미널을 다시 열어 `java -version`을 확인하세요.

1. 터미널 하나에서 `npm run emulators` 실행
2. 다른 터미널에서 `npm run dev:emulators` 실행
3. 자동 검증은 에뮬레이터를 종료한 상태에서 `npm run test:emulators` 실행

웹의 에뮬레이터 모드는 `apps/web/.env.emulator`의 데모 설정을 사용합니다. `http://localhost:5173/lobby`에서 익명 로그인과 닉네임 입력을 확인할 수 있습니다. 로그인 복원을 기다린 다음 필요할 때만 새 UID를 만들며, 닉네임은 Firebase Auth 프로필에 기본값으로 저장합니다. 같은 브라우저에서 새로고침하면 UID와 닉네임이 돌아옵니다. 브라우저 데이터를 지우거나 에뮬레이터를 재시작하면 기존 익명 계정을 복구할 수 없습니다. 실제 프로젝트에서는 Firebase Console에서 **Authentication → 로그인 방법 → 익명**을 활성화하고 `apps/web/.env`에 프로젝트 설정을 넣어야 합니다. 방마다 확정되는 닉네임은 20일차 `createRoom`/`joinRoom`에 전달하며, 입장 화면의 기본값은 방별 닉네임을 대신하지 않습니다.

현재 Firestore 규칙은 방 참가자에게 해당 방과 참가자 목록 읽기만 허용합니다. 초대 코드 색인 읽기와 모든 클라이언트 쓰기는 거부하며, 방 생성·참가는 `createRoom`/`joinRoom` Callable Function이 처리합니다.

## 문서

- [`docs/README.md`](docs/README.md): 문서 인덱스와 31일차 진행표
- [`docs/local-board-improvements.md`](docs/local-board-improvements.md): 일차 일정과 별도로 진행한 로컬 게임판 UI·턴 흐름 개선 기록
- `docs/daily/day-01.md` ~ `day-31.md`: **각 일차별 목표·작업 체크리스트·파일 위치·테스트·완료 기준**
- [`docs/requirements.md`](docs/requirements.md): 1일차 확정 MVP 범위·사용자 흐름·운영 정책
- `docs/architecture.md`, `game-rules.md`, `data-model.md`, `api-contract.md`: 설계 참고

## 원칙

1. 게임 상태 변경 권한은 Cloud Functions 서버에만 둡니다.
2. 공개 문서와 비공개 카드/덱을 분리합니다.
3. UI 상태(Zustand)와 서버 확정 상태(Firestore)를 혼동하지 않습니다.
4. 공개 배포 시 원작 명칭·이미지·카드 데이터의 권리를 확인하고 독자 자산을 사용합니다.

[노션 기획서](https://app.notion.com/p/3fec883fa20281a9b445eac2b9e1ea5b)

## 비공개 방 생성·참가 (20일차)

에뮬레이터에서 확인할 때는 Firebase Console 설정이 필요하지 않습니다. `npm run emulators`와 `npm run dev:emulators`를 각각 실행한 뒤, 서로 다른 브라우저 프로필의 `/lobby`에서 방 생성과 코드 참가를 확인하세요. 개발 서버가 5173 대신 다른 포트를 표시하면 그 주소를 사용합니다. `npm run test:rooms`는 에뮬레이터를 종료한 상태에서 실행합니다.

실제 Firebase 프로젝트에서 이 기능을 사용하려면 다음 순서로 준비합니다.

1. Firebase Console → **Authentication → 로그인 방법**에서 **익명** 로그인이 활성화되어 있는지 확인합니다.
2. **빌드 → Firestore Database → 데이터베이스 만들기**에서 기본 데이터베이스를 만듭니다. 처음 생성한다면 Standard edition, 프로덕션 모드를 선택하고 데이터 위치를 결정합니다. 현재 Functions 리전은 서울(`asia-northeast3`)입니다. 기존 데이터베이스가 있다면 다시 만들지 않습니다.
3. Cloud Functions 배포에는 Firebase **Blaze 요금제**가 필요합니다. Firebase Console의 요금제에서 확인합니다.
4. 로컬에서 `npm run build` 후 `firebase deploy --only functions,firestore:rules --project <PROJECT_ID>`로 Functions와 저장소의 `firestore.rules`를 함께 배포합니다. 실제 배포는 별도 요청 시 진행합니다. 배포한 규칙은 Console에서 직접 편집한 규칙을 덮어씁니다.

참고: [Firestore 시작하기](https://firebase.google.com/docs/firestore/quickstart), [Functions 배포와 요금제](https://firebase.google.com/docs/functions/get-started), [규칙 배포](https://firebase.google.com/docs/rules/manage-deploy).

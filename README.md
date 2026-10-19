# 💎 Gem Arena

스플렌더 스타일의 **2~4인 온라인 턴제 전략 게임**을 위한 개발 초기 프로젝트입니다.

> 현재 상태: **프로젝트 뼈대 + 화면 미리보기 + 엔진 타입/보석 규칙 예시**. 온라인 게임/카드 전체 데이터/서버 API는 아직 구현되지 않았습니다.

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

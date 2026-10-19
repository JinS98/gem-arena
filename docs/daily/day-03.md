# 3일차 — pnpm 모노레포·React/Vite·TypeScript 세팅

**단계:** 기획·기반  
**예상 시간:** 3~4시간  
**상태:** 완료

## 오늘의 목표
pnpm 모노레포·React/Vite·TypeScript 세팅 작업을 완료하고 다음 일차에서 재사용 가능한 결과물을 만든다.

## 작업 체크리스트
- [x] 현재 구현 상태와 관련 요구사항 확인
- [x] 입력·출력·예외 조건 정리
- [x] **pnpm 모노레포·React/Vite·TypeScript 세팅** 구현 또는 문서화
- [x] 관련 단위/통합/수동 테스트 작성 및 실행
- [x] 실패 사례와 남은 작업 기록
- [x] README 또는 설계 문서에 결정 사항 반영

## 관련 파일/폴더
`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/web/`, `packages/game-engine/`, `functions/`, `firebase.json`

## 검증 시나리오
| 입력·조건 | 기대 출력 | 실행 결과 |
|---|---|---|
| 저장소 루트에서 `corepack pnpm install --frozen-lockfile` | 4개 워크스페이스의 의존성 설치·잠금 파일 일치 | 통과 |
| 웹 UI 상태 모듈에서 `@gem-arena/engine`의 `DevelopmentCard` 타입 import | 엔진 선언 파일을 정상 해석 | `npm run typecheck` 통과 |
| `npm run build` | 엔진 선언/JS와 웹 정적 파일 생성 | 통과 |
| `npm test` | 기존 엔진 규칙 회귀 테스트 통과 | 7개 통과 |
| `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort` 후 `/` 요청 | Vite 서버 시작, HTTP 200 | 통과; 검증 후 서버 종료 |

## 완료 기준
**웹 앱에서 엔진 타입을 정상 import한다**

## 구성과 예외 조건

- Node.js 22, Corepack, pnpm 9.15.9와 저장소 루트의 설치 명령이 개발 입력 조건이다. `npm install`은 이 pnpm 워크스페이스의 설치 절차로 사용하지 않는다.
- 엔진 패키지의 타입 진입점은 `dist/index.d.ts`다. 깨끗한 설치 상태에서는 이 파일이 없으므로 루트 `dev`·`typecheck`·`build` 스크립트가 엔진을 먼저 빌드한다.
- 웹 앱은 `DevelopmentCard['id']`를 UI 전용 선택 상태의 타입으로 사용한다. 타입만 가져오므로 서버 게임 상태를 브라우저에서 직접 수정하지 않는다.
- Firebase 환경 변수와 에뮬레이터 연결은 미리보기 실행의 전제 조건이 아니다. 인증·Firestore·Functions의 실제 연결 검증은 4일차 이후에 진행한다.
- `vite` 개발 서버는 실행 시작 시 엔진을 빌드한다. 실행 중 엔진 소스 변경까지 자동 재빌드하지는 않으므로 해당 변경 뒤에는 개발 서버를 다시 시작한다.

## 작업 기록
- 구현 내용: 웹 UI 상태 모듈에서 엔진의 `DevelopmentCard` 타입을 import했다. 루트 개발·타입 검사 명령에 엔진 선행 빌드를 추가하고 TypeScript 빌드 정보 파일을 Git 무시 목록에 넣었다. [README](../../README.md)에 설치·스크립트·워크스페이스 구조를 정리했다.
- 실행한 테스트/결과: 위 5개 시나리오 모두 통과. 웹 개발 서버가 HTTP 200을 반환함을 확인했다.
- 이슈/의사결정: 패키지 타입 진입점이 빌드 산출물을 가리켜 엔진 선행 빌드가 필요하다. 루트 명령이 이를 자동 처리하도록 결정했다. Firebase 기능은 아직 구현되지 않았다.
- 다음 작업에 전달할 사항: 4일차 Firebase 에뮬레이터·익명 인증·Firestore·Functions 연결 검증을 진행할 것. 공유 엔진 타입이나 규칙 변경 시 개발 서버를 재시작할 것.

## 참고
- [전체 일정](../README.md)
- [기획 요구사항](../requirements.md)
- [아키텍처](../architecture.md)

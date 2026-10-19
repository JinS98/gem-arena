# 4일차 — Firebase Emulator·Auth·Firestore·Functions 세팅

**단계:** 기획·기반  
**예상 시간:** 3~4시간  
**상태:** 완료

## 오늘의 목표
Firebase Emulator·Auth·Firestore·Functions 세팅 작업을 완료하고 다음 일차에서 재사용 가능한 결과물을 만든다.

## 작업 체크리스트
- [x] 현재 구현 상태와 관련 요구사항 확인
- [x] 입력·출력·예외 조건 정리
- [x] **Firebase Emulator·Auth·Firestore·Functions 세팅** 구현 또는 문서화
- [x] 관련 단위/통합/수동 테스트 작성 및 실행
- [x] 실패 사례와 남은 작업 기록
- [x] README 또는 설계 문서에 결정 사항 반영

## 관련 파일/폴더
`package.json`, `apps/web/src/services/firebase.ts`, `apps/web/.env.emulator`, `apps/web/scripts/verify-emulators.mjs`, `functions/src/index.ts`, `firebase.json`, `firestore.rules`

## 검증 시나리오
| 입력·조건 | 기대 출력 | 실행 결과 |
|---|---|---|
| `demo-gem-arena`로 Auth·Firestore·Functions Emulator 실행 | 세 서비스가 같은 프로젝트 ID로 시작 | `npm run test:emulators`에서 시작 확인 |
| 익명 로그인 | Auth Emulator가 UID 발급 | 통과 |
| 로그인한 클라이언트가 `rooms/day-04-probe` 읽기·쓰기 | 현재 deny-all 규칙에 따라 `permission-denied` | 두 요청 모두 거부 확인 |
| 로그인한 사용자가 `emulatorHealth` 호출 | `{ ok: true }` 반환 | 통과 |
| 비로그인 사용자가 `emulatorHealth` 호출 | `functions/unauthenticated` | 거부 확인 |
| `npm run dev:emulators` | Vite가 데모 설정과 에뮬레이터 연결 코드를 제공 | HTTP 200 및 변환된 모듈 확인 |

## 완료 기준
**Emulator에서 Auth·Firestore·Functions를 실행한다**

## 입력·출력·예외 조건

- 입력: Node.js 22, Java JDK 11 이상, 저장소 의존성 설치. 현재 환경에는 Temurin JDK 21과 프로젝트 로컬 Firebase CLI 15.34.0을 준비했다.
- `npm run emulators`는 Functions를 빌드한 뒤 세 에뮬레이터를 `demo-gem-arena`로 시작한다. 실제 Firebase 프로젝트·로그인은 필요하지 않다.
- `npm run dev:emulators`는 `apps/web/.env.emulator`를 사용한다. 웹 SDK의 Auth·Firestore·Functions 인스턴스가 각각 9099·8080·5001 포트로 연결되도록 설정한다.
- `npm run test:emulators`는 에뮬레이터를 임시로 시작해 정상·거부 경로를 검증하고 종료한다. 이미 에뮬레이터를 실행 중이면 동일 포트 충돌을 피하기 위해 먼저 종료한다.
- 실서비스용 `apps/web/.env`에는 실제 Firebase 설정을 별도로 입력한다. 에뮬레이터 모드가 아닌 경우 웹 SDK는 로컬 에뮬레이터에 연결하지 않는다.

## 작업 기록
- 구현 내용: 프로젝트 로컬 `firebase-tools`와 데모 프로젝트용 실행 명령을 추가했다. 웹 SDK에 에뮬레이터 연결 모드를 만들고 인증이 필요한 읽기 전용 `emulatorHealth` Callable Function을 추가했다. 통합 검증 스크립트와 [README](../../README.md) 실행 절차를 작성했다.
- 실행한 테스트/결과: `npm run test:emulators` 통과(위 6개 확인 항목). `npm run typecheck`, `npm run build`, `npm test` 통과(엔진 테스트 7개). 웹 에뮬레이터 모드 개발 서버가 HTTP 200을 반환했다.
- 이슈/의사결정: 처음에는 Java 부재로 Firestore를 시작할 수 없었고, JDK를 설치했다. Firebase CLI의 사용자 설정 파일 접근이 샌드박스에서 거부되어 허용된 권한으로 통합 검증을 실행했다. 실제 프로젝트 대신 `demo-` ID를 사용해 비에뮬레이션 서비스 접근을 막는다.
- 다음 작업에 전달할 사항: 현재 Firestore 규칙은 모든 클라이언트 접근을 거부한다. 방·게임 문서 권한 규칙과 실제 게임 API는 해당 구현 일차에 추가해야 한다. 웹 로그인 화면과 익명 세션 복구는 19일차 범위다.

## 참고 자료

- [Firebase Local Emulator Suite 설치 및 구성](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [데모 프로젝트 선택](https://firebase.google.com/docs/emulator-suite/use_hosting)
- [Auth](https://firebase.google.com/docs/emulator-suite/connect_auth) · [Firestore](https://firebase.google.com/docs/emulator-suite/connect_firestore) · [Functions](https://firebase.google.com/docs/emulator-suite/connect_functions) 웹 연결

## 참고
- [전체 일정](../README.md)
- [기획 요구사항](../requirements.md)
- [아키텍처](../architecture.md)

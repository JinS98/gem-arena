# 31일차 — Hosting/Functions 배포·README·회고

**단계:** 품질·배포  
**상태:** 운영 재배포·사용자 도메인 HTTPS 확인 완료
**배포 대상:** `gem-arena` / `asia-northeast3` / `https://gem-arena.web.app`

## 오늘의 목표

로컬에서 검증한 멀티플레이 앱을 운영 Firebase 프로젝트에 게시하고, `gem-arena.kr` 연결 절차와 확인 범위를 문서화한다.

## 작업 체크리스트

- [x] 운영 프로젝트·웹 설정·기본 Hosting 사이트 확인
- [x] 빌드·타입·단위 테스트·보안 규칙·멀티플레이 완주 검증
- [x] Functions의 공유 엔진 `workspace:*` 배포 문제 수정
- [x] Cloud Functions 4개와 Firestore 규칙 배포
- [x] Hosting에 웹 빌드 배포 및 기본 URL 응답 확인
- [x] 배포 절차와 사용자 도메인 연결 작업 문서화
- [x] `gem-arena.kr` A·TXT 레코드가 네 권한 네임서버와 공용 DNS에 반영됨
- [x] `gem-arena.kr`의 HTTPS 응답 및 최신 빌드 제공 확인
- [ ] 선택적 `www` 연결
- [ ] 사용자 기기에서 실서비스 2~4인 방 생성부터 종료까지 확인

## 구현·배포 내용

- Functions의 게임 엔진을 서버 번들에 포함하고, Cloud Build가 설치할 수 없는 `workspace:*` 런타임 의존성을 제거했다. 운영 재배포는 저장소 루트의 `npm run deploy:prod`를 사용한다.
- Blaze 프로젝트에서 Functions에 필요한 Google Cloud API를 활성화했다. Cloud Functions 빌드 이미지의 Artifact Registry 보관 기간은 1일로 설정했다.
- `roomStarted`, `submitAction`, `leaveRoom`, 로컬 연결 확인용 `emulatorHealth`를 서울 리전에 배포했다. 네 함수 모두 `ACTIVE` 상태를 확인했다.
- `firestore.rules`를 운영 기본 데이터베이스에 게시하고 `apps/web/dist`를 Firebase Hosting 기본 사이트에 게시했다.
- 도메인 연결의 Firebase·예스닉 순서는 [배포 및 도메인 연결 안내](../deployment.md)에 기록했다.

## 검증 결과

- `corepack pnpm build` 및 `corepack pnpm typecheck` 통과.
- `corepack pnpm test`: 엔진 84건, 웹 1건 통과.
- 실행 중인 Auth·Firestore 에뮬레이터에서 보안 규칙 허용 14건·거부 47건 통과. 별도 `npm run test:rules`는 포트 9099·8080 점유로 새 인스턴스를 시작하지 못해 기존 인스턴스에 직접 연결해 실행했다.
- 새 Functions 번들로 에뮬레이터 2·3·4인 완주 확인 (각 54·69·100 행동).
- 운영 익명 Auth에서 임시 계정 생성·삭제 성공.
- `https://gem-arena.web.app/`, `/lobby`, `/game/demo`가 모두 HTTP 200으로 응답. 이 확인은 화면 응답·SPA 라우팅 확인이며 운영 다중 사용자 게임 완주를 대신하지 않는다.

## 2026-10-23 운영 재배포

- 테마 카드·자원 이미지, 로비 방 목록, 온라인 턴당 3분 제한, 화면 정리 내용을 `npm run deploy:prod`로 웹·Functions·Firestore 규칙에 함께 게시했다.
- 테스트 전용 `emulatorHealth`를 운영에서 삭제했다. 새 `expireTurn`, `sweepExpiredTurns`, `roomListingUpdated`를 포함한 Cloud Functions 6개가 배포됐고 오류 없이 등록됐다.
- `https://gem-arena.web.app`과 `https://gem-arena.kr` 모두 최신 빌드의 HTML과 JS 자산을 HTTP 200으로 제공하는 것을 확인했다. 이는 운영 다중 사용자 게임 완주 검증을 대신하지 않는다.
- 처음 재배포는 남아 있던 `emulatorHealth` 삭제 확인이 비대화형 환경에서 필요해 중단됐다. 함수를 명시적으로 삭제한 후 전체 재배포를 완료했다.

## 실패 사례·해결

- 첫 Functions 배포는 Cloud Build의 npm이 `workspace:*`를 설치하지 못해 실패했다. 서버 번들로 공유 엔진을 포함한 후 재배포했다.
- 실패한 첫 시도가 Cloud Functions에 `FAILED` 항목을 남겨 `roomStarted` 트리거 종류가 충돌했다. 실패 항목 4개를 제거하고 새로 생성했다.
- 첫 배포의 이미지 정리 정책 설정 단계도 실패했으나, `functions:artifacts:setpolicy --location asia-northeast3 --days 1 --force`로 정책을 설정했다.
- Vite 빌드는 단일 JS 청크 500 kB 초과 경고가 있지만 빌드에 성공했다. 초기 로딩 최적화는 후속 과제다.

## 다음 확인

1. Firebase 콘솔에서 `gem-arena.kr` 연결 상태를 확인한다. 외부 HTTPS 응답과 최신 자산 제공은 2026-10-23 확인했다.
2. `www.gem-arena.kr`도 사용할 경우 Hosting에 별도로 추가하고 DNS 및 HTTPS 연결을 확인한다.
3. 서로 다른 실제 브라우저·기기에서 2~4인 방 생성, 준비, 시작, 보석 획득, 카드 구매·예약, 기권, 종료를 확인한다. 특히 운영 Functions의 게임 초기화와 개인 예약 카드 권한을 확인한다.
4. 비용·오류 로그와 사용량을 관찰하고, 필요 시 웹 번들 분할과 함수 의존성 업데이트를 진행한다.

## 참고

- [배포 및 도메인 연결 안내](../deployment.md)
- [전체 일정](../README.md)
- [기획 요구사항](../requirements.md)
- [아키텍처](../architecture.md)

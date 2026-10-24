# 운영 배포와 `gem-arena.kr` 연결

## 현재 배포 상태

- Firebase 프로젝트: `gem-arena` (Blaze)
- 2026-10-24 멀티 기능 배포: 내 차례 중앙 안내, 로비 오류 중앙 안내, 상대 행동 애니메이션, 상대 예약 카드 모달을 Functions 6개와 Hosting에 반영했다. 시장 예약의 카드 ID만 공개하고 덱 예약은 뒷면으로 유지하며, 공개 여부 기록이 없는 이전 예약은 뒷면으로 표시한다. 엔진 87개·웹 14개 테스트와 전체 빌드가 통과했고 로컬 Firebase에서 공개/비공개 접근 권한·예약 재시도·구매 후 제거를 검증했다. 두 운영 주소의 최신 HTML·JS와 헤더의 3D 예시 미노출을 확인했다.
- 2026-10-23 화면 개선 재배포: 멀티 카드 입체 표면·호버·구매 가능 태그, 보석 은행 호버·클릭 효과와 흰색 글자 대비를 Hosting에 반영했다. 3D 예시는 `/examples/3d`에 유지하되 헤더 메뉴에서는 숨겼다. 엔진 84개·웹 8개 테스트와 운영 빌드가 통과했으며 `gem-arena.web.app`, `gem-arena.kr`의 최신 HTML·JS 및 실제 헤더를 확인했다. 이번 배포는 Hosting만 대상으로 했다.
- Hosting 기본 주소: <https://gem-arena.web.app>
- Firestore: 기본 데이터베이스, `firestore.rules` 게시됨
- Cloud Functions: `roomStarted`, `submitAction`, `leaveRoom`, `expireTurn`, `sweepExpiredTurns`, `roomListingUpdated` — 서울(`asia-northeast3`), 2026-10-23 배포 후 모두 ACTIVE
- 온라인 턴당 3분 제한, 로비 방 목록, 테마 선택 및 카드·자원 이미지가 운영 웹·Functions·Firestore 규칙에 반영됐다. 테스트 전용 `emulatorHealth` 함수는 제거했다. 배포 전에 만들어진 대기실은 다음 방 문서 갱신 때 목록에 반영된다.
- 익명 Authentication: 임시 계정 생성·삭제 확인
- 2026-10-23 재확인: `https://gem-arena.web.app`과 `https://gem-arena.kr`이 모두 HTTP 200으로 응답하고, 두 주소에서 최신 빌드의 JS 자산도 HTTP 200으로 제공한다. `www.gem-arena.kr`은 아직 별도로 연결되지 않았다.

## 사용자가 할 일 — 순서대로

1. Firebase Hosting에 `gem-arena.kr` 맞춤 도메인을 추가한다. 현재 Firebase 설정 화면은 루트 도메인에 **A `199.36.158.100`**과 **TXT `hosting-site=gem-arena`**를 요구한다.
2. **DNS 반영 완료.** 예스닉의 설정이 위임된 `ns1`~`ns4.whoisdomain.kr`에 반영됐다. TXT `hosting-site=gem-arena`는 인증과 인증서 갱신을 위해 유지한다.
3. **기존 A 삭제 작업은 현재 불필요하다.** 권한 네임서버와 공용 DNS에서 파킹 IP `118.67.131.217`이 이미 사라졌고 A `199.36.158.100`만 확인된다. 현재 루트 도메인의 HTTPS 응답도 확인했다.
4. `www.gem-arena.kr`도 접속시키려면 Firebase Hosting에서 이 도메인을 추가하고 **`gem-arena.kr`로 리디렉션**하도록 설정한다. 예스닉의 `www` 파킹 A 레코드도 제거하고, Firebase가 `www`에 제시한 A 또는 CNAME 값을 입력한다.
5. 새 도메인을 추가했다면 Firebase Hosting에서 **Connected/연결됨**과 HTTPS를 확인한다. 현재 루트 도메인은 HTTPS로 최신 빌드를 제공한다.
6. 최종 주소로 홈·로비·온라인 대전을 열고, 별도 브라우저 프로필 또는 기기 두 개로 익명 로그인 → 방 생성/참가 → 전원 준비 → 게임 시작 → 보석/카드 행동 → 종료를 확인한다. 필요하면 Firebase Console의 Authentication → 설정 → 승인된 도메인에 `gem-arena.kr`을 등록한다. 현재 익명 로그인은 `authDomain=gem-arena.firebaseapp.com`으로 동작하며 OAuth 리디렉션 로그인은 사용하지 않는다.

Firebase가 도메인별로 표시하는 DNS 레코드가 최종 기준이다. 도메인 구매만으로 Firebase에 자동 연결되지는 않는다. 현재 웹의 Firebase 설정은 운영 프로젝트를 가리키므로 DNS 연결을 위해 API 키나 앱 ID를 바꿀 필요는 없다.

## 이후 재배포

저장소 루트에서 `npm run deploy:prod`를 실행한다. 엔진·웹·Functions를 빌드한 뒤 `gem-arena` 프로젝트에 Functions, Firestore 규칙, Hosting을 게시한다. 배포 전 `npm test`, `npm run typecheck`, 보안 규칙 테스트를 확인한다. Functions만 게시하더라도 먼저 `npm run build`를 실행해 공유 엔진 번들을 갱신한다.

Cloud Scheduler API를 활성화했고 `sweepExpiredTurns` 예약 함수를 배포했다. 모든 플레이어가 브라우저를 닫아도 예약 작업이 1분 간격으로 만료된 턴을 처리한다.

## 출처

- [Firebase Hosting 맞춤 도메인 연결](https://firebase.google.com/docs/hosting/custom-domain)
- [Firebase Functions 배포](https://firebase.google.com/docs/functions/manage-functions)
- [Firebase 예약 함수](https://firebase.google.com/docs/functions/schedule-functions)
- [예스닉 네임서버 고급설정 안내](https://www.yesnic.com/index.php?_action=index&_task=service)

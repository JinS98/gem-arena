# 일차별 개발 문서

1일차 = 3~4시간 작업 세션. 체크박스는 개발 진행에 따라 직접 갱신합니다.

[멀티 게임판 예상 시안과 기존 일정 내 작업 배치](development-plan.md#멀티-게임판-시각-방향)

## 일차 외 개선 기록

- [로컬 게임판 UI·턴 흐름 개선](local-board-improvements.md)

## 기획·기반
- [x] [1일차 — 요구사항·MVP 범위 확정 및 사용자 플로우](daily/day-01.md)
- [x] [2일차 — 기본판 규칙 명세·예외 케이스 표 작성](daily/day-02.md)
- [x] [3일차 — pnpm 모노레포·React/Vite·TypeScript 세팅](daily/day-03.md)
- [x] [4일차 — Firebase Emulator·Auth·Firestore·Functions 세팅](daily/day-04.md)
- [x] [5일차 — 게임 도메인 타입·정적 카드/귀족 데이터 구축](daily/day-05.md)

## 게임 엔진
- [x] [6일차 — 인원별 보석·덱·시장 초기화와 셔플 테스트](daily/day-06.md)
- [x] [7일차 — 보석 가져오기 규칙 및 보유 제한](daily/day-07.md)
- [x] [8일차 — 구매 비용·영구 할인·황금 토큰 결제](daily/day-08.md)
- [x] [9일차 — 시장/예약 카드 구매 및 덱 보충](daily/day-09.md)
- [x] [10일차 — 카드 예약·비공개 예약·황금 토큰 지급](daily/day-10.md)
- [x] [11일차 — 귀족 방문·복수 귀족 선택 상태](daily/day-11.md)
- [x] [12일차 — 15점 최종 라운드·동점 판정](daily/day-12.md)
- [x] [13일차 — 상태 전이 reducer·불변성·단위 테스트](daily/day-13.md)

## 로컬 UI
- [x] [14일차 — 게임판 레이아웃·플레이어 패널](daily/day-14.md)
- [x] [15일차 — 보석 은행·획득/반환 인터랙션](daily/day-15.md)
- [x] [16일차 — 카드 시장·구매/예약 모달](daily/day-16.md)
- [x] [17일차 — 턴 표시·귀족 선택·게임 결과](daily/day-17.md)
- [x] [18일차 — 로컬 2~4인 한 판 통합 테스트](daily/day-18.md)

## 멀티플레이
- [x] [19일차 — 익명 로그인·닉네임·라우팅](daily/day-19.md)
- [x] [20일차 — 방 생성·초대 코드·참가 검증](daily/day-20.md)
- [x] [21일차 — 로비·준비 상태·방장 시작](daily/day-21.md)
- [ ] [22일차 — 서버 전용 덱/개인 예약 카드와 공개 뷰 분리](daily/day-22.md) (로컬 검증 완료·실환경 초기화 미연결)
- [ ] [23일차 — submitAction 인증·턴·규칙 검증](daily/day-23.md) (로컬 검증 완료·실서비스 미연결)
- [ ] [24일차 — Firestore Transaction·version·actionId 멱등성](daily/day-24.md) (로컬 검증 완료·실서비스 미연결)
- [ ] [25일차 — 실시간 구독·낙관적 UI 최소화](daily/day-25.md) (로컬 구독·게임판 검증 완료·실서비스 미연결)
- [ ] [26일차 — 재접속·새로고침·퇴장 정책](daily/day-26.md) (로컬 퇴장·기권·Firestore 재구독·브라우저 새로고침 검증 완료, 오프라인 화면/실서비스 미검증)

## 품질·배포
- [ ] [27일차 — Security Rules·Emulator 권한 테스트](daily/day-27.md) (로컬 권한 매트릭스 통과·실서비스 규칙 미게시)
- [ ] [28일차 — 동시 요청·중복 클릭·장애 시나리오](daily/day-28.md) (로컬 동시성·브라우저 검증 완료·실서비스 미검증)
- [ ] [29일차 — 반응형·접근성·애니메이션·에러 UX](daily/day-29.md) (로컬 2~4인 PC·모바일·키보드 검증 완료·실기기 미검증)
- [ ] [30일차 — E2E 2~4인 완주·성능/읽기 비용 점검](daily/day-30.md)
- [ ] [31일차 — Hosting/Functions 배포·README·회고](daily/day-31.md)


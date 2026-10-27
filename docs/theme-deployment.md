# 테마 버전 배포

`hidden-theme` 브랜치는 `gem-arena-theme` Firebase 프로젝트에 배포한다. Hosting 주소는 <https://gem-arena-theme.web.app>과 <https://gem-arena-theme.firebaseapp.com>이다. 두 주소는 같은 테마 사이트를 제공한다.

`main` 브랜치의 오리지널 버전은 별도 `gem-arena` 프로젝트의 <https://gem-arena.kr>에서 제공한다. 두 프로젝트의 Authentication, Firestore 방과 게임 데이터, Functions는 분리된다. 서로 다른 버전의 초대 코드로 교차 참가할 수 없다.

## 준비

Firebase Console의 `gem-arena-theme` 웹 앱 설정에서 API 키, 인증 도메인, 프로젝트 ID, 앱 ID를 확인한다. `apps/web/.env.theme`에 다음 값을 입력한다. 이 파일은 Git에서 무시된다.

```dotenv
VITE_FIREBASE_API_KEY=<웹 앱 API 키>
VITE_FIREBASE_AUTH_DOMAIN=gem-arena-theme.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gem-arena-theme
VITE_FIREBASE_APP_ID=<웹 앱 ID>
VITE_USE_FIREBASE_EMULATORS=false
```

Firebase CLI에 로그인한 뒤 `npm run deploy:theme`을 실행한다. 이 명령은 테마 설정을 확인하고 엔진, 웹, Functions를 빌드한 다음 `gem-arena-theme`에 Functions, Firestore 규칙, Hosting을 게시한다. 오리지널 버전은 `main`에서 `npm run deploy:prod`로 별도 배포한다.

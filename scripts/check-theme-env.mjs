import { readFileSync } from 'node:fs';

const path = new URL('../apps/web/.env.theme', import.meta.url);
let content;
try {
  content = readFileSync(path, 'utf8');
} catch {
  throw new Error('apps/web/.env.theme 파일에 gem-arena-theme 웹 앱 설정을 입력하세요.');
}

const values = Object.fromEntries(
  content.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }),
);

if (
  values.VITE_FIREBASE_PROJECT_ID !== 'gem-arena-theme' ||
  values.VITE_FIREBASE_AUTH_DOMAIN !== 'gem-arena-theme.firebaseapp.com' ||
  !values.VITE_FIREBASE_API_KEY ||
  !values.VITE_FIREBASE_APP_ID?.startsWith('1:714912434280:web:') ||
  values.VITE_USE_FIREBASE_EMULATORS !== 'false'
) {
  throw new Error('apps/web/.env.theme 설정이 gem-arena-theme 웹 앱과 일치하지 않습니다.');
}

for (const name of Object.keys(values)) {
  if (process.env[name] && process.env[name] !== values[name]) {
    throw new Error(`${name} 환경 변수가 .env.theme 값을 덮어씁니다.`);
  }
}

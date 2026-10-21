import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Run with the emulator web dev server and a disposable Chrome debugging session.
const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const chrome = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9223';
const web = process.env.GEM_ARENA_WEB_URL ?? 'http://127.0.0.1:5173';
const tabs = await fetch(`${chrome}/json`).then(response => response.json());
const tab = tabs.find(value => value.type === 'page');
if (!tab) throw new Error('Chrome 디버그 탭을 찾지 못했습니다');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const entry = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* The page can be reloading. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${label}: 제한 시간 초과`);
}
const db = getFirestore(initializeApp({ projectId: 'demo-gem-arena' }));

try {
  await command('Page.enable');
  await command('Page.navigate', { url: `${web}/lobby` });
  await waitFor(() => evaluate("document.body?.innerText.includes('익명 로그인 완료')"), '익명 로그인');
  await evaluate(`(() => {
    const input = document.querySelector('#player-nickname');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ReconnectTester');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('새 방 만들기')).click()");
  await waitFor(() => evaluate("location.pathname.startsWith('/rooms/')"), '방 생성');
  const path = await evaluate('location.pathname');
  const roomCode = path.split('/').at(-1);
  const roomRef = db.doc(`rooms/${roomCode}`);
  const before = (await roomRef.get()).data();
  const uid = before.playerOrder[0];
  assert.ok(uid);
  await command('Page.reload');
  await waitFor(() => evaluate(`location.pathname === '/rooms/${roomCode}' &&
    document.body?.innerText.includes('참가자') && !document.body?.innerText.includes('방 정보를 읽지 못했습니다')`),
  '대기실 새로고침 복원');
  assert.equal((await roomRef.get()).data().playerOrder[0], uid);
  await command('Page.navigate', { url: `${web}/lobby` });
  await waitFor(() => evaluate("document.body?.innerText.includes('익명 로그인 완료')"), '로비 복귀');
  assert.equal(await evaluate("document.querySelector('#player-nickname').value"), '');
  await evaluate(`(() => {
    const input = document.querySelector('#room-code');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '${roomCode}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('방 참가')).click();
    return true;
  })()`);
  await waitFor(() => evaluate(`location.pathname === '/rooms/${roomCode}'`), '초대 코드로 기존 좌석 복귀');
  assert.deepEqual((await roomRef.get()).data().playerOrder, [uid]);

  const guest = `browser-reconnect-opponent-${roomCode}`;
  await roomRef.update({ status: 'playing', playerOrder: [uid, guest],
    players: { ...before.players,
      [uid]: { ...before.players[uid], ready: true },
      [guest]: { uid: guest, nickname: '상대', ready: true, forfeited: false } } });
  const gameRef = roomRef.collection('game').doc('publicState');
  await waitFor(async () => (await gameRef.get()).exists, '게임 상태 초기화');
  await command('Page.navigate', { url: `${web}/game/${roomCode}` });
  await waitFor(() => evaluate("document.body?.innerText.includes('내 예약 카드') && document.body?.innerText.includes('보석 은행')"), '게임판 구독');
  await command('Page.reload');
  await waitFor(() => evaluate("document.body?.innerText.includes('내 예약 카드') && document.body?.innerText.includes('보석 은행')"), '게임판 새로고침 복원');
  assert.equal((await roomRef.get()).data().playerOrder[0], uid);
  console.log(`Chrome 동일 UID의 새로고침·초대 코드 재입장·게임판 복원 통과 (${roomCode})`);
} finally {
  socket.close();
}

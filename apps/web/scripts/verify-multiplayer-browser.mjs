import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { chooseAction } from './verify-multiplayer-complete.mjs';
import { reduceGameAction } from '../../../packages/game-engine/dist/index.js';

// Requires the Auth, Firestore and Functions emulators plus the Vite emulator-mode server.
const requireFunctions = createRequire(new URL('../../../functions/package.json', import.meta.url));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getFirestore } = requireFunctions('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const webUrl = process.env.GEM_ARENA_WEB_URL ?? 'http://localhost:5173';
const chromePort = process.env.CHROME_DEBUG_PORT ? Number(process.env.CHROME_DEBUG_PORT)
  : await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolvePort(port));
    });
  });
const debugUrl = `http://127.0.0.1:${chromePort}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const admin = getFirestore(initializeApp({ projectId: 'demo-gem-arena' }));

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    return this;
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch { /* Page may be navigating. */ }
    await delay(50);
  }
  throw new Error(`${label}: ${timeout}ms 안에 완료되지 않았습니다`);
}

async function openPage(browser, contexts, pages, index) {
  const { browserContextId } = await browser.call('Target.createBrowserContext');
  contexts.push(browserContextId);
  const { targetId } = await browser.call('Target.createTarget',
    { url: `${webUrl}/lobby`, browserContextId });
  let target;
  await waitFor(async () => {
    target = (await fetch(`${debugUrl}/json/list`).then(response => response.json()))
      .find(item => item.id === targetId);
    return Boolean(target?.webSocketDebuggerUrl);
  }, `참가자 ${index + 1} Chrome 탭`);
  const page = await new Cdp(target.webSocketDebuggerUrl).open();
  pages.push(page);
  await page.call('Page.enable');
  await page.call('Runtime.enable');
  await page.call('Emulation.setDeviceMetricsOverride', index === 1
    ? { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }
    : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(() => page.evaluate("Boolean(document.querySelector('#player-nickname'))"),
    `참가자 ${index + 1} 익명 로그인`);
  await page.evaluate(`(() => {
    const input = document.querySelector('#player-nickname');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '검증${index + 1}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await page.evaluate("document.querySelector('.lobby-identity__form button[type=submit]').click()");
  await waitFor(() => page.evaluate("document.body?.innerText.includes('입장 준비 완료')"),
    `참가자 ${index + 1} 닉네임 저장`);
  return page;
}

async function authToken(page) {
  return page.evaluate(`new Promise((resolve, reject) => {
    const localUser = Object.keys(localStorage).filter(key => key.startsWith('firebase:authUser:'))
      .map(key => JSON.parse(localStorage.getItem(key))).find(value => value?.stsTokenManager?.accessToken);
    if (localUser) { resolve(localUser.stsTokenManager.accessToken); return; }
    const request = indexedDB.open('firebaseLocalStorageDb');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const tx = request.result.transaction('firebaseLocalStorage', 'readonly');
      const rows = tx.objectStore('firebaseLocalStorage').getAll();
      rows.onerror = () => reject(rows.error);
      rows.onsuccess = () => {
        const user = rows.result.find(row => row.value?.stsTokenManager?.accessToken || row.stsTokenManager?.accessToken);
        const token = user?.value?.stsTokenManager?.accessToken ?? user?.stsTokenManager?.accessToken;
        if (!token) reject(new Error('인증 저장소 필드: ' + JSON.stringify({ indexed: rows.result.map(row =>
          ({ fields: Object.keys(row), nested: Object.keys(row.value ?? {}) })), local: Object.keys(localStorage) })));
        else resolve(token);
      };
    };
  })`);
}

async function submit(token, roomCode, state, action) {
  const response = await fetch('http://127.0.0.1:5001/demo-gem-arena/asia-northeast3/submitAction', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { roomId: roomCode, actionId: `browser-${state.version}-${randomBytes(4).toString('hex')}`,
      expectedVersion: state.version, action } }),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(JSON.stringify(body));
  return body.result;
}

async function completeInBrowsers(playerCount, browser, contexts, pages) {
  const started = performance.now();
  const selectedTheme = process.env.GEM_ARENA_TEST_THEME ?? 'default';
  if (!['default', 'lol', 'demon-slayer'].includes(selectedTheme)) throw new Error('지원하지 않는 검증 테마입니다');
  const tabs = [];
  for (let index = 0; index < playerCount; index++) {
    tabs.push(await openPage(browser, contexts, pages, index));
  }
  await tabs[0].evaluate(`(() => {
    const input = document.querySelector('#room-title');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '멀티 대전 검증');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('방 만들기')).click();
  })()`);
  await waitFor(() => tabs[0].evaluate("location.pathname.startsWith('/rooms/')"), '방 생성');
  const roomCode = (await tabs[0].evaluate('location.pathname')).split('/').at(-1);
  const room = admin.doc(`rooms/${roomCode}`);
  if (selectedTheme !== 'default') {
    await waitFor(() => tabs[0].evaluate(`Boolean(document.querySelector('.theme-picker__option--${selectedTheme}:not(:disabled)'))`), '테마 선택 버튼');
    await tabs[0].evaluate(`document.querySelector('.theme-picker__option--${selectedTheme}').click()`);
    await waitFor(async () => (await room.get()).get('theme') === selectedTheme, '방 테마 저장');
  }
  for (const tab of tabs.slice(1)) {
    await tab.evaluate(`(() => {
      const input = document.querySelector('#room-code');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '${roomCode}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('방 참가')).click();
      return true;
    })()`);
    await waitFor(() => tab.evaluate(`location.pathname === '/rooms/${roomCode}'`), '방 참가');
  }
  const ids = (await room.get()).get('playerOrder');
  assert.equal(ids.length, playerCount);
  for (const tab of tabs) {
    await tab.evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('준비하기')).click()");
  }
  await waitFor(async () => Object.values((await room.get()).get('players')).every(player => player.ready), '모두 준비');
  await waitFor(() => tabs[0].evaluate("Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('게임 시작') && !button.disabled)"), '방장 시작 버튼 활성화');
  await tabs[0].evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('게임 시작')).click()");
  await waitFor(async () => (await room.get()).get('status') === 'playing', '방 상태 시작');
  for (const [index, tab] of tabs.entries()) {
    await waitFor(() => tab.evaluate(`location.pathname === '/game/${roomCode}'`), `참가자 ${index + 1} 게임판 자동 이동`);
    await waitFor(() => tab.evaluate("document.querySelector('.multiplayer-table') !== null"), `참가자 ${index + 1} 게임판 표시`);
    if (selectedTheme !== 'default') {
      const whiteName = selectedTheme === 'lol' ? '천상의 파편' : '안개';
      const greenName = selectedTheme === 'lol' ? '자연의 정수' : '바람';
      await waitFor(() => tab.evaluate(`(() => {
        const white = document.querySelector('[data-bank-color="white"]');
        const green = document.querySelector('[data-bank-color="green"]');
        const portrait = document.querySelector('.market-card .card-face__portrait');
        return white?.textContent?.includes('${whiteName}') && green?.textContent?.includes('${greenName}') &&
          getComputedStyle(white.querySelector('.gem-icon')).backgroundImage.includes('${selectedTheme}-white') &&
          portrait?.src.includes('/themes/${selectedTheme}/') && portrait.complete && portrait.naturalWidth === 600;
      })()`), `참가자 ${index + 1} 테마 자원과 카드 이미지`);
    }
  }
  const tokens = await Promise.all(tabs.map(authToken));
  assert.ok(tokens.every(Boolean));
  let state = (await room.collection('privateState').doc('server').get()).data();
  const checked = { desktop: 0, mobile: 0, privacy: 0, reserveFeedback: 0,
    gemFeedback: 0, purchaseFeedback: 0 };
  let actions = 0;
  while (state.phase !== 'finished' && actions < 1500) {
    const actorIndex = ids.indexOf(state.playerOrder[state.turnIndex]);
    const action = actions === 0 ? { type: 'RESERVE_CARD', level: 1 } : chooseAction(state);
    const expected = reduceGameAction(state, ids[actorIndex], action);
    if (actions === 0) {
      await waitFor(() => tabs[actorIndex].evaluate("Boolean(document.querySelector('.market-row--level-1 .market-deck:not(:disabled)'))"), '첫 턴 예약 버튼');
      await tabs[actorIndex].evaluate("document.querySelector('.market-row--level-1 .market-deck:not(:disabled)').click()");
    } else if (action.type === 'TAKE_GEMS' && checked.gemFeedback === 0) {
      await waitFor(() => tabs[actorIndex].evaluate("Boolean(document.querySelector('.gem-bank__button:not(:disabled)'))"), '보석 선택 버튼');
      for (const color of action.colors) {
        await tabs[actorIndex].evaluate(`document.querySelector('[data-bank-color="${color}"]').click()`);
      }
      await waitFor(() => tabs[actorIndex].evaluate("Boolean(document.querySelector('.multiplayer-actions__primary:not(:disabled)'))"), '보석 받기 버튼');
      await tabs[actorIndex].evaluate("document.querySelector('.multiplayer-actions__primary:not(:disabled)').click()");
    } else if (action.type === 'BUY_CARD' && action.source === 'market' && checked.purchaseFeedback === 0) {
      const level = [1, 2, 3].find(value => state.market[value].includes(action.cardId));
      const slot = state.market[level].indexOf(action.cardId);
      await waitFor(() => tabs[actorIndex].evaluate(`Boolean(document.querySelector('.market-row--level-${level} .market-row__cards')?.children[${slot}])`), '구매할 카드');
      await tabs[actorIndex].evaluate(`document.querySelector('.market-row--level-${level} .market-row__cards').children[${slot}].click()`);
      await waitFor(() => tabs[actorIndex].evaluate("Boolean(document.querySelector('.multiplayer-card-dialog__actions button:not(:disabled)'))"), '카드 구매 버튼');
      await tabs[actorIndex].evaluate("document.querySelector('.multiplayer-card-dialog__actions button:not(:disabled)').click()");
    } else {
      const response = await submit(tokens[actorIndex], roomCode, state, action);
      assert.equal(response.version, expected.version);
    }
    await waitFor(async () => (await room.collection('privateState').doc('server').get()).get('version') === expected.version,
      `브라우저 게임 버전 ${expected.version}`);
    if (actions === 0) {
      await waitFor(() => tabs[actorIndex].evaluate("document.body?.innerText.includes('카드 예약이 반영되었습니다.')"),
        '예약 행동 피드백');
      checked.reserveFeedback++;
    }
    if (action.type === 'TAKE_GEMS' && checked.gemFeedback === 0) {
      await waitFor(() => tabs[actorIndex].evaluate("document.body?.innerText.includes('보석 획득이 반영되었습니다.')"), '보석 획득 피드백');
      checked.gemFeedback++;
    }
    if (action.type === 'BUY_CARD' && action.source === 'market' && checked.purchaseFeedback === 0) {
      await waitFor(() => tabs[actorIndex].evaluate("document.body?.innerText.includes('카드 구매가 반영되었습니다.')"), '카드 구매 피드백');
      checked.purchaseFeedback++;
    }
    if (actions === 0 || expected.version % 10 === 0 || expected.phase === 'finished') {
      for (const [index, tab] of tabs.entries()) {
        await waitFor(() => tab.evaluate(`(() => {
          const self = document.querySelector('.multiplayer-self .player-panel');
          return self?.getAttribute('aria-label')?.includes('${expected.players[ids[index]].score}점') &&
            self?.querySelector('.player-panel__status')?.textContent?.includes('${expected.players[ids[index]].purchasedCardIds.length}장 구매') &&
            self?.querySelector('.player-panel__status')?.textContent?.includes('${expected.players[ids[index]].reservedCardIds.length}장 예약');
        })()`), `참가자 ${index + 1} 공개 상태 ${expected.version}`);
        const layout = await tab.evaluate(`(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          opponents: document.querySelectorAll('.multiplayer-opponents .player-panel').length,
          ownCards: document.querySelectorAll('.multiplayer-self__cards .market-card').length,
          bank: Boolean(document.querySelector('.gem-bank')),
        }))()`);
        assert.equal(layout.overflow, false);
        assert.equal(layout.opponents, playerCount - 1);
        assert.equal(layout.ownCards, expected.players[ids[index]].reservedCardIds.length);
        assert.equal(layout.bank, true);
        for (const opponentId of ids.filter(id => id !== ids[index])) {
          const opponent = expected.players[opponentId];
          const opponentView = await tab.evaluate(`(() => {
            const panel = document.querySelector('[data-player-id="${opponentId}"]');
            return { label: panel?.getAttribute('aria-label'),
              reserved: panel?.querySelector('.player-panel__status')?.textContent };
          })()`);
          assert.ok(opponentView.label?.includes(`${opponent.score}점`));
          assert.ok(opponentView.reserved?.includes(`${opponent.reservedCardIds.length}장 예약`));
          for (const cardId of opponent.reservedCardIds) {
            assert.equal(await tab.evaluate(`document.body.outerHTML.includes(${JSON.stringify(cardId)})`), false);
          }
        }
        if (index === 1) checked.mobile++;
        else checked.desktop++;
        checked.privacy++;
      }
    }
    state = expected;
    actions++;
  }
  assert.equal(state.phase, 'finished');
  assert.deepEqual((await room.collection('privateState').doc('server').get()).data(), state);
  for (const [index, tab] of tabs.entries()) {
    await waitFor(() => tab.evaluate("document.body?.innerText.includes('게임 종료')"), '종료 화면');
    if (state.winnerIds.includes(ids[index])) {
      assert.equal(await tab.evaluate("document.querySelector('#multi-result-title')?.textContent"), '승리!');
      assert.ok(await tab.evaluate("Array.from(document.querySelectorAll('.result-modal button')).some(button => button.textContent.includes('로비로 나가기'))"));
    }
  }
  return { players: playerCount, theme: selectedTheme, roomCode, actions, winners: state.winnerIds.map(id => ids.indexOf(id) + 1),
    durationSec: Math.round((performance.now() - started) / 1000), checks: checked };
}

const profile = await mkdtemp(join(tmpdir(), 'gem-arena-day30-'));
const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--remote-allow-origins=*', `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const pages = [];
const contexts = [];
let browser;
try {
  await waitFor(async () => (await fetch(`${debugUrl}/json/version`).then(response => response.json())).webSocketDebuggerUrl,
    'Chrome 디버그 세션');
  browser = await new Cdp((await fetch(`${debugUrl}/json/version`).then(response => response.json())).webSocketDebuggerUrl).open();
  const counts = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [2, 3, 4];
  if (counts.some(count => ![2, 3, 4].includes(count))) throw new Error('인원은 2, 3, 4만 가능합니다');
  for (const count of counts) console.log(JSON.stringify(await completeInBrowsers(count, browser, contexts, pages)));
} finally {
  for (const page of pages) page.close();
  if (browser) {
    for (const browserContextId of contexts) {
      try { await browser.call('Target.disposeBrowserContext', { browserContextId }); } catch { /* Cleanup only. */ }
    }
    browser.close();
  }
  chrome.kill();
  if (chrome.exitCode === null) {
    await Promise.race([new Promise(resolveExit => chrome.once('exit', resolveExit)), delay(2000)]);
  }
  const safePrefix = resolve(tmpdir()) + '\\';
  if (resolve(profile).startsWith(safePrefix) && resolve(profile).includes('gem-arena-day30-')) {
    try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome may still be closing. */ }
  }
}

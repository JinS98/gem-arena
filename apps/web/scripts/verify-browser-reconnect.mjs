import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDevelopmentCard, toPublicGameView } from '../../../packages/game-engine/dist/index.js';

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
const dialogs = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Page.javascriptDialogOpening') {
    dialogs.push(message.params.message);
    return;
  }
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
  await waitFor(() => evaluate("Boolean(document.querySelector('#player-nickname'))"), '익명 로그인');
  await evaluate(`(() => {
    const input = document.querySelector('#player-nickname');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ReconnectTester');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await evaluate("document.querySelector('.lobby-identity__form button[type=submit]').click()");
  await waitFor(() => evaluate("document.body?.innerText.includes('입장 준비 완료')"), '닉네임 저장');
  await evaluate(`(() => {
    const input = document.querySelector('#room-title');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '연결 복구 확인');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('방 만들기')).click()");
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
  await waitFor(() => evaluate("document.body?.innerText.includes('입장 준비 완료')"), '로비 복귀');
  assert.equal(await evaluate("document.querySelector('#player-nickname')"), null);
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

  const playerCount = Number(process.env.GEM_ARENA_PLAYER_COUNT ?? 2);
  assert.ok([2, 3, 4].includes(playerCount));
  const guests = Array.from({ length: playerCount - 1 }, (_, index) =>
    `browser-reconnect-opponent-${index}-${roomCode}`);
  await roomRef.update({ status: 'playing', playerOrder: [uid, ...guests],
    players: { ...before.players,
      [uid]: { ...before.players[uid], ready: true },
      ...Object.fromEntries(guests.map((guest, index) =>
        [guest, { uid: guest, nickname: `상대 ${index + 1}`, ready: true, forfeited: false }])) } });
  const gameRef = roomRef.collection('game').doc('publicState');
  await waitFor(async () => (await gameRef.get()).exists, '게임 상태 초기화');
  await command('Page.navigate', { url: `${web}/game/${roomCode}` });
  await waitFor(() => evaluate("document.body?.innerText.includes('내 예약 카드') && document.body?.innerText.includes('보석 은행')"), '게임판 구독');
  await command('Page.reload');
  await waitFor(() => evaluate("document.body?.innerText.includes('내 예약 카드') && document.body?.innerText.includes('보석 은행')"), '게임판 새로고침 복원');
  assert.equal((await roomRef.get()).data().playerOrder[0], uid);
  const serverRef = roomRef.collection('privateState').doc('server');
  await serverRef.update({ turnIndex: 0 });
  await gameRef.update({ turnIndex: 0 });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('.market-row__reserve-deck')).some(button => !button.disabled)"),
    '내 차례 행동 버튼');
  await evaluate(`(() => {
    window.__rewardFlights = [];
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement && node.classList.contains('board-reward'))
        window.__rewardFlights.push(node.className);
    }))).observe(document.body, { childList: true });
    const button = Array.from(document.querySelectorAll('.market-row__reserve-deck'))
      .find(candidate => !candidate.disabled);
    button.click();
    button.click();
    return true;
  })()`);
  await waitFor(async () => (await serverRef.get()).data().version === 1, '중복 클릭 행동 확정');
  assert.equal((await gameRef.get()).data().version, 1);
  assert.equal((await gameRef.get()).data().players[uid].reservedCount, 1);
  assert.equal((await roomRef.collection('privatePlayers').doc(uid).get()).data().version, 1);
  assert.equal((await roomRef.collection('actionReceipts').doc(uid).collection('actions').get()).size, 1);
  await waitFor(() => evaluate("document.body?.innerText.includes('카드 예약이 게임판에 반영되었습니다.')"),
    '서버 확정 행동 알림');
  await waitFor(() => evaluate("window.__rewardFlights.some(value => value.includes('gem-icon--gold') && value.includes('board-reward--gem'))"),
    '예약 황금 보석 이동');

  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  const desktop = await evaluate(`(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    selfBottom: document.querySelector('.multiplayer-self').getBoundingClientRect().bottom,
    opponentsBottom: document.querySelector('.multiplayer-opponents').getBoundingClientRect().bottom,
    opponentsRight: document.querySelector('.multiplayer-opponents').getBoundingClientRect().right,
    opponentsScrollHeight: document.querySelector('.multiplayer-opponents').scrollHeight,
    opponentsClientHeight: document.querySelector('.multiplayer-opponents').clientHeight,
    opponentsScrollWidth: document.querySelector('.multiplayer-opponents').scrollWidth,
    opponentsClientWidth: document.querySelector('.multiplayer-opponents').clientWidth,
    tableBottom: document.querySelector('.multiplayer-table').getBoundingClientRect().bottom,
    marketScrollWidth: document.querySelector('.multiplayer-table .market-section').scrollWidth,
    marketClientWidth: document.querySelector('.multiplayer-table .market-section').clientWidth,
    bankLeft: document.querySelector('.multiplayer-actions').getBoundingClientRect().left,
    bankRight: document.querySelector('.multiplayer-actions').getBoundingClientRect().right,
    handLeft: document.querySelector('.multiplayer-self').getBoundingClientRect().left,
    handRight: document.querySelector('.multiplayer-self').getBoundingClientRect().right,
    handTop: document.querySelector('.multiplayer-self').getBoundingClientRect().top,
    marketBottom: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().bottom,
    marketHeight: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().height,
    pageHeight: document.documentElement.scrollHeight,
    levels: Array.from(document.querySelectorAll('.multiplayer-table .market-row')).map(row => ({
      top: row.getBoundingClientRect().top,
      cards: row.querySelectorAll('.market-card, .market-card-empty').length,
    })),
    cardRatio: (() => { const card = document.querySelector('.multiplayer-table .market-card').getBoundingClientRect();
      return card.width / card.height; })(),
  }))()`);
  assert.ok(desktop.scrollWidth <= desktop.viewport, `PC 가로 넘침: ${JSON.stringify(desktop)}`);
  assert.ok(desktop.opponentsScrollHeight <= desktop.opponentsClientHeight + 2 &&
    desktop.opponentsScrollWidth <= desktop.opponentsClientWidth + 2 &&
    desktop.marketScrollWidth <= desktop.marketClientWidth + 2 &&
    desktop.handLeft >= desktop.bankLeft && desktop.handRight <= desktop.bankRight &&
    desktop.marketHeight > 800 && desktop.pageHeight > 900 && desktop.levels[1].top < 900,
  `PC 전체 높이 카드 필드: ${JSON.stringify(desktop)}`);
  assert.ok(Math.abs(desktop.cardRatio - 2 / 3) < .01,
    `PC 카드 그림 비율: ${JSON.stringify(desktop)}`);
  assert.deepEqual(desktop.levels.map(level => level.cards), [4, 4, 4]);
  assert.ok(desktop.levels[0].top < desktop.levels[1].top &&
    desktop.levels[1].top < desktop.levels[2].top);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1351, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  const dockBoundary = await evaluate(`(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    opponentsWidth: document.querySelector('.multiplayer-opponents').scrollWidth - document.querySelector('.multiplayer-opponents').clientWidth,
    marketWidth: document.querySelector('.multiplayer-table .market-section').scrollWidth - document.querySelector('.multiplayer-table .market-section').clientWidth,
    handWidth: document.querySelector('.multiplayer-self').scrollWidth - document.querySelector('.multiplayer-self').clientWidth,
    handLeft: document.querySelector('.multiplayer-self').getBoundingClientRect().left,
    handRight: document.querySelector('.multiplayer-self').getBoundingClientRect().right,
    bankLeft: document.querySelector('.multiplayer-actions').getBoundingClientRect().left,
    bankRight: document.querySelector('.multiplayer-actions').getBoundingClientRect().right,
    marketHeight: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().height,
  }))()`);
  assert.ok(dockBoundary.scrollWidth <= 1351 && dockBoundary.opponentsWidth <= 2 &&
    dockBoundary.marketWidth <= 2 && dockBoundary.handWidth <= 2 &&
    dockBoundary.handLeft >= dockBoundary.bankLeft && dockBoundary.handRight <= dockBoundary.bankRight &&
    dockBoundary.marketHeight > 750,
  `오른쪽 현황 경계 폭: ${JSON.stringify(dockBoundary)}`);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1251, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  const narrowDesktop = await evaluate(`(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    handScrollWidth: document.querySelector('.multiplayer-self').scrollWidth,
    handClientWidth: document.querySelector('.multiplayer-self').clientWidth,
    handInsideActions: document.querySelector('.multiplayer-actions').contains(document.querySelector('.multiplayer-self')),
    opponentsWidth: Math.min(...Array.from(document.querySelectorAll('.multiplayer-opponents .player-panel')).map(panel => panel.getBoundingClientRect().width)),
    marketScrollWidth: document.querySelector('.multiplayer-table .market-section').scrollWidth,
    marketClientWidth: document.querySelector('.multiplayer-table .market-section').clientWidth,
  }))()`);
  assert.ok(narrowDesktop.scrollWidth <= 1251 &&
    narrowDesktop.handScrollWidth <= narrowDesktop.handClientWidth + 2 &&
    narrowDesktop.opponentsWidth >= 210 &&
    narrowDesktop.marketScrollWidth <= narrowDesktop.marketClientWidth + 2 &&
    narrowDesktop.handInsideActions,
  `좁은 PC 자원·카드 영역 분리: ${JSON.stringify(narrowDesktop)}`);
  if (process.env.GEM_ARENA_SCREENSHOT_DIR) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(process.env.GEM_ARENA_SCREENSHOT_DIR, 'gem-arena-hand-narrow-desktop.png'),
      Buffer.from(screenshot.data, 'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1100, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  const compact = await evaluate(`(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    opponentWidths: Array.from(document.querySelectorAll('.multiplayer-opponents .player-panel'))
      .map(panel => panel.getBoundingClientRect().width),
    marketWidth: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().width,
  }))()`);
  assert.ok(compact.scrollWidth <= 1100 &&
    compact.opponentWidths.every(width => width >= 210) && compact.marketWidth >= 800,
  `중간 화면 폭의 자원 패널: ${JSON.stringify(compact)}`);
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1800, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  const wide = await evaluate(`(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    cardHeight: document.querySelector('.multiplayer-table .market-card').getBoundingClientRect().height,
    actionFont: parseFloat(getComputedStyle(document.querySelector('.multiplayer-actions__primary')).fontSize),
    marketHeight: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().height,
    marketClientHeight: document.querySelector('.multiplayer-table .market-section').clientHeight,
    marketScrollHeight: document.querySelector('.multiplayer-table .market-section').scrollHeight,
  }))()`);
  assert.ok(wide.scrollWidth <= 1800 && wide.cardHeight >= 300 && wide.actionFont >= 12 &&
    wide.marketHeight > 1000 && wide.marketScrollHeight <= wide.marketClientHeight + 2,
    `넓은 화면 카드/조작 가독성: ${JSON.stringify(wide)}`);
  if (process.env.GEM_ARENA_SCREENSHOT_DIR) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(process.env.GEM_ARENA_SCREENSHOT_DIR, 'gem-arena-day29-wide.png'),
      Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate('scrollTo(0, document.documentElement.scrollHeight)');
  await waitFor(() => evaluate('scrollY >= 300'), '시장 카드 스크롤');
  const sticky = await evaluate(`(() => ({
    opponentsTop: document.querySelector('.multiplayer-opponents').getBoundingClientRect().top,
    opponentsBottom: document.querySelector('.multiplayer-opponents').getBoundingClientRect().bottom,
    opponentsScrollHeight: document.querySelector('.multiplayer-opponents').scrollHeight,
    opponentsClientHeight: document.querySelector('.multiplayer-opponents').clientHeight,
    bankGemsTop: document.querySelector('.multiplayer-actions .gem-bank').getBoundingClientRect().top,
    bankGemsBottom: document.querySelector('.multiplayer-actions .gem-bank').getBoundingClientRect().bottom,
    selfGemsBottom: document.querySelector('.multiplayer-self .player-panel').getBoundingClientRect().bottom,
    cardTop: document.querySelector('.market-row--level-1 .market-card').getBoundingClientRect().top,
    viewport: innerHeight,
  }))()`);
  if (process.env.GEM_ARENA_SCREENSHOT_DIR) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(process.env.GEM_ARENA_SCREENSHOT_DIR, 'gem-arena-day29-scrolled.png'),
      Buffer.from(screenshot.data, 'base64'));
  }
  assert.ok(sticky.opponentsTop >= 85 && sticky.opponentsBottom < sticky.viewport &&
    sticky.opponentsScrollHeight <= sticky.opponentsClientHeight + 2 &&
    sticky.bankGemsTop >= 52 && sticky.bankGemsBottom < sticky.viewport &&
    sticky.selfGemsBottom < sticky.viewport &&
    sticky.cardTop < sticky.viewport,
  `전체 카드 필드 스크롤 중 상대·내 보석: ${JSON.stringify(sticky)}`);
  const expandedHeight = await evaluate("document.querySelector('.multiplayer-self').getBoundingClientRect().height");
  const expandedMarketHeight = await evaluate("document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().height");
  await evaluate("document.querySelector('.multiplayer-self__toggle').click()");
  await waitFor(() => evaluate("document.querySelector('.multiplayer-self--compact') !== null"), '내 현황 간단 보기');
  const compactHand = await evaluate(`(() => ({
    height: document.querySelector('.multiplayer-self').getBoundingClientRect().height,
    marketHeight: document.querySelector('.multiplayer-table .market-section').getBoundingClientRect().height,
    preference: localStorage.getItem('gem-arena-hand-view'),
  }))()`);
  assert.ok(compactHand.height < expandedHeight - 40 &&
    Math.abs(compactHand.marketHeight - expandedMarketHeight) < 2 && compactHand.preference === 'compact',
  `내 현황 간단 보기: ${JSON.stringify({ expandedHeight, compactHand })}`);
  await evaluate("document.querySelector('.multiplayer-self__toggle').click()");
  await waitFor(() => evaluate("document.querySelector('.multiplayer-self--expanded') !== null"), '내 현황 자세히 보기');
  await evaluate('scrollTo(0, 0)');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  if (process.env.GEM_ARENA_SCREENSHOT_DIR) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(process.env.GEM_ARENA_SCREENSHOT_DIR, 'gem-arena-day29-desktop.png'),
      Buffer.from(screenshot.data, 'base64'));
  }

  await command('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  const mobile = await evaluate(`(() => ({
    viewport: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    marketCanScroll: Array.from(document.querySelectorAll('.multiplayer-table .market-row__cards'))
      .every(row => row.scrollWidth > row.clientWidth),
    cardRatio: (() => { const card = document.querySelector('.multiplayer-table .market-card').getBoundingClientRect();
      return card.width / card.height; })(),
  }))()`);
  assert.ok(mobile.scrollWidth <= mobile.viewport, `모바일 가로 넘침: ${JSON.stringify(mobile)}`);
  assert.equal(mobile.marketCanScroll, true);
  assert.ok(Math.abs(mobile.cardRatio - 2 / 3) < .01, `모바일 카드 그림 비율: ${JSON.stringify(mobile)}`);
  if (process.env.GEM_ARENA_SCREENSHOT_DIR) {
    const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(process.env.GEM_ARENA_SCREENSHOT_DIR, 'gem-arena-day29-mobile.png'),
      Buffer.from(screenshot.data, 'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride', {
    width: 320, height: 700, deviceScaleFactor: 1, mobile: true,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true,
    '320px 화면에서 가로 넘침');
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await serverRef.update({ turnIndex: 0 });
  await gameRef.update({ turnIndex: 0 });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('.market-row__reserve-deck')).some(button => !button.disabled)"),
    '모바일 행동 버튼');
  await evaluate("Array.from(document.querySelectorAll('.market-row__reserve-deck')).find(button => !button.disabled).click()");
  await waitFor(async () => (await serverRef.get()).data().version === 2, '모바일 덱 예약 확정');
  assert.equal((await gameRef.get()).data().players[uid].reservedCount, 2);
  await serverRef.update({ turnIndex: 0 });
  await gameRef.update({ turnIndex: 0 });
  await waitFor(() => evaluate("document.querySelector('.multiplayer-actions__primary:not(:disabled)') !== null || document.querySelector('.gem-bank__button:not(:disabled)') !== null"), '보석 받기 차례');
  const flightsBeforeTake = await evaluate('window.__rewardFlights.length');
  await evaluate(`(() => {
    Array.from(document.querySelectorAll('.gem-bank__button:not(:disabled)')).slice(0, 3)
      .forEach(button => button.click());
    return true;
  })()`);
  await waitFor(() => evaluate("!document.querySelector('.multiplayer-actions__primary').disabled"), '선택 보석 받기 활성화');
  await evaluate("document.querySelector('.multiplayer-actions__primary').click()");
  await waitFor(async () => (await serverRef.get()).data().version === 3, '보석 받기 확정');
  await waitFor(() => evaluate(`window.__rewardFlights.slice(${flightsBeforeTake})
    .filter(value => value.includes('board-reward--gem') && !value.includes('gem-icon--gold')).length >= 3`),
    '색 보석 3개 이동');
  await evaluate(`(() => {
    const card = document.querySelector('.multiplayer-table .market-card');
    card.focus();
    card.click();
    return true;
  })()`);
  await waitFor(() => evaluate("document.activeElement?.getAttribute('aria-label') === '카드 창 닫기'"), '모달 초점');
  assert.equal(await evaluate(`(() => {
    const buttons = document.querySelectorAll('.multiplayer-card-dialog button:not(:disabled)');
    buttons[buttons.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return document.activeElement === buttons[0];
  })()`), true);
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await waitFor(() => evaluate("!document.querySelector('.multiplayer-card-dialog')"), '모달 닫기');
  assert.equal(await evaluate("document.activeElement?.classList.contains('market-card')"), true);
  const purchaseState = (await serverRef.get()).data();
  const purchaseCard = getDevelopmentCard(purchaseState.market[1][0]);
  assert.ok(purchaseCard);
  const preparedGems = { ...purchaseState.players[uid].gems, ...purchaseCard.cost };
  const preparedBank = { ...purchaseState.bank };
  for (const color of Object.keys(purchaseCard.cost)) {
    preparedBank[color] += purchaseState.players[uid].gems[color] - preparedGems[color];
    assert.ok(preparedBank[color] >= 0, `구매 준비 은행 부족: ${color}`);
  }
  const preparedState = { ...purchaseState, turnIndex: 0, bank: preparedBank,
    players: { ...purchaseState.players, [uid]: { ...purchaseState.players[uid], gems: preparedGems } } };
  await serverRef.set(preparedState);
  await gameRef.set(toPublicGameView(preparedState));
  await waitFor(() => evaluate(`(() => {
    const card = document.querySelector('.market-row--level-1 .market-card');
    return Boolean(card && !card.disabled && document.querySelector('.multiplayer-self [data-held-color="white"]'));
  })()`), '구매 준비 표시');
  const flightsBeforeBuy = await evaluate('window.__rewardFlights.length');
  await evaluate(`(() => {
    document.querySelector('.market-row--level-1 .market-card').click();
    return true;
  })()`);
  await waitFor(() => evaluate("document.querySelector('.multiplayer-card-dialog__actions button:not(:disabled)') !== null"), '구매 모달');
  await evaluate("document.querySelector('.multiplayer-card-dialog__actions button').click()");
  await waitFor(async () => (await serverRef.get()).data().version === 4, '카드 구매 확정');
  await waitFor(() => evaluate(`window.__rewardFlights.slice(${flightsBeforeBuy})
    .some(value => value.includes('card-face__bonus') && value.includes('board-reward--gem'))`),
    '카드 보너스 보석 이동');
  assert.ok((await gameRef.get()).data().players[uid].purchasedCardIds.includes(purchaseCard.id));
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.multiplayer-table .market-card')).transitionDuration"), '0s');
  await serverRef.update({ turnIndex: 0 });
  await gameRef.update({ turnIndex: 0 });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('.market-row__reserve-deck')).some(button => !button.disabled)"),
    '움직임 줄이기 예약 행동');
  const flightsBeforeReducedMotion = await evaluate('window.__rewardFlights.length');
  await evaluate("Array.from(document.querySelectorAll('.market-row__reserve-deck')).find(button => !button.disabled).click()");
  await waitFor(async () => (await serverRef.get()).data().version === 5, '움직임 줄이기 예약 확정');
  await waitFor(() => evaluate("document.querySelector('.multiplayer-self__reserved h3')?.textContent.includes('3/3')"),
    '움직임 줄이기 상태 반영');
  assert.equal(await evaluate('window.__rewardFlights.length'), flightsBeforeReducedMotion,
    '움직임 줄이기에서 보석 이동 생략');
  await command('Page.navigate', { url: `${web}/game/AAAAAAAA` });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('방 다시 불러오기'))"),
    '게임판 오류 재시도 버튼');
  await evaluate("Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('방 다시 불러오기')).click()");
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('방 다시 불러오기'))"),
    '게임판 오류 재시도 완료');
  await command('Page.navigate', { url: `${web}/rooms/AAAAAAAA` });
  await waitFor(() => evaluate("Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('방 다시 불러오기'))"),
    '대기실 오류 재시도 버튼');
  await command('Network.enable');
  await command('Network.setBlockedURLs', { urls: ['*127.0.0.1:8080*'] });
  await command('Page.navigate', { url: `${web}/lobby` });
  await waitFor(() => evaluate("document.body?.innerText.includes('익명 로그인 완료')"), '연결 오류 테스트 로그인');
  await evaluate(`(() => {
    const input = document.querySelector('#player-nickname');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'ReconnectTester');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('새 방 만들기')).click();
    return true;
  })()`);
  await waitFor(() => dialogs.length > 0, 'Firestore 연결 오류 알림');
  assert.ok(dialogs.at(-1).includes('로컬 Firestore 에뮬레이터'), dialogs.at(-1));
  await command('Page.handleJavaScriptDialog', { accept: true });
  await waitFor(() => evaluate("document.body?.innerText.includes('로컬 Firestore 에뮬레이터에 연결할 수 없습니다') && !Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('새 방 만들기')).disabled"),
    '연결 오류 표시와 버튼 복구');
  await command('Network.setBlockedURLs', { urls: [] });
  console.log(`Chrome ${playerCount}인 재접속·연속 클릭·PC/모바일 세로형 카드·보석/예약/구매 이동·키보드·움직임 줄이기·오류 재시도 통과 (${roomCode}; PC 하단 ${Math.round(desktop.selfBottom)}px)`);
} finally {
  socket.close();
}

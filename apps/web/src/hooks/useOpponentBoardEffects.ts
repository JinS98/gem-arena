import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { countCardBonuses, getDevelopmentCard, getNoble } from '@gem-arena/engine';
import type { CardLevel, Gem, GemColor, Inventory, PublicGameView } from '@gem-arena/engine';
import { captureRewardSource, flyBoardReward, pulseBoardTarget, type RewardSource } from '../animations/boardReward';
import { flyMarketDeal } from '../animations/marketDeal';
import { opponentBoardEvents } from '../animations/opponentBoardEvents';

export interface OpponentPlayerAnimation {
  gem?: { previous: Inventory; arrived: Inventory; phase: 'flying' | 'arrived'; direction?: 'incoming' | 'outgoing' };
  bonus?: { color: GemColor; previousCount: number; phase: 'flying' | 'arrived' };
  score?: { previous: number; phase: 'flying' | 'arrived' };
}
export interface OpponentMarketRefill { level: CardLevel; slot: number; phase: 'empty' | 'revealing' }
const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
const colors: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const playerElement = (uid: string, selector: string) => document.querySelector<HTMLElement>(`[data-player-id="${uid}"] ${selector}`);

function captureBoard(game: PublicGameView): Map<string, RewardSource> {
  const sources = new Map<string, RewardSource>();
  const add = (key: string, element: HTMLElement | null) => {
    const source = captureRewardSource(element);
    if (source) sources.set(key, source);
  };
  for (const color of colors) add(`bank:${color}`, document.querySelector(`.multiplayer-actions [data-bank-color="${color}"] .gem-icon`));
  for (const uid of game.playerOrder) {
    for (const color of colors) add(`held:${uid}:${color}`, playerElement(uid, `[data-held-color="${color}"] .gem-icon`));
    add(`reserved:${uid}`, playerElement(uid, '.player-panel__status'));
  }
  for (const level of [3, 2, 1] as const) {
    const row = document.querySelector<HTMLElement>(`.multiplayer-table .market-row--level-${level}`);
    const deck = row?.querySelector<HTMLElement>('.market-deck') ?? null;
    add(`deck:${level}`, deck);
    if (deck) for (const name of ['--deck-top', '--deck-bottom', '--deck-accent']) {
      sources.get(`deck:${level}`)?.node.style.setProperty(name, getComputedStyle(deck).getPropertyValue(name));
    }
    game.market[level].forEach((id, slot) => {
      if (id) add(`bonus:${id}`, row?.querySelector<HTMLElement>(`.market-row__cards > :nth-child(${slot + 1}) .card-face__bonus`) ?? null);
    });
  }
  document.querySelectorAll<HTMLElement>('.multiplayer-table [data-noble-id]').forEach(element => add(`noble:${element.dataset.nobleId}`, element));
  return sources;
}

/** Own actions keep their existing request/response effects; this handles remote changes. */
export function useOpponentBoardEffects(roomId: string | undefined, myUid: string, game: PublicGameView | null, ready: boolean) {
  const [players, setPlayers] = useState<Record<string, OpponentPlayerAnimation>>({});
  const [refills, setRefills] = useState<Record<string, OpponentMarketRefill>>({});
  const previous = useRef<{ roomId: string; uid: string; game: PublicGameView; sources: Map<string, RewardSource>; scrollX: number; scrollY: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!ready || !game || !roomId || !myUid) return;
    const before = previous.current;
    if (before?.roomId === roomId && before.uid === myUid && before.game.version === game.version) return;
    previous.current = { roomId, uid: myUid, game, sources: captureBoard(game), scrollX: window.scrollX, scrollY: window.scrollY };
    controller.current?.abort();
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setPlayers({}); setRefills({});
    if (!before || before.roomId !== roomId || before.uid !== myUid) return;
    const events = opponentBoardEvents(before.game, game, myUid);
    if (!events.length) return;
    const run = new AbortController();
    controller.current = run;
    const signal = run.signal;
    // Each chip gets a fresh node, including two chips of the same color.
    const source = (key: string): RewardSource | null => {
      const stored = before.sources.get(key);
      if (!stored) return null;
      const move = (rect: DOMRect) => new DOMRect(rect.x + before.scrollX - window.scrollX, rect.y + before.scrollY - window.scrollY, rect.width, rect.height);
      return { node: stored.node.cloneNode(true) as HTMLElement, rect: move(stored.rect), focusRect: stored.focusRect ? move(stored.focusRect) : null };
    };
    const update = (uid: string, change: (state: OpponentPlayerAnimation) => OpponentPlayerAnimation) => {
      if (!signal.aborted) setPlayers(current => ({ ...current, [uid]: change(current[uid] ?? {}) }));
    };
    const flights: Promise<unknown>[] = [];
    for (const uid of game.playerOrder.filter(uid => uid !== myUid)) {
      const gemEvents = events.filter(event => event.kind === 'gem' && event.playerId === uid);
      if (gemEvents.length) {
        const incoming = gemEvents.every(event => event.kind === 'gem' && event.incoming);
        update(uid, state => ({ ...state, gem: { previous: before.game.players[uid].gems, arrived: emptyInventory(), phase: 'flying', direction: incoming ? 'incoming' : 'outgoing' } }));
        const chips = gemEvents.flatMap(event => event.kind === 'gem' ? Array.from({ length: event.count }, () => event) : []);
        flights.push(Promise.all(chips.map(async (event, index) => {
          if (index) await new Promise(resolve => setTimeout(resolve, index * 130));
          if (signal.aborted) return;
          const target = event.incoming ? playerElement(uid, `[data-held-color="${event.color}"]`)
            : document.querySelector<HTMLElement>(`.multiplayer-actions [data-bank-color="${event.color}"] .gem-icon`);
          await flyBoardReward(source(event.incoming ? `bank:${event.color}` : `held:${uid}:${event.color}`), target, 'gem', signal);
          if (!event.incoming) pulseBoardTarget(target, signal);
          update(uid, state => state.gem ? { ...state, gem: { ...state.gem, arrived: { ...state.gem.arrived, [event.color]: state.gem.arrived[event.color] + 1 } } } : state);
        })).then(() => update(uid, state => state.gem ? { ...state, gem: { ...state.gem, phase: 'arrived' } } : state)));
      }
    }
    const pendingRefills: Record<string, OpponentMarketRefill> = {};
    for (const event of events) {
      if (event.kind === 'purchase') {
        const card = getDevelopmentCard(event.cardId);
        if (!card) continue;
        const uid = event.playerId;
        const target = playerElement(uid, `[data-bonus-color="${card.bonusColor}"]`);
        let bonus = source(`bonus:${event.cardId}`);
        // A reserved card becomes public only on purchase. Start its now-public bonus at the reservation count.
        if (!bonus) {
          bonus = captureRewardSource(target?.querySelector<HTMLElement>('.gem-icon') ?? null);
          const reserved = source(`reserved:${uid}`);
          if (bonus && reserved) bonus.rect = reserved.rect;
        }
        update(uid, state => ({ ...state, bonus: { color: card.bonusColor, previousCount: countCardBonuses(before.game.players[uid].purchasedCardIds)[card.bonusColor], phase: 'flying' } }));
        flights.push(flyBoardReward(bonus, target, 'gem', signal).then(() => update(uid, state => state.bonus ? { ...state, bonus: { ...state.bonus, phase: 'arrived' } } : state)));
      } else if (event.kind === 'noble') {
        const uid = event.playerId;
        update(uid, state => ({ ...state, score: { previous: game.players[uid].score - (getNoble(event.nobleId)?.points ?? 0), phase: 'flying' } }));
        flights.push(flyBoardReward(source(`noble:${event.nobleId}`), playerElement(uid, '.player-panel__score'), 'noble', signal)
          .then(() => update(uid, state => state.score ? { ...state, score: { ...state.score, phase: 'arrived' } } : state)));
      } else if (event.kind === 'reserve') {
        const level = event.cardId ? getDevelopmentCard(event.cardId)?.level : event.level;
        const back = source(`deck:${level ?? 1}`);
        if (back) flights.push(flyReservationBack(back, playerElement(event.playerId, '.player-panel__status'), signal));
      } else if (event.kind === 'refill') {
        pendingRefills[`${event.level}-${event.slot}`] = { level: event.level, slot: event.slot, phase: 'empty' };
      }
    }
    setRefills(pendingRefills);
    void Promise.all(flights).then(() => {
      if (!signal.aborted) settleTimer.current = setTimeout(() => { if (!signal.aborted) setPlayers({}); }, 700);
    });
  }, [game, roomId, myUid, ready]);

  useEffect(() => {
    const entries = Object.entries(refills);
    if (!entries.length) return;
    const run = new AbortController();
    if (entries.some(([, refill]) => refill.phase === 'empty')) {
      void Promise.all(entries.map(async ([, refill]) => {
        const row = document.querySelector<HTMLElement>(`.multiplayer-table .market-row--level-${refill.level}`);
        await flyMarketDeal(row?.querySelector('.market-deck') ?? null,
          row?.querySelector(`.market-row__cards > :nth-child(${refill.slot + 1})`) ?? null, run.signal);
      })).then(() => {
        if (!run.signal.aborted) setRefills(current => Object.fromEntries(Object.entries(current).map(([key, refill]) => [key, { ...refill, phase: 'revealing' }])));
      });
      return () => run.abort();
    }
    const timer = setTimeout(() => setRefills({}), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 440);
    return () => { run.abort(); clearTimeout(timer); };
  }, [refills]);

  useEffect(() => () => { controller.current?.abort(); if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  useEffect(() => {
    const recapture = () => {
      const snapshot = previous.current;
      if (snapshot) previous.current = { ...snapshot, sources: captureBoard(snapshot.game), scrollX: window.scrollX, scrollY: window.scrollY };
    };
    window.addEventListener('resize', recapture);
    return () => window.removeEventListener('resize', recapture);
  }, []);
  return { players, refills };
}

async function flyReservationBack(source: RewardSource, target: HTMLElement | null, signal: AbortSignal) {
  if (!target || signal.aborted || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const visual = source.node;
  visual.classList.add('market-deal-flight');
  visual.removeAttribute('disabled');
  visual.setAttribute('tabindex', '-1');
  visual.inert = true;
  visual.setAttribute('aria-hidden', 'true');
  Object.assign(visual.style, { left: `${source.rect.left}px`, top: `${source.rect.top}px`, width: `${source.rect.width}px`, height: `${source.rect.height}px` });
  document.body.append(visual);
  const to = target.getBoundingClientRect();
  const dx = to.left + to.width / 2 - source.rect.left - source.rect.width / 2;
  const dy = to.top + to.height / 2 - source.rect.top - source.rect.height / 2;
  const animation = visual.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * .5}px,${dy * .35 - 35}px) scale(.8) rotate(-8deg)`, opacity: 1, offset: .5 },
    { transform: `translate(${dx}px,${dy}px) scale(.15)`, opacity: 0 },
  ], { duration: 670, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'forwards' });
  const abort = () => animation.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try { await animation.finished; } catch { /* Navigation or a newer state cancels presentation only. */ }
  finally { signal.removeEventListener('abort', abort); visual.remove(); }
}

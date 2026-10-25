import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getDevelopmentCard } from '@gem-arena/engine';
import { tabletopEvents, type TabletopSnapshot } from '../animations/tabletopEvents';
import { TabletopAudio } from '../services/tabletopAudio';

interface CapturedPiece { rect: DOMRect; node: HTMLElement }
function capture(element: HTMLElement): CapturedPiece {
  const node = element.cloneNode(true) as HTMLElement;
  const style = getComputedStyle(element);
  for (const name of ['--deck-top', '--deck-bottom', '--deck-accent']) node.style.setProperty(name, style.getPropertyValue(name));
  return { rect: element.getBoundingClientRect(), node };
}
function readSetting(name: string) {
  try { return localStorage.getItem(`gem-arena-3d-${name}`) === 'true'; }
  catch { return false; }
}

/** A presentation-only surface. It observes confirmed engine states, never mutates them. */
export function TabletopScene({ game, children, multiplayer = false }: { game: TabletopSnapshot; children: ReactNode; multiplayer?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previous = useRef<{ game: TabletopSnapshot; pieces: Map<string, CapturedPiece> } | null>(null);
  const animations = useRef(new Set<Animation>());
  const flights = useRef(new Set<HTMLElement>());
  const audio = useRef(new TabletopAudio());
  const [sound, setSound] = useState(() => readSetting('sound'));
  const [reduced, setReduced] = useState(() => readSetting('reduced'));
  const [activity, setActivity] = useState('테이블이 준비되었습니다. 카드나 보석을 선택해 보세요.');
  const settings = useRef({ sound, reduced });
  settings.current = { sound, reduced };
  const cancelEffects = useCallback(() => {
    animations.current.forEach(animation => animation.cancel());
    animations.current.clear();
    flights.current.forEach(node => node.remove());
    flights.current.clear();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('gem-arena-3d-sound', String(sound));
      localStorage.setItem('gem-arena-3d-reduced', String(reduced));
    } catch { /* Optional persistence. */ }
    if (reduced) cancelEffects();
  }, [sound, reduced, cancelEffects]);
  useEffect(() => () => { cancelEffects(); audio.current.close(); }, [cancelEffects]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const pieces = new Map<string, CapturedPiece>();
    root.querySelectorAll<HTMLElement>('.market-section [data-tabletop-card],.tabletop-dialog [data-tabletop-card]').forEach(element => {
      pieces.set(`card:${element.dataset.tabletopCard}`, capture(element));
    });
    root.querySelectorAll<HTMLElement>('[data-bank-color]').forEach(element => {
      const icon = element.querySelector<HTMLElement>('.gem-icon');
      if (icon) pieces.set(`bank:${element.dataset.bankColor}`, capture(icon));
    });
    root.querySelectorAll<HTMLElement>('[data-noble-id]').forEach(element => pieces.set(`noble:${element.dataset.nobleId}`, capture(element)));
    root.querySelectorAll<HTMLElement>('[data-tabletop-deck]').forEach(element => pieces.set(`deck:${element.dataset.tabletopDeck}`, capture(element)));
    root.querySelectorAll<HTMLElement>('[data-player-id]').forEach(player => {
      player.querySelectorAll<HTMLElement>('[data-held-color]').forEach(element => {
        const icon = element.querySelector<HTMLElement>('.gem-icon');
        if (icon) pieces.set(`held:${player.dataset.playerId}:${element.dataset.heldColor}`, capture(icon));
      });
    });
    const before = previous.current;
    // Dialogs and hover settings can change without a new game version.
    if (before?.game.version === game.version) {
      previous.current = { game, pieces: new Map([...before.pieces, ...pieces]) };
      return;
    }
    previous.current = { game, pieces };
    if (!before) return;
    const events = tabletopEvents(before.game, game);
    cancelEffects();
    if (!events.length) return;
    const summary = events.some(event => event.kind === 'finish') ? '게임 종료 · 최종 점수를 확인하세요'
      : events.some(event => event.kind === 'noble') ? '귀족 방문 · 점수가 올라갔습니다'
      : events.some(event => event.kind === 'purchase') ? '구매 완료 · 영구 할인 +1'
      : events.some(event => event.kind === 'reserve') ? '예약 완료 · 예약 카드에 보관했습니다'
      : events.some(event => event.kind === 'gem' && !event.incoming) ? '보석을 은행으로 반환했습니다'
      : '보석을 받았습니다 · 다음 차례를 확인하세요';
    setActivity(summary);
    const motionOff = settings.current.reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const track = (animation: Animation) => {
      animations.current.add(animation);
      void animation.finished.catch(() => {}).finally(() => animations.current.delete(animation));
      return animation;
    };
    const targetFor = (uid: string, selector: string) =>
      root.querySelector<HTMLElement>(`[data-player-id="${uid}"] ${selector}`);
    const flash = (element: HTMLElement | null, delay = 0) => {
      if (!element || motionOff) return;
      track(element.animate([
        { filter: 'brightness(1)', transform: 'translateY(0)' },
        { filter: 'brightness(1.5)', transform: 'translateY(-3px)', offset: .35 },
        { filter: 'brightness(1)', transform: 'translateY(0)' },
      ], { duration: 500, delay, easing: 'ease-out' }));
    };
    const fly = (piece: CapturedPiece | undefined, target: HTMLElement | null, kind: 'chip' | 'card' | 'noble', delay = 0) => {
      if (!piece || !target || motionOff || piece.rect.width === 0) return;
      const to = target.getBoundingClientRect();
      const node = piece.node.cloneNode(true) as HTMLElement;
      node.removeAttribute('id');
      node.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'));
      node.inert = true;
      node.setAttribute('aria-hidden', 'true');
      node.classList.add('tabletop-flight', `tabletop-flight--${kind}`);
      Object.assign(node.style, {
        left: `${piece.rect.left}px`, top: `${piece.rect.top}px`,
        width: `${piece.rect.width}px`, height: `${piece.rect.height}px`,
      });
      root.append(node);
      flights.current.add(node);
      const dx = to.left + to.width / 2 - piece.rect.left - piece.rect.width / 2;
      const dy = to.top + to.height / 2 - piece.rect.top - piece.rect.height / 2;
      const isCard = kind !== 'chip';
      const animation = track(node.animate([
        { transform: 'perspective(900px) translate3d(0,0,0) rotateX(0) rotateZ(0) scale(1)', opacity: 0 },
        { transform: `perspective(900px) translate3d(${dx * .08}px,${-28 + dy * .04}px,65px) rotateX(12deg) rotateZ(-5deg) scale(${isCard ? 1.12 : 1.4})`, opacity: 1, offset: .22 },
        { transform: `perspective(900px) translate3d(${dx * .62}px,${dy * .42 - 55}px,90px) rotateX(-9deg) rotateZ(9deg) scale(${isCard ? .85 : 1.22})`, opacity: 1, offset: .6 },
        { transform: `perspective(900px) translate3d(${dx}px,${dy}px,0) rotateX(0) rotateZ(0) scale(${isCard ? .14 : .7})`, opacity: 0 },
      ], { duration: isCard ? 900 : 590, delay, easing: 'cubic-bezier(.22,.65,.25,1)', fill: 'both' }));
      void animation.finished.catch(() => {}).finally(() => { node.remove(); flights.current.delete(node); });
      flash(target, delay + (isCard ? 720 : 440));
    };
    for (const event of events) {
      if (event.kind === 'gem') {
        const bank = root.querySelector<HTMLElement>(`[data-bank-color="${event.color}"] .gem-icon`);
        const held = targetFor(event.playerId, `[data-held-color="${event.color}"]`);
        for (let index = 0; index < Math.min(4, event.count); index++) {
          fly(event.incoming ? before.pieces.get(`bank:${event.color}`) : before.pieces.get(`held:${event.playerId}:${event.color}`),
            event.incoming ? held : bank, 'chip', index * 60);
        }
      } else if (event.kind === 'purchase') {
        const card = getDevelopmentCard(event.cardId);
        fly(before.pieces.get(`card:${event.cardId}`) ?? before.pieces.get(`deck:${card?.level ?? 1}`),
          targetFor(event.playerId, `[data-bonus-color="${card?.bonusColor ?? 'green'}"]`), 'card', 70);
      } else if (event.kind === 'reserve') {
        const source = event.cardId ? before.pieces.get(`card:${event.cardId}`) : before.pieces.get(`deck:${event.level ?? 1}`);
        fly(source, root.querySelector<HTMLElement>(event.playerId === 'demo-me' ? '.tabletop-reserved-trigger' : `[data-player-id="${event.playerId}"] .player-panel__status`), 'card', 60);
      } else if (event.kind === 'noble') {
        fly(before.pieces.get(`noble:${event.nobleId}`), targetFor(event.playerId, '.player-panel__score'), 'noble', 160);
      } else if (event.kind === 'refill') {
        const card = root.querySelector<HTMLElement>(`.market-section [data-tabletop-card="${event.cardId}"]`);
        if (card && !motionOff) track(card.animate([
          { transform: 'perspective(900px) rotateY(-90deg) translateY(-14px)', opacity: 0 },
          { transform: 'perspective(900px) rotateY(0) translateY(0)', opacity: 1 },
        ], { duration: 460, delay: 390, easing: 'ease-out', fill: 'backwards' }));
      } else if (event.kind === 'turn') flash(root.querySelector(`[data-player-id="${event.playerId}"]`), 500);
    }
    if (settings.current.sound) audio.current.play(events.some(event => event.kind === 'noble') ? 'noble'
      : events.some(event => event.kind === 'purchase' || event.kind === 'reserve') ? 'card' : 'chip');
  });

  const resetTilt = (element: HTMLElement) => {
    element.style.removeProperty('--tilt-x');
    element.style.removeProperty('--tilt-y');
    element.style.removeProperty('--shine-x');
  };
  return <div className={`${multiplayer ? 'multiplayer-preview' : 'tabletop-example'}${reduced ? ' tabletop-example--still' : ''}`} ref={rootRef}
    onPointerDown={event => {
      if (!sound) return;
      audio.current.unlock();
      if ((event.target as HTMLElement).closest('.market-card,.gem-bank__button')) audio.current.play('pick');
    }}
    onKeyDown={() => { if (sound) audio.current.unlock(); }}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse' || reduced || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const card = (event.target as HTMLElement).closest<HTMLElement>('.market-card:not(:disabled)');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--tilt-x', `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 7}deg`);
      card.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 8}deg`);
      card.style.setProperty('--shine-x', `${(event.clientX - rect.left) / rect.width * 100}%`);
    }}
    onPointerOut={event => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.market-card');
      if (card && (!(event.relatedTarget instanceof Node) || !card.contains(event.relatedTarget))) resetTilt(card);
    }}>
    <div className="tabletop-settings"><span><i aria-hidden="true" />LIVE PREVIEW <small>멀티 화면 · 혼자 체험</small></span>
      <div><button type="button" aria-pressed={sound} onClick={() => { if (!sound) audio.current.unlock(); setSound(!sound); }}>효과음 {sound ? '켜짐' : '꺼짐'}</button>
        <button type="button" aria-pressed={reduced} onClick={() => setReduced(!reduced)}>움직임 줄이기 {reduced ? '켜짐' : '꺼짐'}</button></div></div>
    {children}
    <div className="tabletop-activity" role="status" aria-live="polite"><span aria-hidden="true">✧</span>{activity}</div>
  </div>;
}

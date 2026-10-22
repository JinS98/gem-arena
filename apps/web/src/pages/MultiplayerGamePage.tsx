import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CARD_COLORS, canPayForCard, canTakeGems, countCardBonuses, excessGemCount,
  getDevelopmentCard, getNoble, remainingCardCost,
} from '@gem-arena/engine';
import type {
  CardLevel, DevelopmentCard, GameAction, Gem, GemColor, Inventory,
  PublicGameView, PublicPlayerView,
} from '@gem-arena/engine';
import { doc, onSnapshot } from 'firebase/firestore';
import { captureRewardSource, flyBoardReward, type RewardSource } from '../animations/boardReward';
import { flyMarketDeal } from '../animations/marketDeal';
import { DeckCard } from '../components/DeckCard';
import { GemBank } from '../components/GemBank';
import { GemIcon, gemNames } from '../components/GemIcon';
import { CardFace, MarketCard } from '../components/MarketCard';
import { ForfeitChoiceDialog, MultiplayerVictoryDialog, type ForfeitDestination } from '../components/MultiplayerExitDialogs';
import { NobleGallery } from '../components/NobleGallery';
import { PlayerPanel } from '../components/PlayerPanel';
import type { PreviewPlayer } from '../data/previewGame';
import { submitGameAction, type SubmitGameActionRequest } from '../services/gameActions';
import { getFirebase } from '../services/firebase';
import { subscribeMyGameViews, type GameViewUpdate, type MyGameViews } from '../services/gameViews';
import { ensureAnonymousSession } from '../services/playerIdentity';
import { leaveRoom, roomErrorMessage, type WaitingRoom } from '../services/rooms';

const levels: CardLevel[] = [3, 2, 1];
const gems: Gem[] = [...CARD_COLORS, 'gold'];
const emptyInventory = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });
type CardSelection = { cardId: string; source: 'market' | 'reserved' };
type MarketRefill = { level: CardLevel; slot: number; purchasedId: string; version: number; phase: 'empty' | 'revealing' };
type PlayerGemAnimation = { previous: Inventory; arrived: Inventory; phase: 'flying' | 'arrived'; direction?: 'incoming' | 'outgoing' };
type PlayerBonusAnimation = { color: GemColor; previousCount: number; phase: 'flying' | 'arrived' };
type RewardCapture = {
  player: PublicPlayerView;
  action: Exclude<GameAction, { type: 'TIMEOUT' }>;
  gems: Partial<Record<Gem, RewardSource>>;
  returns: Partial<Record<Gem, RewardSource[]>>;
  bonus: RewardSource | null;
  nobles: Record<string, RewardSource>;
};

function captureActionRewards(player: PublicPlayerView, action: RewardCapture['action']): RewardCapture {
  const colors: Gem[] = action.type === 'TAKE_GEMS' ? action.colors
    : action.type === 'RESERVE_CARD' ? ['gold'] : [];
  const sources: RewardCapture['gems'] = {};
  for (const color of colors) {
    const source = captureRewardSource(document.querySelector<HTMLElement>(`[data-bank-color="${color}"] .gem-icon`));
    if (source) sources[color] = source;
  }
  const returns: RewardCapture['returns'] = {};
  if (action.type === 'DISCARD_GEMS') {
    for (const color of gems) {
      const element = document.querySelector<HTMLElement>(`.multiplayer-self [data-held-color="${color}"] .gem-icon`);
      returns[color] = Array.from({ length: action.gems[color] }, () => captureRewardSource(element))
        .filter((source): source is RewardSource => source !== null);
    }
  }
  const nobles: RewardCapture['nobles'] = {};
  document.querySelectorAll<HTMLElement>('[data-noble-id]').forEach(element => {
    const source = captureRewardSource(element);
    if (source) nobles[element.dataset.nobleId ?? ''] = source;
  });
  return { player, action, gems: sources, returns,
    bonus: action.type === 'BUY_CARD'
      ? captureRewardSource(document.querySelector<HTMLElement>('.multiplayer-card-dialog .card-face__bonus')) : null,
    nobles };
}

function displayedPlayer(uid: string, player: PublicPlayerView, room: WaitingRoom, myUid: string): PreviewPlayer {
  const name = room.players[uid]?.nickname ?? `플레이어 ${player.seatIndex + 1}`;
  return {
    id: uid, name, initials: name.slice(0, 1), isLocal: uid === myUid,
    score: player.score, gems: player.gems,
    bonuses: countCardBonuses(player.purchasedCardIds),
    purchasedCount: player.purchasedCardIds.length, reservedCount: player.reservedCount,
  };
}

function suggestedPayment(card: DevelopmentCard, player: PublicPlayerView): Inventory {
  const remaining = remainingCardCost(card.cost, countCardBonuses(player.purchasedCardIds));
  const payment = emptyInventory();
  for (const color of CARD_COLORS) payment[color] = Math.min(remaining[color], player.gems[color]);
  payment.gold = CARD_COLORS.reduce((sum, color) => sum + remaining[color] - payment[color], 0);
  return payment;
}

function actionErrorMessage(error: unknown): string {
  const value = error && typeof error === 'object' ? error as { code?: string; details?: { reason?: string } } : {};
  switch (value.details?.reason) {
    case 'VERSION_CONFLICT': return '다른 행동이 먼저 확정되었습니다. 최신 게임 상태를 확인해 주세요.';
    case 'NOT_YOUR_TURN': return '현재는 다른 플레이어의 차례입니다.';
    case 'INVALID_ACTION': return '현재 상태에서 이 행동을 할 수 없습니다. 보석·카드 조건을 확인해 주세요.';
    case 'GAME_NOT_STARTED': return '게임 상태가 아직 준비되지 않았습니다.';
    case 'NOT_ROOM_MEMBER': return '이 방의 참가자가 아닙니다.';
    case 'GAME_FINISHED': return '이미 종료된 게임입니다.';
    case 'ACTION_ID_REUSED': return '요청 ID가 이미 다른 행동에 사용되었습니다.';
  }
  if (value.code === 'functions/unavailable' || value.code === 'functions/deadline-exceeded') {
    return '서버 응답을 확인하지 못했습니다. 같은 요청으로 다시 시도할 수 있습니다.';
  }
  return '행동을 처리하지 못했습니다. 연결 상태와 게임판을 확인해 주세요.';
}

function confirmedActionMessage(type: Exclude<GameAction, { type: 'TIMEOUT' }>['type']): string {
  switch (type) {
    case 'TAKE_GEMS': return '보석 획득이 게임판에 반영되었습니다.';
    case 'BUY_CARD': return '카드 구매가 게임판에 반영되었습니다.';
    case 'RESERVE_CARD': return '카드 예약이 게임판에 반영되었습니다.';
    case 'DISCARD_GEMS': return '보석 반환이 게임판에 반영되었습니다.';
    case 'CHOOSE_NOBLE': return '귀족 방문이 게임판에 반영되었습니다.';
    case 'PASS': return '패스가 게임판에 반영되었습니다.';
  }
}

function gameReadErrorMessage(error: Error): string {
  const code = 'code' in error ? error.code : null;
  if (code === 'permission-denied') {
    return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
      ? '게임 문서 읽기가 로컬 Firestore 규칙에서 거부되었습니다. 에뮬레이터가 이 저장소의 firestore.rules로 실행 중인지 확인해 주세요.'
      : '실제 Firebase에는 멀티 게임판의 조회 규칙과 게임 서버가 아직 배포되지 않았습니다. 현재는 로컬 에뮬레이터에서 멀티 게임을 확인할 수 있습니다.';
  }
  return '게임 상태를 읽지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}

function MultiplayerCardDialog({ card, source, player, bankGold, canAct, busy, error, onClose, onAction }: {
  card: DevelopmentCard;
  source: CardSelection['source'];
  player: PublicPlayerView;
  bankGold: number;
  canAct: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onAction: (action: Exclude<GameAction, { type: 'TIMEOUT' }>) => Promise<boolean>;
}) {
  const [payment, setPayment] = useState(() => suggestedPayment(card, player));
  const [purchasePhase, setPurchasePhase] = useState<'idle' | 'submitting' | 'confirmed'>('idle');
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bonuses = countCardBonuses(player.purchasedCardIds);
  const remaining = remainingCardCost(card.cost, bonuses);
  const canBuy = canAct && canPayForCard(card.cost, bonuses, player.gems, payment);
  const canReserve = canAct && source === 'market' && player.reservedCount < 3;

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && purchasePhase === 'idle') onClose();
      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose, purchasePhase]);

  function changePayment(color: GemColor, delta: -1 | 1) {
    setPayment(current => {
      const next = current[color] + delta;
      if (next < 0 || next > Math.min(remaining[color], player.gems[color])) return current;
      return { ...current, [color]: next, gold: current.gold - delta };
    });
  }

  async function act(action: Exclude<GameAction, { type: 'TIMEOUT' }>) {
    if (await onAction(action)) onClose();
  }

  async function buy() {
    if (!canBuy || busy || purchasePhase !== 'idle') return;
    setPurchasePhase('submitting');
    const confirmed = await onAction({ type: 'BUY_CARD', cardId: card.id, source, payment });
    if (!confirmed) { setPurchasePhase('idle'); return; }
    setPurchasePhase('confirmed');
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      await new Promise(resolve => window.setTimeout(resolve, 560));
    }
    onClose();
  }

  return <div className="multiplayer-card-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy && purchasePhase === 'idle') onClose();
  }}>
    <section ref={dialogRef} className={`multiplayer-card-dialog multiplayer-card-dialog--${purchasePhase}`} role="dialog" aria-modal="true" aria-busy={purchasePhase === 'submitting'} aria-labelledby="multi-card-title" aria-describedby="multi-card-summary">
      <div className="multiplayer-card-dialog__heading"><div><span className="eyebrow">LEVEL {card.level} · {source === 'market' ? 'MARKET' : 'MY RESERVATION'}</span><h2 id="multi-card-title">{gemNames[card.bonusColor]} 개발 카드</h2></div><button ref={closeButtonRef} type="button" onClick={() => { if (!busy && purchasePhase === 'idle') onClose(); }} disabled={busy || purchasePhase !== 'idle'} aria-label="카드 창 닫기">×</button></div>
      <div className="multiplayer-card-dialog__body">
        <div className="multiplayer-card-dialog__face"><CardFace card={card} /></div>
        <div className="multiplayer-card-dialog__details">
          <p id="multi-card-summary">{card.points}점 · {gemNames[card.bonusColor]} 영구 할인 1개</p>
          <div className="multiplayer-card-dialog__costs" aria-label="카드 구매 비용">
            {CARD_COLORS.filter(color => card.cost[color] > 0).map(color => <div key={color}>
              <span className={`gem-box gem-box--${color}`}><GemIcon color={color} small />{gemNames[color]}</span>
              <span>비용 {card.cost[color]} − 할인 {card.cost[color] - remaining[color]} = <strong>{remaining[color]}</strong></span>
              <span>보유 {player.gems[color]}</span>
              <div className="multiplayer-card-dialog__stepper"><button type="button" onClick={() => changePayment(color, -1)} disabled={busy || payment[color] === 0} aria-label={`${gemNames[color]} 사용량 줄이기`}>−</button><strong>{payment[color]}</strong><button type="button" onClick={() => changePayment(color, 1)} disabled={busy || payment[color] >= Math.min(remaining[color], player.gems[color])} aria-label={`${gemNames[color]} 사용량 늘리기`}>+</button></div>
            </div>)}
          </div>
          <p className="multiplayer-card-dialog__gold"><GemIcon color="gold" small /> 황금 대체 {payment.gold}개 · 보유 {player.gems.gold}개</p>
          <div className="multiplayer-card-dialog__actions"><button type="button" onClick={() => void buy()} disabled={!canBuy || busy || purchasePhase !== 'idle'}>{purchasePhase === 'submitting' ? '구매 처리 중…' : purchasePhase === 'confirmed' ? '구매 완료' : '이 보석으로 구매'}</button>{source === 'market' && <button type="button" onClick={() => void act({ type: 'RESERVE_CARD', cardId: card.id })} disabled={!canReserve || busy || purchasePhase !== 'idle'}>예약{bankGold > 0 ? ' · 황금 +1' : ''}</button>}</div>
          {purchasePhase !== 'idle' && <p className="multiplayer-card-dialog__status" role="status">{purchasePhase === 'submitting' ? '카드 구매를 확인하고 있습니다…' : '구매 완료! 시장을 갱신합니다.'}</p>}
          {error && purchasePhase === 'idle' && <p className="multiplayer-card-dialog__error" role="alert">{error}</p>}
          {purchasePhase === 'idle' && !canAct && <p>현재는 카드를 확인할 수 있습니다. 자신의 차례가 되면 행동할 수 있습니다.</p>}
          {purchasePhase === 'idle' && canAct && !canBuy && <p>선택한 결제 수량으로는 구매할 수 없습니다.</p>}
        </div>
      </div>
    </section>
  </div>;
}

export function MultiplayerGamePage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [myUid, setMyUid] = useState('');
  const [room, setRoom] = useState<WaitingRoom | null>(null);
  const [update, setUpdate] = useState<GameViewUpdate>({ status: 'loading', views: null, fromCache: false });
  const [roomError, setRoomError] = useState('');
  const [viewError, setViewError] = useState('');
  const [roomRetry, setRoomRetry] = useState(0);
  const [viewRetry, setViewRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const [forfeitError, setForfeitError] = useState('');
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const [confirmedAction, setConfirmedAction] = useState<{
    version: number; reward: RewardCapture;
  } | null>(null);
  const [gemAnimation, setGemAnimation] = useState<PlayerGemAnimation | null>(null);
  const [bonusAnimation, setBonusAnimation] = useState<PlayerBonusAnimation | null>(null);
  const [takeFeedback, setTakeFeedback] = useState<'requesting' | 'syncing' | null>(null);
  const [returnFeedback, setReturnFeedback] = useState<'requesting' | 'syncing' | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<{ previous: number; phase: 'flying' | 'arrived' } | null>(null);
  const rewardController = useRef<AbortController | null>(null);
  const [highlightVersion, setHighlightVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingVersion, setAwaitingVersion] = useState<number | null>(null);
  const [retryRequest, setRetryRequest] = useState<SubmitGameActionRequest | null>(null);
  const requestInFlight = useRef(false);
  const pendingRequest = useRef<SubmitGameActionRequest | null>(null);
  const [selection, setSelection] = useState<CardSelection | null>(null);
  const [marketRefill, setMarketRefill] = useState<MarketRefill | null>(null);
  const [gemMode, setGemMode] = useState<'different' | 'pair'>('different');
  const [handExpanded, setHandExpanded] = useState(() => {
    try { return window.localStorage.getItem('gem-arena-hand-view') !== 'compact'; }
    catch { return true; }
  });
  const [selectedColors, setSelectedColors] = useState<GemColor[]>([]);
  const [returned, setReturned] = useState<Inventory>(emptyInventory);

  useEffect(() => {
    try { window.localStorage.setItem('gem-arena-hand-view', handExpanded ? 'expanded' : 'compact'); }
    catch { /* 저장소를 사용할 수 없어도 화면 전환은 유지한다. */ }
  }, [handExpanded]);

  useEffect(() => {
    if (!roomId) return;
    let stopped = false;
    let stopRoom = () => {};
    setRoom(null);
    setMyUid('');
    setRoomError('');
    ensureAnonymousSession().then(user => {
      if (stopped) return;
      setMyUid(user.uid);
      stopRoom = onSnapshot(doc(getFirebase().db, 'rooms', roomId), snapshot => {
        if (!snapshot.exists()) {
          setRoomError('방을 찾지 못했습니다.');
          setRoom(null);
          return;
        }
        const next = snapshot.data() as WaitingRoom;
        if (!next.playerOrder?.includes(user.uid) || !next.players?.[user.uid]) {
          setRoomError('이 방의 참가자가 아닙니다. 초대 코드로 참가해 주세요.');
          setRoom(null);
          return;
        }
        setRoomError('');
        setRoom(next);
      }, () => setRoomError('방 정보를 읽지 못했습니다. 연결과 Firestore 규칙을 확인해 주세요.'));
    }).catch(() => setRoomError('로그인을 확인하지 못했습니다. 로비에서 다시 시도해 주세요.'));
    return () => { stopped = true; stopRoom(); };
  }, [roomId, roomRetry]);

  useEffect(() => {
    if (!roomId || !myUid || (room?.status !== 'playing' && room?.status !== 'finished')) return;
    setUpdate({ status: 'loading', views: null, fromCache: false });
    setViewError('');
    return subscribeMyGameViews(roomId, myUid, setUpdate, error => setViewError(gameReadErrorMessage(error)));
  }, [roomId, myUid, room?.status, viewRetry]);

  const views: MyGameViews | null = update.views;
  const game: PublicGameView | null = views?.publicGame ?? null;
  const me = game?.players[myUid];
  const currentUid = game?.playerOrder[game.turnIndex];
  const myTurn = Boolean(game && currentUid === myUid && game.phase !== 'finished' && !me?.forfeited);
  const syncing = awaitingVersion !== null && (game?.version ?? -1) < awaitingVersion;
  const canAct = Boolean(myTurn && room?.status === 'playing' && !room.players[myUid]?.forfeited && update.status === 'ready' &&
    !update.fromCache && !busy && !syncing && !retryRequest);

  useEffect(() => {
    if (awaitingVersion !== null && game && game.version >= awaitingVersion && update.status === 'ready') {
      setAwaitingVersion(null);
    }
  }, [awaitingVersion, game?.version, update.status]);
  useEffect(() => {
    if (!confirmedAction || !game || game.version < confirmedAction.version ||
        update.status !== 'ready' || update.fromCache) return;
    if (confirmedAction.reward.action.type === 'BUY_CARD' && selection) return;
    const { player: before, action, gems: sources, returns, bonus, nobles } = confirmedAction.reward;
    if (action.type === 'TAKE_GEMS') setTakeFeedback(null);
    if (action.type === 'DISCARD_GEMS') setReturnFeedback(null);
    const after = game.players[myUid];
    rewardController.current?.abort();
    const controller = new AbortController();
    rewardController.current = controller;
    if (after) {
      const rewards: Gem[] = action.type === 'TAKE_GEMS' ? action.colors
        : action.type === 'RESERVE_CARD' ? ['gold'] : [];
      const remaining = emptyInventory();
      for (const color of gems) remaining[color] = Math.max(0, after.gems[color] - before.gems[color]);
      const arrivals = rewards.filter(color => {
        if (remaining[color] === 0) return false;
        remaining[color]--;
        return true;
      });
      if (arrivals.length) {
        setGemAnimation({ previous: before.gems, arrived: emptyInventory(), phase: 'flying' });
        void (async () => {
          await Promise.all(arrivals.map(async (color, index) => {
            if (index > 0) await new Promise(resolve => window.setTimeout(resolve, index * 130));
            if (controller.signal.aborted) return;
            const target = document.querySelector<HTMLElement>(`.multiplayer-self [data-held-color="${color}"]`);
            await flyBoardReward(sources[color] ?? null, target, 'gem', controller.signal);
            if (controller.signal.aborted) return;
            setGemAnimation(current => current ? { ...current,
              arrived: { ...current.arrived, [color]: current.arrived[color] + 1 } } : null);
          }));
          if (!controller.signal.aborted) setGemAnimation(current => current ? { ...current, phase: 'arrived' } : null);
        })();
      }
      if (action.type === 'DISCARD_GEMS') {
        const departures = gems.flatMap(color => Array.from({
          length: Math.min(action.gems[color], Math.max(0, before.gems[color] - after.gems[color])),
        }, (_, unit) => ({ color, source: returns[color]?.[unit] ?? null })));
        if (departures.length) {
          setGemAnimation({ previous: before.gems, arrived: emptyInventory(), phase: 'flying', direction: 'outgoing' });
          void (async () => {
            await Promise.all(departures.map(async ({ color, source }, index) => {
              if (index > 0) await new Promise(resolve => window.setTimeout(resolve, index * 130));
              if (controller.signal.aborted) return;
              const target = document.querySelector<HTMLElement>(`.multiplayer-actions .gem-bank [data-bank-color="${color}"] .gem-icon`);
              await flyBoardReward(source, target, 'gem', controller.signal);
              if (controller.signal.aborted) return;
              if (target?.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                target.animate([
                  { transform: 'scale(1)', filter: 'brightness(1)' },
                  { transform: 'scale(1.35)', filter: 'brightness(1.6)', offset: .45 },
                  { transform: 'scale(1)', filter: 'brightness(1)' },
                ], { duration: 340, easing: 'ease-out' });
              }
              setGemAnimation(current => current?.direction === 'outgoing' ? { ...current,
                arrived: { ...current.arrived, [color]: current.arrived[color] + 1 } } : current);
            }));
            if (!controller.signal.aborted) setGemAnimation(current => current?.direction === 'outgoing' ? { ...current, phase: 'arrived' } : current);
          })();
        }
      }
      if (action.type === 'BUY_CARD' && after.purchasedCardIds.includes(action.cardId) &&
          !before.purchasedCardIds.includes(action.cardId)) {
        const card = getDevelopmentCard(action.cardId);
        if (card) {
          const color = card.bonusColor;
          setBonusAnimation({ color, previousCount: countCardBonuses(before.purchasedCardIds)[color], phase: 'flying' });
          const target = document.querySelector<HTMLElement>(`.multiplayer-self [data-bonus-color="${color}"]`);
          void flyBoardReward(bonus, target, 'gem', controller.signal).then(() => {
            if (!controller.signal.aborted) setBonusAnimation(current => current ? { ...current, phase: 'arrived' } : null);
          });
        }
      }
      const nobleId = after.nobleIds.find(id => !before.nobleIds.includes(id));
      if (nobleId) {
        const points = getNoble(nobleId)?.points ?? 0;
        setScoreAnimation({ previous: after.score - points, phase: 'flying' });
        const target = document.querySelector<HTMLElement>('.multiplayer-self .player-panel__score');
        void flyBoardReward(nobles[nobleId] ?? null, target, 'noble', controller.signal).then(() => {
          if (!controller.signal.aborted) setScoreAnimation(current => current ? { ...current, phase: 'arrived' } : null);
        });
      }
    }
    setActionNotice(confirmedActionMessage(action.type));
    setHighlightVersion(game.version);
    setConfirmedAction(null);
  }, [confirmedAction, game?.version, update.status, update.fromCache, myUid, selection]);
  useEffect(() => {
    if (!marketRefill || marketRefill.phase !== 'empty' || selection || !game ||
        game.version < marketRefill.version || update.status !== 'ready' || update.fromCache) return;
    const replacementId = game.market[marketRefill.level][marketRefill.slot];
    if (!replacementId || replacementId === marketRefill.purchasedId) {
      setMarketRefill(null);
      return;
    }
    const controller = new AbortController();
    const row = document.querySelector<HTMLElement>(`.multiplayer-table .market-row--level-${marketRefill.level}`);
    const deck = row?.querySelector<HTMLElement>('.market-deck') ?? null;
    const slot = row?.querySelector<HTMLElement>(`.market-row__cards > :nth-child(${marketRefill.slot + 1})`) ?? null;
    void flyMarketDeal(deck, slot, controller.signal).then(() => {
      if (!controller.signal.aborted) setMarketRefill(current => current === marketRefill ? { ...current, phase: 'revealing' } : current);
    });
    return () => controller.abort();
  }, [marketRefill, selection, game?.version, update.status, update.fromCache]);
  useEffect(() => {
    if (marketRefill?.phase !== 'revealing') return;
    const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 440;
    const timer = window.setTimeout(() => setMarketRefill(current => current === marketRefill ? null : current), delay);
    return () => window.clearTimeout(timer);
  }, [marketRefill]);
  useEffect(() => () => rewardController.current?.abort(), []);
  useEffect(() => {
    if (gemAnimation?.phase !== 'arrived') return;
    const timer = window.setTimeout(() => setGemAnimation(null), 700);
    return () => window.clearTimeout(timer);
  }, [gemAnimation]);
  useEffect(() => {
    if (bonusAnimation?.phase !== 'arrived') return;
    const timer = window.setTimeout(() => setBonusAnimation(null), 700);
    return () => window.clearTimeout(timer);
  }, [bonusAnimation]);
  useEffect(() => {
    if (scoreAnimation?.phase !== 'arrived') return;
    const timer = window.setTimeout(() => setScoreAnimation(null), 700);
    return () => window.clearTimeout(timer);
  }, [scoreAnimation]);
  useEffect(() => {
    if (highlightVersion === null) return;
    const timer = window.setTimeout(() => setHighlightVersion(null), 1200);
    return () => window.clearTimeout(timer);
  }, [highlightVersion]);
  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);
  useEffect(() => {
    if (retryRequest && game && game.version > retryRequest.expectedVersion &&
        update.status === 'ready' && !update.fromCache) {
      pendingRequest.current = null;
      setRetryRequest(null);
      setActionError('');
    }
  }, [retryRequest, game?.version, update.status, update.fromCache]);
  useEffect(() => {
    setSelectedColors([]);
    setReturned(emptyInventory());
  }, [game?.version]);

  async function submit(action: Exclude<GameAction, { type: 'TIMEOUT' }>, previous?: SubmitGameActionRequest): Promise<boolean> {
    if (!roomId || !game || requestInFlight.current ||
        (previous ? pendingRequest.current?.actionId !== previous.actionId ||
          game.version !== previous.expectedVersion : !canAct || pendingRequest.current)) return false;
    if (action.type === 'TAKE_GEMS') setTakeFeedback('requesting');
    if (action.type === 'DISCARD_GEMS') setReturnFeedback('requesting');
    const request = previous ?? { roomId, actionId: crypto.randomUUID(), expectedVersion: game.version, action };
    const reward = captureActionRewards(game.players[myUid], request.action);
    rewardController.current?.abort();
    setGemAnimation(null);
    setBonusAnimation(null);
    setScoreAnimation(null);
    requestInFlight.current = true;
    setBusy(true);
    setActionError('');
    setActionNotice('');
    try {
      const result = await submitGameAction(request);
      pendingRequest.current = null;
      setRetryRequest(null);
      setAwaitingVersion(result.version > game.version ? result.version : null);
      setConfirmedAction({ version: result.version, reward });
      if (request.action.type === 'TAKE_GEMS') setTakeFeedback('syncing');
      if (request.action.type === 'DISCARD_GEMS') setReturnFeedback('syncing');
      if (request.action.type === 'BUY_CARD' && request.action.source === 'market') {
        const card = getDevelopmentCard(request.action.cardId);
        const slot = card ? game.market[card.level].indexOf(card.id) : -1;
        if (card && slot >= 0) setMarketRefill({ level: card.level, slot, purchasedId: card.id, version: result.version, phase: 'empty' });
      }
      return true;
    } catch (error) {
      if (request.action.type === 'TAKE_GEMS') setTakeFeedback(null);
      if (request.action.type === 'DISCARD_GEMS') setReturnFeedback(null);
      setActionError(actionErrorMessage(error));
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      const uncertain = code === 'functions/unavailable' || code === 'functions/deadline-exceeded';
      pendingRequest.current = uncertain ? request : null;
      setRetryRequest(uncertain ? request : null);
      return false;
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  async function forfeit(destination: ForfeitDestination) {
    if (!roomId || requestInFlight.current || pendingRequest.current ||
        room?.status !== 'playing' || room.players[myUid]?.forfeited) return;
    requestInFlight.current = true;
    setBusy(true);
    setForfeitError('');
    try {
      const result = await leaveRoom(roomId);
      pendingRequest.current = null;
      setRetryRequest(null);
      setSelection(null);
      setForfeitOpen(false);
      if (result.gameFinished || destination === 'lobby') navigate('/lobby', { replace: true });
    } catch (error) {
      setForfeitError(roomErrorMessage(error));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function chooseColor(color: GemColor) {
    setSelectedColors(current => gemMode === 'pair'
      ? current.includes(color) ? [] : [color]
      : current.includes(color) ? current.filter(value => value !== color)
        : current.length < 3 ? [...current, color] : current);
  }

  if (!roomId) return <section className="empty-page"><h1>방 코드가 없습니다</h1><Link className="text-link" to="/lobby">로비로 돌아가기</Link></section>;
  if (roomError) return <section className="empty-page"><h1>게임판을 열 수 없습니다</h1><p role="alert">{roomError}</p><button type="button" className="primary-link" onClick={() => setRoomRetry(value => value + 1)}>방 다시 불러오기</button><Link className="text-link" to="/lobby">로비로 돌아가기</Link></section>;
  if (!room) return <section className="empty-page"><h1>게임판 불러오는 중</h1><p role="status">방과 참가자 정보를 확인하고 있습니다…</p></section>;
  if (room.status === 'waiting') return <section className="empty-page"><h1>게임 시작 대기 중</h1><p>참가자 모두 준비한 뒤 방장이 게임을 시작할 수 있습니다.</p><Link className="primary-link" to={`/rooms/${roomId}`}>대기실로 돌아가기</Link></section>;
  if (viewError) return <section className="empty-page"><h1>멀티 게임판 연결 전</h1><p role="alert">{viewError}</p><button type="button" className="primary-link" onClick={() => setViewRetry(value => value + 1)}>게임판 다시 연결하기</button><Link className="text-link" to={`/rooms/${roomId}`}>대기실로 돌아가기</Link><Link className="text-link" to="/game/demo">로컬 게임판 미리보기</Link></section>;
  if (!views || !game || !me) return <section className="empty-page"><span className="eyebrow">MULTIPLAYER · {roomId}</span><h1>게임판 준비 중</h1><p role="status">방은 시작됐지만 서버가 공개 시장과 개인 예약 카드를 아직 준비하지 않았습니다. 준비되면 이 화면에 자동으로 표시됩니다.</p><Link className="text-link" to={`/rooms/${roomId}`}>대기실 보기</Link></section>;

  const currentName = room.players[currentUid ?? '']?.nickname ?? '플레이어';
  const opponents = game.playerOrder.filter(uid => uid !== myUid);
  const activePlayerCount = game.playerOrder.filter(uid => !game.players[uid]?.forfeited).length;
  const selectedCard = selection ? getDevelopmentCard(selection.cardId) : undefined;
  const myBonuses = countCardBonuses(me.purchasedCardIds);
  const canTake = canAct && game.phase === 'playing';
  const takeColors = gemMode === 'pair' && selectedColors.length === 1
    ? [selectedColors[0], selectedColors[0]] : selectedColors;
  const excess = excessGemCount(me.gems);
  const returnedCount = gems.reduce((sum, color) => sum + returned[color], 0);
  const eligibleNobles = game.availableNobleIds.filter(id => {
    const noble = getNoble(id);
    const bonuses = countCardBonuses(me.purchasedCardIds);
    return noble && CARD_COLORS.every(color => bonuses[color] >= noble.requirements[color]);
  });

  return <div className="multiplayer-page">
    <div className="multiplayer-page__heading">
      <div className="multiplayer-page__title"><span className="eyebrow">LIVE TABLE · {game.playerOrder.length} PLAYERS · {roomId}</span><h1>게임판</h1></div>
      <div className="multiplayer-page__heading-side">
        <div className={`multiplayer-page__turn${myTurn && !me.forfeited && game.phase !== 'finished' ? ' multiplayer-page__turn--mine' : ''}`} role="status" aria-live="polite">
          <span className="multiplayer-page__turn-indicator" aria-hidden="true" />
          <span className="multiplayer-page__turn-copy"><small>{game.phase === 'finished' ? '게임 상태' : '현재 차례'}</small><strong>{game.phase === 'finished' ? '게임 종료' : myTurn && !me.forfeited ? '내 차례' : currentName}</strong></span>
        </div>
        <div className="multiplayer-page__heading-actions">
          {room.status === 'playing' && !me.forfeited && !room.players[myUid]?.forfeited && <button type="button" className="multiplayer-page__forfeit" disabled={busy || Boolean(retryRequest)} onClick={() => { setForfeitError(''); setForfeitOpen(true); }}>기권하기</button>}
        </div>
      </div>
    </div>
    {me.forfeited && <p className="multiplayer-page__notice" role="status">기권했습니다. 결과는 계속 볼 수 있지만 행동하거나 다시 참가할 수 없습니다.</p>}
    {update.status === 'syncing' && <p className="multiplayer-page__notice" role="status">서버 문서의 버전을 맞추는 중입니다. 마지막 확정 상태를 표시합니다.</p>}
    {update.fromCache && <p className="multiplayer-page__notice" role="status">저장된 상태를 표시하는 중입니다. 서버 연결을 기다립니다.</p>}
    {syncing && <p className="multiplayer-page__notice" role="status">행동이 승인됐습니다. 게임판 갱신을 기다리는 중입니다.</p>}
    {actionError && <div className="multiplayer-page__error" role="alert">{actionError}{retryRequest && <button type="button" disabled={busy || game.version !== retryRequest.expectedVersion} onClick={() => void submit(retryRequest.action, retryRequest)}>같은 요청 다시 보내기</button>}</div>}
    {actionNotice && <p className="multiplayer-page__notice multiplayer-page__notice--confirmed" role="status">{actionNotice}</p>}
    {game.phase === 'finished' && <p className="multiplayer-page__result" role="status">승자: {game.winnerIds.map(uid => room.players[uid]?.nickname ?? uid).join(' · ')} <Link to="/lobby">로비로 나가기</Link></p>}

    <div className="multiplayer-table">
      <div className="multiplayer-table__left">
        <NobleGallery nobles={game.availableNobleIds.map(id => getNoble(id)).filter(noble => noble !== undefined)}
          eligibleIds={eligibleNobles} onChoose={canAct && game.phase === 'choosingNoble'
            ? id => void submit({ type: 'CHOOSE_NOBLE', nobleId: id }) : undefined} />
        <section className="multiplayer-opponents" aria-label="상대 플레이어 공개 정보">
          <div className="multiplayer-section-label"><span className="eyebrow">OPPONENTS</span><h2>상대 플레이어</h2></div>
          <div className="multiplayer-opponents__list">{opponents.map(uid => {
            const player = game.players[uid];
            return player && <PlayerPanel key={uid} player={displayedPlayer(uid, player, room, myUid)}
              isCurrent={uid === currentUid} forfeited={player.forfeited} gems={player.gems} showGemNames />;
          })}</div>
        </section>
      </div>
      <section className="market-section" aria-labelledby="multi-market-title">
        <div className="section-heading"><div><span className="eyebrow">MARKET</span><h2 id="multi-market-title">개발 카드 시장</h2></div></div>
        <div className="market-levels">{levels.map(level => <div className={`market-row market-row--level-${level}`} key={level}>
          <div className="market-row__label"><DeckCard level={level} remaining={game.deckCounts[level]}
            disabled={!canAct || game.phase !== 'playing' || game.deckCounts[level] === 0 || me.reservedCount >= 3}
            onReserve={() => void submit({ type: 'RESERVE_CARD', level })} /></div>
          <div className="market-row__cards">{game.market[level].map((id, slot) => {
            const refill = marketRefill?.level === level && marketRefill.slot === slot ? marketRefill : null;
            if (refill?.phase === 'empty') return <div className="market-card-empty market-card-empty--refilling" key={`${level}-${slot}`} role="status">새 카드 보충 중…</div>;
            const card = id ? getDevelopmentCard(id) : undefined;
            return card ? <MarketCard key={`${level}-${slot}`} card={card} bonuses={myBonuses} className={refill?.phase === 'revealing' ? 'market-card--dealt' : ''} disabled={Boolean(refill)} onSelect={() => setSelection({ cardId: card.id, source: 'market' })} />
              : <div className="market-card-empty" key={`${level}-${slot}`}>빈 칸</div>;
          })}</div>
        </div>)}</div>
      </section>
      <aside className={`multiplayer-actions${takeFeedback ? ' multiplayer-actions--taking' : ''}`} aria-label="보석 은행과 내 행동">
        <div className="section-heading"><div><span className="eyebrow">SUPPLY</span><h2 id="bank-title">보석 은행</h2></div></div>
        <GemBank bank={game.bank} mode={gemMode} phase={canTake ? 'selecting' : 'completed'} selectedColors={selectedColors} onSelect={chooseColor} />
        <div className="multiplayer-actions__panel">
          <span className="eyebrow">MY ACTION</span>
          {game.phase === 'playing' ? <><p>{myTurn ? '한 턴에 한 가지 기본 행동을 선택하세요.' : `${currentName}의 행동을 기다리고 있습니다.`}</p><div className="multiplayer-actions__modes"><button type="button" className={gemMode === 'different' ? 'is-active' : ''} aria-pressed={gemMode === 'different'} disabled={!canTake} onClick={() => { setGemMode('different'); setSelectedColors([]); }}>다른 색 최대 3개</button><button type="button" className={gemMode === 'pair' ? 'is-active' : ''} aria-pressed={gemMode === 'pair'} disabled={!canTake} onClick={() => { setGemMode('pair'); setSelectedColors([]); }}>같은 색 2개</button></div><button type="button" className={`multiplayer-actions__primary${takeFeedback ? ' multiplayer-actions__primary--pending' : ''}`} disabled={!canTake || !canTakeGems(game.bank, takeColors)} onClick={() => void submit({ type: 'TAKE_GEMS', colors: takeColors })}>{takeFeedback === 'requesting' ? '보석 받는 중…' : takeFeedback === 'syncing' ? '게임판 갱신 중…' : '선택한 보석 받기'}</button>{takeFeedback && <p className="multiplayer-actions__progress" role="status">{takeFeedback === 'requesting' ? '선택한 보석을 은행에서 확인하고 있습니다.' : '보석이 확정됐습니다. 게임판에 표시하고 있습니다.'}</p>}<button type="button" className="multiplayer-actions__secondary" disabled={!canTake} onClick={() => void submit({ type: 'PASS' })}>가능한 행동이 없으면 패스</button></>
            : game.phase === 'discarding' && myTurn ? <><p>보석이 10개를 넘었습니다. {excess}개를 은행에 돌려주세요.</p><div className="multiplayer-actions__returns">{gems.filter(color => me.gems[color] > 0).map(color => <div className="multiplayer-actions__return-row" key={color}><GemIcon color={color} small /><span className="multiplayer-actions__return-label">{gemNames[color]} <small>보유 {me.gems[color]}개</small></span><div className="multiplayer-actions__return-controls"><button type="button" aria-label={`${gemNames[color]} 반환 수량 줄이기`} disabled={!canAct || returned[color] === 0} onClick={() => setReturned(current => ({ ...current, [color]: current[color] - 1 }))}>−</button><strong aria-label={`${gemNames[color]} ${returned[color]}개 반환`}>{returned[color]}</strong><button type="button" aria-label={`${gemNames[color]} 반환 수량 늘리기`} disabled={!canAct || returned[color] >= me.gems[color] || returnedCount >= excess} onClick={() => setReturned(current => ({ ...current, [color]: current[color] + 1 }))}>+</button></div></div>)}</div><button type="button" className={`multiplayer-actions__primary${returnFeedback ? ' multiplayer-actions__primary--pending' : ''}`} disabled={!canAct || returnedCount !== excess} onClick={() => void submit({ type: 'DISCARD_GEMS', gems: returned })}>{returnFeedback === 'requesting' ? '보석 반환 중…' : returnFeedback === 'syncing' ? '게임판 갱신 중…' : `보석 ${returnedCount}/${excess}개 반환`}</button>{returnFeedback && <p className="multiplayer-actions__progress" role="status">{returnFeedback === 'requesting' ? '반환할 보석을 확인하고 있습니다.' : '보석이 확정됐습니다. 은행으로 옮기고 있습니다.'}</p>}</>
              : game.phase === 'choosingNoble' && myTurn ? <p>조건을 만족한 귀족을 왼쪽에서 선택하세요.</p>
                : <p>{game.phase === 'finished' ? '최종 결과가 확정되었습니다.' : '서버의 다음 상태를 기다리고 있습니다.'}</p>}
        </div>
        <section className={`multiplayer-self multiplayer-self--${handExpanded ? 'expanded' : 'compact'}${highlightVersion === game.version ? ' multiplayer-self--confirmed' : ''}`} aria-label="내 공개 자원과 비공개 예약 카드">
          <div className="multiplayer-self__heading"><div><span className="eyebrow">MY TABLE</span><h2>내 현황 <small>예약 {views.privatePlayer.reservedCardIds.length}/3</small></h2></div><button type="button" className="multiplayer-self__toggle" aria-expanded={handExpanded} aria-controls="multiplayer-self-details" onClick={() => setHandExpanded(value => !value)}>{handExpanded ? '간단히 보기' : '자세히 보기'}</button></div>
          <div id="multiplayer-self-details" className="multiplayer-self__details">
            <PlayerPanel player={displayedPlayer(myUid, me, room, myUid)} isCurrent={myUid === currentUid} forfeited={me.forfeited} gems={me.gems} showGemNames={handExpanded}
              gemAnimation={gemAnimation ?? undefined} bonusAnimation={bonusAnimation ?? undefined} scoreAnimation={scoreAnimation ?? undefined} />
            {handExpanded && <div className="multiplayer-self__reserved"><div><span className="eyebrow">PRIVATE CARDS</span><h3>내 예약 카드 <small>{views.privatePlayer.reservedCardIds.length}/3</small></h3></div>{views.privatePlayer.reservedCardIds.length === 0 ? <p>예약한 카드가 없습니다.</p> : <div className="multiplayer-self__cards">{views.privatePlayer.reservedCardIds.map(id => {
              const card = getDevelopmentCard(id);
              return card && <MarketCard key={id} card={card} bonuses={myBonuses} onSelect={() => setSelection({ cardId: id, source: 'reserved' })} />;
            })}</div>}</div>}
          </div>
        </section>
      </aside>
    </div>
    {selectedCard && selection && <MultiplayerCardDialog key={`${selection.source}-${selection.cardId}`}
      card={selectedCard} source={selection.source} player={me} bankGold={game.bank.gold}
      canAct={canAct && game.phase === 'playing'} busy={busy || syncing} error={actionError} onClose={() => setSelection(null)} onAction={submit} />}
    {forfeitOpen && game.phase !== 'finished' && <ForfeitChoiceDialog finalOpponent={activePlayerCount <= 2} busy={busy} error={forfeitError}
      onClose={() => setForfeitOpen(false)} onConfirm={destination => void forfeit(destination)} />}
    {game.phase === 'finished' && game.winnerIds.includes(myUid) && <MultiplayerVictoryDialog
      winnerNames={game.winnerIds.map(uid => room.players[uid]?.nickname ?? uid)} byForfeit={activePlayerCount === 1}
      onLobby={() => navigate('/lobby', { replace: true })} />}
  </div>;
}

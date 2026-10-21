import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CARD_COLORS, canPayForCard, canTakeGems, countCardBonuses, excessGemCount,
  getDevelopmentCard, getNoble, remainingCardCost,
} from '@gem-arena/engine';
import type {
  CardLevel, DevelopmentCard, GameAction, Gem, GemColor, Inventory,
  PublicGameView, PublicPlayerView,
} from '@gem-arena/engine';
import { doc, onSnapshot } from 'firebase/firestore';
import { GemBank } from '../components/GemBank';
import { GemIcon, gemNames } from '../components/GemIcon';
import { CardFace, MarketCard } from '../components/MarketCard';
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

function gameReadErrorMessage(error: Error): string {
  const code = 'code' in error ? error.code : null;
  if (code === 'permission-denied') {
    return import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
      ? '게임 문서 읽기가 로컬 Firestore 규칙에서 거부되었습니다. 에뮬레이터가 이 저장소의 firestore.rules로 실행 중인지 확인해 주세요.'
      : '실제 Firebase에는 멀티 게임판의 조회 규칙과 게임 서버가 아직 배포되지 않았습니다. 현재는 로컬 에뮬레이터에서 멀티 게임을 확인할 수 있습니다.';
  }
  return '게임 상태를 읽지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}

function MultiplayerCardDialog({ card, source, player, bankGold, canAct, busy, onClose, onAction }: {
  card: DevelopmentCard;
  source: CardSelection['source'];
  player: PublicPlayerView;
  bankGold: number;
  canAct: boolean;
  busy: boolean;
  onClose: () => void;
  onAction: (action: Exclude<GameAction, { type: 'TIMEOUT' }>) => Promise<boolean>;
}) {
  const [payment, setPayment] = useState(() => suggestedPayment(card, player));
  const bonuses = countCardBonuses(player.purchasedCardIds);
  const remaining = remainingCardCost(card.cost, bonuses);
  const canBuy = canAct && canPayForCard(card.cost, bonuses, player.gems, payment);
  const canReserve = canAct && source === 'market' && player.reservedCount < 3;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

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

  return <div className="multiplayer-card-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="multiplayer-card-dialog" role="dialog" aria-modal="true" aria-labelledby="multi-card-title">
      <div className="multiplayer-card-dialog__heading"><div><span className="eyebrow">LEVEL {card.level} · {source === 'market' ? 'MARKET' : 'MY RESERVATION'}</span><h2 id="multi-card-title">{gemNames[card.bonusColor]} 개발 카드</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="카드 창 닫기">×</button></div>
      <div className="multiplayer-card-dialog__body">
        <div className="multiplayer-card-dialog__face"><CardFace card={card} /></div>
        <div className="multiplayer-card-dialog__details">
          <p>{card.points}점 · {gemNames[card.bonusColor]} 영구 할인 1개</p>
          <div className="multiplayer-card-dialog__costs" aria-label="카드 구매 비용">
            {CARD_COLORS.filter(color => card.cost[color] > 0).map(color => <div key={color}>
              <span className={`gem-box gem-box--${color}`}><GemIcon color={color} small />{gemNames[color]}</span>
              <span>비용 {card.cost[color]} − 할인 {card.cost[color] - remaining[color]} = <strong>{remaining[color]}</strong></span>
              <span>보유 {player.gems[color]}</span>
              <div className="multiplayer-card-dialog__stepper"><button type="button" onClick={() => changePayment(color, -1)} disabled={busy || payment[color] === 0} aria-label={`${gemNames[color]} 사용량 줄이기`}>−</button><strong>{payment[color]}</strong><button type="button" onClick={() => changePayment(color, 1)} disabled={busy || payment[color] >= Math.min(remaining[color], player.gems[color])} aria-label={`${gemNames[color]} 사용량 늘리기`}>+</button></div>
            </div>)}
          </div>
          <p className="multiplayer-card-dialog__gold"><GemIcon color="gold" small /> 황금 대체 {payment.gold}개 · 보유 {player.gems.gold}개</p>
          <div className="multiplayer-card-dialog__actions"><button type="button" onClick={() => void act({ type: 'BUY_CARD', cardId: card.id, source, payment })} disabled={!canBuy || busy}>이 보석으로 구매</button>{source === 'market' && <button type="button" onClick={() => void act({ type: 'RESERVE_CARD', cardId: card.id })} disabled={!canReserve || busy}>예약{bankGold > 0 ? ' · 황금 +1' : ''}</button>}</div>
          {!canAct && <p>현재는 카드를 확인할 수 있습니다. 자신의 차례가 되면 행동할 수 있습니다.</p>}
          {canAct && !canBuy && <p>선택한 결제 수량으로는 구매할 수 없습니다.</p>}
        </div>
      </div>
    </section>
  </div>;
}

export function MultiplayerGamePage() {
  const { roomId } = useParams();
  const [myUid, setMyUid] = useState('');
  const [room, setRoom] = useState<WaitingRoom | null>(null);
  const [update, setUpdate] = useState<GameViewUpdate>({ status: 'loading', views: null, fromCache: false });
  const [roomError, setRoomError] = useState('');
  const [viewError, setViewError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [awaitingVersion, setAwaitingVersion] = useState<number | null>(null);
  const [retryRequest, setRetryRequest] = useState<SubmitGameActionRequest | null>(null);
  const requestInFlight = useRef(false);
  const pendingRequest = useRef<SubmitGameActionRequest | null>(null);
  const [selection, setSelection] = useState<CardSelection | null>(null);
  const [gemMode, setGemMode] = useState<'different' | 'pair'>('different');
  const [selectedColors, setSelectedColors] = useState<GemColor[]>([]);
  const [returned, setReturned] = useState<Inventory>(emptyInventory);

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
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !myUid || (room?.status !== 'playing' && room?.status !== 'finished')) return;
    setUpdate({ status: 'loading', views: null, fromCache: false });
    setViewError('');
    return subscribeMyGameViews(roomId, myUid, setUpdate, error => setViewError(gameReadErrorMessage(error)));
  }, [roomId, myUid, room?.status]);

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
    const request = previous ?? { roomId, actionId: crypto.randomUUID(), expectedVersion: game.version, action };
    requestInFlight.current = true;
    setBusy(true);
    setActionError('');
    try {
      const result = await submitGameAction(request);
      pendingRequest.current = null;
      setRetryRequest(null);
      setAwaitingVersion(result.version > game.version ? result.version : null);
      return true;
    } catch (error) {
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

  async function forfeit() {
    if (!roomId || requestInFlight.current || pendingRequest.current ||
        room?.status !== 'playing' || room.players[myUid]?.forfeited) return;
    if (!window.confirm('기권하면 이 게임에 다시 참가할 수 없습니다. 기권하시겠습니까?')) return;
    requestInFlight.current = true;
    setBusy(true);
    setActionError('');
    try {
      await leaveRoom(roomId);
      pendingRequest.current = null;
      setRetryRequest(null);
      setSelection(null);
    } catch (error) {
      setActionError(roomErrorMessage(error));
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
  if (roomError) return <section className="empty-page"><h1>게임판을 열 수 없습니다</h1><p role="alert">{roomError}</p><Link className="text-link" to="/lobby">로비로 돌아가기</Link></section>;
  if (!room) return <section className="empty-page"><h1>게임판 불러오는 중</h1><p role="status">방과 참가자 정보를 확인하고 있습니다…</p></section>;
  if (room.status === 'waiting') return <section className="empty-page"><h1>게임 시작 대기 중</h1><p>참가자 모두 준비한 뒤 방장이 게임을 시작할 수 있습니다.</p><Link className="primary-link" to={`/rooms/${roomId}`}>대기실로 돌아가기</Link></section>;
  if (viewError) return <section className="empty-page"><h1>멀티 게임판 연결 전</h1><p role="alert">{viewError}</p><Link className="text-link" to={`/rooms/${roomId}`}>대기실로 돌아가기</Link><Link className="text-link" to="/game/demo">로컬 게임판 미리보기</Link></section>;
  if (!views || !game || !me) return <section className="empty-page"><span className="eyebrow">MULTIPLAYER · {roomId}</span><h1>게임판 준비 중</h1><p role="status">방은 시작됐지만 서버가 공개 시장과 개인 예약 카드를 아직 준비하지 않았습니다. 준비되면 이 화면에 자동으로 표시됩니다.</p><Link className="text-link" to={`/rooms/${roomId}`}>대기실 보기</Link></section>;

  const currentName = room.players[currentUid ?? '']?.nickname ?? '플레이어';
  const opponents = game.playerOrder.filter(uid => uid !== myUid);
  const selectedCard = selection ? getDevelopmentCard(selection.cardId) : undefined;
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
    <div className="multiplayer-page__heading"><div><span className="eyebrow">LIVE TABLE · {game.playerOrder.length} PLAYERS · {roomId}</span><h1>게임판</h1></div><div className="multiplayer-page__heading-side"><Link className="text-link" to={`/rooms/${roomId}`}>대기실</Link>{room.status === 'playing' && !me.forfeited && !room.players[myUid]?.forfeited && <button type="button" className="text-link" disabled={busy || Boolean(retryRequest)} onClick={() => void forfeit()}>기권하기</button>}<span className="multiplayer-page__turn">{game.phase === 'finished' ? '게임 종료' : me.forfeited ? '기권' : myTurn ? '내 차례' : `${currentName} 차례`}</span></div></div>
    {me.forfeited && <p className="multiplayer-page__notice" role="status">기권했습니다. 결과는 계속 볼 수 있지만 행동하거나 다시 참가할 수 없습니다.</p>}
    {update.status === 'syncing' && <p className="multiplayer-page__notice" role="status">서버 문서의 버전을 맞추는 중입니다. 마지막 확정 상태를 표시합니다.</p>}
    {update.fromCache && <p className="multiplayer-page__notice" role="status">저장된 상태를 표시하는 중입니다. 서버 연결을 기다립니다.</p>}
    {syncing && <p className="multiplayer-page__notice" role="status">행동이 승인됐습니다. 게임판 갱신을 기다리는 중입니다.</p>}
    {actionError && <div className="multiplayer-page__error" role="alert">{actionError}{retryRequest && <button type="button" disabled={busy || game.version !== retryRequest.expectedVersion} onClick={() => void submit(retryRequest.action, retryRequest)}>같은 요청 다시 보내기</button>}</div>}
    {game.phase === 'finished' && <p className="multiplayer-page__result" role="status">승자: {game.winnerIds.map(uid => room.players[uid]?.nickname ?? uid).join(' · ')}</p>}

    <section className="multiplayer-opponents" aria-label="상대 플레이어 공개 정보">
      <div className="multiplayer-section-label"><span className="eyebrow">OPPONENTS</span><h2>상대 플레이어</h2></div>
      <div className="multiplayer-opponents__list">{opponents.map(uid => {
        const player = game.players[uid];
        return player && <PlayerPanel key={uid} player={displayedPlayer(uid, player, room, myUid)}
          isCurrent={uid === currentUid} forfeited={player.forfeited} gems={player.gems} />;
      })}</div>
    </section>

    <div className="multiplayer-table">
      <NobleGallery nobles={game.availableNobleIds.map(id => getNoble(id)).filter(noble => noble !== undefined)}
        eligibleIds={eligibleNobles} onChoose={canAct && game.phase === 'choosingNoble'
          ? id => void submit({ type: 'CHOOSE_NOBLE', nobleId: id }) : undefined} />
      <section className="market-section" aria-labelledby="multi-market-title">
        <div className="section-heading"><div><span className="eyebrow">MARKET</span><h2 id="multi-market-title">개발 카드 시장</h2></div></div>
        <div className="market-levels">{levels.map(level => <div className={`market-row market-row--level-${level}`} key={level}>
          <div className="market-row__label"><span>LEVEL</span><strong>{level}</strong><small>덱 {game.deckCounts[level]}장</small><button type="button" className="market-row__reserve-deck" disabled={!canAct || game.phase !== 'playing' || game.deckCounts[level] === 0 || me.reservedCount >= 3} onClick={() => void submit({ type: 'RESERVE_CARD', level })}>덱 예약</button></div>
          <div className="market-row__cards">{game.market[level].map((id, slot) => {
            const card = id ? getDevelopmentCard(id) : undefined;
            return card ? <MarketCard key={`${level}-${slot}`} card={card} onSelect={() => setSelection({ cardId: card.id, source: 'market' })} />
              : <div className="market-card-empty" key={`${level}-${slot}`}>빈 칸</div>;
          })}</div>
        </div>)}</div>
      </section>
      <aside className="multiplayer-actions" aria-label="보석 은행과 내 행동">
        <div className="section-heading"><div><span className="eyebrow">SUPPLY</span><h2 id="bank-title">보석 은행</h2></div></div>
        <GemBank bank={game.bank} mode={gemMode} phase={canTake ? 'selecting' : 'completed'} selectedColors={selectedColors} onSelect={chooseColor} />
        <div className="multiplayer-actions__panel">
          <span className="eyebrow">MY ACTION</span>
          {game.phase === 'playing' ? <><p>{myTurn ? '한 턴에 한 가지 기본 행동을 선택하세요.' : `${currentName}의 행동을 기다리고 있습니다.`}</p><div className="multiplayer-actions__modes"><button type="button" className={gemMode === 'different' ? 'is-active' : ''} disabled={!canTake} onClick={() => { setGemMode('different'); setSelectedColors([]); }}>다른 색 최대 3개</button><button type="button" className={gemMode === 'pair' ? 'is-active' : ''} disabled={!canTake} onClick={() => { setGemMode('pair'); setSelectedColors([]); }}>같은 색 2개</button></div><button type="button" className="multiplayer-actions__primary" disabled={!canTake || !canTakeGems(game.bank, takeColors)} onClick={() => void submit({ type: 'TAKE_GEMS', colors: takeColors })}>선택한 보석 받기</button><button type="button" className="multiplayer-actions__secondary" disabled={!canTake} onClick={() => void submit({ type: 'PASS' })}>가능한 행동이 없으면 패스</button></>
            : game.phase === 'discarding' && myTurn ? <><p>보석이 10개를 넘었습니다. {excess}개를 은행에 돌려주세요.</p><div className="multiplayer-actions__returns">{gems.filter(color => me.gems[color] > 0).map(color => <div key={color}><GemIcon color={color} small /><span>{gemNames[color]} {me.gems[color]}개</span><button type="button" disabled={!canAct || returned[color] === 0} onClick={() => setReturned(current => ({ ...current, [color]: current[color] - 1 }))}>−</button><strong>{returned[color]}</strong><button type="button" disabled={!canAct || returned[color] >= me.gems[color] || returnedCount >= excess} onClick={() => setReturned(current => ({ ...current, [color]: current[color] + 1 }))}>+</button></div>)}</div><button type="button" className="multiplayer-actions__primary" disabled={!canAct || returnedCount !== excess} onClick={() => void submit({ type: 'DISCARD_GEMS', gems: returned })}>보석 {returnedCount}/{excess}개 반환</button></>
              : game.phase === 'choosingNoble' && myTurn ? <p>조건을 만족한 귀족을 왼쪽에서 선택하세요.</p>
                : <p>{game.phase === 'finished' ? '최종 결과가 확정되었습니다.' : '서버의 다음 상태를 기다리고 있습니다.'}</p>}
        </div>
      </aside>
    </div>

    <section className="multiplayer-self" aria-label="내 공개 자원과 비공개 예약 카드">
      <div className="multiplayer-section-label"><span className="eyebrow">MY TABLE</span><h2>내 자원</h2></div>
      <PlayerPanel player={displayedPlayer(myUid, me, room, myUid)} isCurrent={myUid === currentUid} forfeited={me.forfeited} gems={me.gems} />
      <div className="multiplayer-self__reserved"><div><span className="eyebrow">PRIVATE CARDS</span><h3>내 예약 카드 <small>{views.privatePlayer.reservedCardIds.length}/3</small></h3></div>{views.privatePlayer.reservedCardIds.length === 0 ? <p>예약한 카드가 없습니다.</p> : <div className="multiplayer-self__cards">{views.privatePlayer.reservedCardIds.map(id => {
        const card = getDevelopmentCard(id);
        return card && <MarketCard key={id} card={card} onSelect={() => setSelection({ cardId: id, source: 'reserved' })} />;
      })}</div>}</div>
    </section>
    {selectedCard && selection && <MultiplayerCardDialog key={`${selection.source}-${selection.cardId}`}
      card={selectedCard} source={selection.source} player={me} bankGold={game.bank.gold}
      canAct={canAct && game.phase === 'playing'} busy={busy || syncing} onClose={() => setSelection(null)} onAction={submit} />}
  </div>;
}

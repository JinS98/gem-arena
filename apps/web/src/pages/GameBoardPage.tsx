import { useEffect, useRef, useState } from 'react';
import { countCardBonuses, eligibleNobleIds, getDevelopmentCard, getNoble } from '@gem-arena/engine';
import type { CardLevel, GemColor, Inventory } from '@gem-arena/engine';
import { captureRewardSource, flyBoardReward } from '../animations/boardReward';
import type { RewardSource } from '../animations/boardReward';
import { CardActionModal } from '../components/CardActionModal';
import { GemBank } from '../components/GemBank';
import { GemActionPanel } from '../components/GemActionPanel';
import { GameResultModal } from '../components/GameResultModal';
import { GameStartModal } from '../components/GameStartModal';
import { MarketCard } from '../components/MarketCard';
import { NobleGallery } from '../components/NobleGallery';
import { PlayerPanel } from '../components/PlayerPanel';
import { ReservedCardsModal } from '../components/ReservedCardsModal';
import { useTurnCountdown } from '../hooks/useTurnCountdown';
import { useDemoGemStore } from '../stores/demoGemStore';
import { useGameUIStore } from '../stores/gameUIStore';

const levels: CardLevel[] = [3, 2, 1];
type BonusAnimation = { playerId: string; color: GemColor; previousCount: number; phase: 'flying' | 'arrived' };
type GemAnimation = { playerId: string; previous: Inventory; arrived: Inventory; phase: 'flying' | 'arrived' };
type ScoreAnimation = { playerId: string; previous: number; phase: 'flying' | 'arrived' };
type PendingNobleReward = { playerId: string; source: RewardSource | null; previousScore: number };
const emptyCounts = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

export function GameBoardPage() {
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(() => useDemoGemStore.getState().players.length as 2 | 3 | 4);
  const [reservedOpen, setReservedOpen] = useState(false);
  const [bonusAnimation, setBonusAnimation] = useState<BonusAnimation | null>(null);
  const [gemAnimation, setGemAnimation] = useState<GemAnimation | null>(null);
  const [scoreAnimation, setScoreAnimation] = useState<ScoreAnimation | null>(null);
  const rewardController = useRef(new AbortController());
  const pendingNobleReward = useRef<PendingNobleReward | null>(null);
  const { bank, mode, phase, selectedColors, selectColor, market, decks,
    reservedCardIds, game, players, scenario, currentPlayerId, chooseNoble,
    reserveDeckCard, startNewGame, beginGame, restart, reset, advanceTurn } = useDemoGemStore();
  const { selectedCard, selectCard, closeCard } = useGameUIStore();
  const countdown = useTurnCountdown();
  const selectedCardData = selectedCard ? getDevelopmentCard(selectedCard.id) : undefined;
  const displayedPlayerId = phase === 'completed'
    ? game.playerOrder[(game.turnIndex - 1 + game.playerOrder.length) % game.playerOrder.length]
    : currentPlayerId;
  const currentPlayer = players.find((player) => player.id === displayedPlayerId);
  const currentBonuses = countCardBonuses(game.players[currentPlayerId]?.purchasedCardIds ?? []);
  const availableNobles = game.availableNobleIds.map((id) => getNoble(id)).filter((noble) => noble !== undefined);
  const nobleChoices = phase === 'choosingNoble' ? eligibleNobleIds(game, currentPlayerId) : [];
  useEffect(() => {
    const controller = new AbortController();
    rewardController.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (bonusAnimation?.phase !== 'arrived') return;
    const timeout = window.setTimeout(() => setBonusAnimation(null), 700);
    return () => window.clearTimeout(timeout);
  }, [bonusAnimation]);
  useEffect(() => {
    if (gemAnimation?.phase !== 'arrived') return;
    const timeout = window.setTimeout(() => setGemAnimation(null), 700);
    return () => window.clearTimeout(timeout);
  }, [gemAnimation]);
  useEffect(() => {
    if (scoreAnimation?.phase !== 'arrived') return;
    const timeout = window.setTimeout(() => setScoreAnimation(null), 700);
    return () => window.clearTimeout(timeout);
  }, [scoreAnimation]);
  useEffect(() => {
    if (phase !== 'completed' || bonusAnimation?.phase === 'flying' ||
        gemAnimation?.phase === 'flying' || scoreAnimation?.phase === 'flying') return;
    const frame = window.requestAnimationFrame(advanceTurn);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, bonusAnimation?.phase, gemAnimation?.phase, scoreAnimation?.phase, advanceTurn]);

  const handleTakeGems = () => {
    const before = useDemoGemStore.getState();
    const colors = before.mode === 'pair' && before.selectedColors.length === 1
      ? [before.selectedColors[0], before.selectedColors[0]] : [...before.selectedColors];
    const playerId = before.currentPlayerId;
    const previous = { ...before.game.players[playerId].gems };
    const previousNobles = before.game.players[playerId].nobleIds;
    const nobleSources = new Map([...document.querySelectorAll<HTMLElement>('[data-noble-id]')]
      .map((element) => [element.dataset.nobleId, captureRewardSource(element)]));
    const flights = colors.map((color) => ({ color,
      source: captureRewardSource(document.querySelector<HTMLElement>(`[data-bank-color="${color}"] .gem-icon`)),
      target: document.querySelector<HTMLElement>(`[data-player-id="${playerId}"] [data-held-color="${color}"]`),
    }));
    setGemAnimation({ playerId, previous, arrived: emptyCounts(), phase: 'flying' });
    before.takeSelected();
    if (useDemoGemStore.getState().game.version === before.game.version) {
      setGemAnimation(null);
      return;
    }
    const claimedNobleId = useDemoGemStore.getState().game.players[playerId].nobleIds
      .find((id) => !previousNobles.includes(id));
    const nobleReward = claimedNobleId ? {
      source: nobleSources.get(claimedNobleId) ?? null,
      target: document.querySelector<HTMLElement>(`[data-player-id="${playerId}"] .player-panel__score`),
    } : null;
    if (nobleReward) setScoreAnimation({ playerId, previous: before.game.players[playerId].score, phase: 'flying' });
    const signal = rewardController.current.signal;
    void Promise.all(flights.map(async ({ color, source, target }, index) => {
      if (index > 0) await new Promise((resolve) => window.setTimeout(resolve, index * 130));
      await flyBoardReward(source, target, 'gem', signal);
      if (!signal.aborted) setGemAnimation((current) => current ? {
        ...current, arrived: { ...current.arrived, [color]: current.arrived[color] + 1 },
      } : null);
    })).then(async () => {
      if (signal.aborted) return;
      setGemAnimation((current) => current ? { ...current, phase: 'arrived' } : null);
      if (nobleReward) {
        await flyBoardReward(nobleReward.source, nobleReward.target, 'noble', signal);
        if (!signal.aborted) setScoreAnimation((current) => current ? { ...current, phase: 'arrived' } : null);
      }
    });
  };

  const handleReservation = (reserve: () => boolean): boolean => {
    const before = useDemoGemStore.getState();
    const playerId = before.currentPlayerId;
    const previous = { ...before.game.players[playerId].gems };
    const source = captureRewardSource(document.querySelector<HTMLElement>('[data-bank-color="gold"] .gem-icon'));
    const target = document.querySelector<HTMLElement>(`[data-player-id="${playerId}"] [data-held-color="gold"]`);
    if (before.bank.gold > 0) {
      setGemAnimation({ playerId, previous, arrived: emptyCounts(), phase: 'flying' });
    }
    if (!reserve()) {
      setGemAnimation(null);
      return false;
    }
    const goldReceived = useDemoGemStore.getState().game.players[playerId].gems.gold > previous.gold;
    if (!goldReceived) {
      setGemAnimation(null);
      return true;
    }
    const signal = rewardController.current.signal;
    void flyBoardReward(source, target, 'gem', signal).then(() => {
      if (signal.aborted) return;
      setGemAnimation((current) => current ? {
        ...current, arrived: { ...current.arrived, gold: 1 }, phase: 'arrived',
      } : null);
    });
    return true;
  };

  const handleChooseNoble = (nobleId: string) => {
    const before = useDemoGemStore.getState();
    const playerId = before.currentPlayerId;
    const previous = before.game.players[playerId].score;
    const source = captureRewardSource(document.querySelector<HTMLElement>(`[data-noble-id="${nobleId}"]`));
    const target = document.querySelector<HTMLElement>(`[data-player-id="${playerId}"] .player-panel__score`);
    setScoreAnimation({ playerId, previous, phase: 'flying' });
    if (!chooseNoble(nobleId)) {
      setScoreAnimation(null);
      return;
    }
    void flyBoardReward(source, target, 'noble', rewardController.current.signal).then(() => {
      if (!rewardController.current.signal.aborted) setScoreAnimation((current) => current ? { ...current, phase: 'arrived' } : null);
    });
  };
  return (
    <div className="game-page">
      <div className="preview-notice"><span className="preview-notice__dot" />{scenario === 'fullGame' ? `${players.length}인 로컬 게임` : '로컬 게임 연습'}<span> · 실제 대전 연결 전</span></div>
      <div className="game-heading">
        <div><span className="eyebrow">THE BOARD · {game.playerOrder.length} PLAYERS</span><h1>게임판</h1>
          {scenario === 'nobleFinish' && phase === 'selecting' && <p>강조된 1단계 빨간 카드를 구매해 귀족·종료 상황을 확인하세요.</p>}
          <div className="local-match-controls" role="group" aria-label="새 로컬 게임">
            <label htmlFor="local-player-count">인원</label>
            <select id="local-player-count" value={playerCount} onChange={(event) => setPlayerCount(Number(event.target.value) as 2 | 3 | 4)}>
              <option value={2}>2명</option><option value={3}>3명</option><option value={4}>4명</option>
            </select>
            <button type="button" onClick={() => startNewGame(playerCount)}>새 로컬 게임</button>
            {scenario === 'fullGame' && <button type="button" className="local-match-controls__secondary" onClick={reset}>샘플로 돌아가기</button>}
          </div>
        </div>
        <div className="game-heading__side">
          <button type="button" className="reserved-trigger" onClick={() => setReservedOpen(true)} aria-haspopup="dialog">
            <span aria-hidden="true">▣</span> 내 예약 카드 <strong>{reservedCardIds.length} / 3</strong>
          </button>
          <div className={`turn-pill${countdown.isWarning && scenario === 'fullGame' ? ' turn-pill--warning' : ''}`}>
            <span className="turn-pill__light" />
            <div className="turn-pill__player"><small>{phase === 'finished' ? '승자' : phase === 'awaitingStart' ? '시작 대기' : phase === 'completed' ? '턴 정리 중' : phase === 'choosingNoble' ? '귀족 선택' : '현재 차례'}</small><strong>{phase === 'finished' ? game.winnerIds.map((id) => players.find((player) => player.id === id)?.name ?? id).join(' · ') : currentPlayer?.name ?? '플레이어'}</strong></div>
            {scenario === 'fullGame' && phase !== 'finished' && <div className="turn-pill__clock" role="timer" aria-label={phase === 'awaitingStart' ? '게임 시작 대기, 턴 제한 3분' : countdown.isWaiting ? '다음 플레이어 시작 대기' : `남은 시간 ${countdown.time}`}>
              <small role={countdown.isWarning ? 'status' : undefined}>{countdown.isWaiting ? '시작 대기' : countdown.isWarning ? '30초 이하' : '남은 시간'}</small>
              <strong>{phase === 'awaitingStart' ? '03:00' : countdown.isWaiting ? '—:—' : countdown.time}</strong>
            </div>}
          </div>
        </div>
      </div>

      <div className="game-layout">
        <aside className="players-column" aria-label="플레이어 현황">
          <div className="column-heading"><span className="eyebrow">PLAYERS</span><h2>플레이어</h2></div>
          <div className="players-list">{players.map((player) => {
            const live = game.players[player.id];
            return <PlayerPanel player={{ ...player, score: live.score,
              bonuses: countCardBonuses(live.purchasedCardIds), purchasedCount: live.purchasedCardIds.length,
              reservedCount: live.reservedCardIds.length }}
              isCurrent={player.id === displayedPlayerId} gems={live.gems}
              bonusAnimation={bonusAnimation?.playerId === player.id ? bonusAnimation : undefined}
              gemAnimation={gemAnimation?.playerId === player.id ? gemAnimation : undefined}
              scoreAnimation={scoreAnimation?.playerId === player.id ? scoreAnimation : undefined} key={player.id} />;
          })}</div>
        </aside>

        <div className="board-column">
          <NobleGallery nobles={availableNobles} eligibleIds={nobleChoices}
            onChoose={phase === 'choosingNoble' ? handleChooseNoble : undefined} />
          <section className="market-section" aria-labelledby="market-title">
            <div className="section-heading"><div><span className="eyebrow">MARKET</span><h2 id="market-title">개발 카드 시장</h2></div><span className="section-heading__meta">단계별 4장</span></div>
            <div className="market-levels">{levels.map((level) => (
              <div className={`market-row market-row--level-${level}`} key={level}>
                <div className="market-row__label"><span>LEVEL</span><strong>{level}</strong><small>덱 {decks[level].length}장</small>
                  <button type="button" className="market-row__reserve-deck" onClick={() => handleReservation(() => reserveDeckCard(level))}
                    disabled={phase !== 'selecting' || decks[level].length === 0 || reservedCardIds.length >= 3}
                    aria-label={`${level}단계 덱 맨 위 카드 예약`}>덱 예약</button></div>
                <div className="market-row__cards">{market[level].map((id, slot) => {
                  const card = id ? getDevelopmentCard(id) : undefined;
                  return card ? <MarketCard card={card} bonuses={currentBonuses} key={`${level}-${slot}`} onSelect={() => selectCard(card.id, 'market')}
                    disabled={phase !== 'selecting'} featured={scenario === 'nobleFinish' && phase === 'selecting' && card.id === 'L1-RED-07'} />
                    : <div className="market-card-empty" key={`${level}-${slot}`}>빈 칸</div>;
                })}</div>
              </div>
            ))}</div>
          </section>
        </div>

        <aside className="bank-column" aria-label="보석 은행과 현재 행동">
          <div className="section-heading bank-column__heading"><div><span className="eyebrow">SUPPLY</span><h2 id="bank-title">보석 은행</h2></div><span className="side-card__symbol" aria-hidden="true">✦</span></div>
          <GemBank bank={bank} mode={mode} phase={phase} selectedColors={selectedColors} onSelect={selectColor} />
          <GemActionPanel onTakeGems={handleTakeGems} suspendReturnDialog={gemAnimation?.phase === 'flying'} />
        </aside>
      </div>
      {(bonusAnimation?.phase === 'flying' || gemAnimation?.phase === 'flying' || scoreAnimation?.phase === 'flying') &&
        <div className="board-reward-shield" aria-hidden="true" />}
      {reservedOpen && <ReservedCardsModal cardIds={reservedCardIds} playerName={currentPlayer?.name ?? '내'} bonuses={currentBonuses}
        onSelect={(id) => { setReservedOpen(false); selectCard(id, 'reserved'); }} onClose={() => setReservedOpen(false)} />}
      {selectedCard && selectedCardData && <CardActionModal key={`${selectedCard.source}-${selectedCard.id}`}
        card={selectedCardData} source={selectedCard.source} onClose={closeCard}
        onReserve={(cardId) => handleReservation(() => useDemoGemStore.getState().reserveMarketCard(cardId))}
        onPurchaseStart={(playerId, color, previousCount, nobleReward) => {
          setBonusAnimation({ playerId, color, previousCount, phase: 'flying' });
          pendingNobleReward.current = nobleReward ? { playerId, ...nobleReward } : null;
          if (nobleReward) setScoreAnimation({ playerId, previous: nobleReward.previousScore, phase: 'flying' });
        }}
        onPurchaseArrive={() => {
          setBonusAnimation((current) => current ? { ...current, phase: 'arrived' } : null);
          const reward = pendingNobleReward.current;
          pendingNobleReward.current = null;
          if (!reward) return;
          const target = document.querySelector<HTMLElement>(`[data-player-id="${reward.playerId}"] .player-panel__score`);
          const signal = rewardController.current.signal;
          void flyBoardReward(reward.source, target, 'noble', signal).then(() => {
            if (!signal.aborted) setScoreAnimation((current) => current ? { ...current, phase: 'arrived' } : null);
          });
        }} />}
      {phase === 'finished' && !bonusAnimation && !gemAnimation && !scoreAnimation && <GameResultModal game={game} players={players} onRestart={restart}
        restartLabel={scenario === 'fullGame' ? '같은 인원으로 새 게임' : '새 연습 시작'} />}
      {phase === 'awaitingStart' && <GameStartModal playerCount={players.length}
        firstPlayerName={currentPlayer?.name ?? '첫 번째 플레이어'} onStart={beginGame} />}
    </div>
  );
}

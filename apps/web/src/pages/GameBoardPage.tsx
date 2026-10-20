import { Link, useParams } from 'react-router-dom';
import { countCardBonuses, eligibleNobleIds, getDevelopmentCard, getNoble } from '@gem-arena/engine';
import type { CardLevel } from '@gem-arena/engine';
import { CardActionModal } from '../components/CardActionModal';
import { GemBank } from '../components/GemBank';
import { GemActionPanel } from '../components/GemActionPanel';
import { GameResultModal } from '../components/GameResultModal';
import { MarketCard } from '../components/MarketCard';
import { NobleGallery } from '../components/NobleGallery';
import { PlayerPanel } from '../components/PlayerPanel';
import { previewGame } from '../data/previewGame';
import { useDemoGemStore } from '../stores/demoGemStore';
import { useGameUIStore } from '../stores/gameUIStore';

const levels: CardLevel[] = [3, 2, 1];

export function GameBoardPage() {
  const { roomId } = useParams();
  const { bank, mode, phase, selectedColors, selectColor, market, decks,
    reservedCardIds, game, scenario, currentPlayerId, chooseNoble, reset } = useDemoGemStore();
  const { selectedCard, selectCard, closeCard } = useGameUIStore();
  const selectedCardData = selectedCard ? getDevelopmentCard(selectedCard.id) : undefined;
  const currentPlayer = previewGame.players.find((player) => player.id === currentPlayerId);
  const availableNobles = game.availableNobleIds.map((id) => getNoble(id)).filter((noble) => noble !== undefined);
  const nobleChoices = phase === 'choosingNoble' ? eligibleNobleIds(game, currentPlayerId) : [];
  if (roomId !== 'demo') {
    return <section className="empty-page"><h1>아직 연결되지 않은 게임입니다</h1><p>현재는 로컬 게임판 미리보기를 확인할 수 있습니다.</p><Link className="primary-link" to="/game/demo">미리보기 열기</Link></section>;
  }

  return (
    <div className="game-page">
      <div className="preview-notice"><span className="preview-notice__dot" />로컬 게임 연습<span> · 실제 대전 연결 전</span></div>
      <div className="game-heading">
        <div><span className="eyebrow">THE BOARD · {game.playerOrder.length} PLAYERS</span><h1>게임판</h1><p>{scenario === 'nobleFinish' && phase === 'selecting'
          ? '금색 테두리의 1단계 빨간 카드를 구매하세요. 귀족 선택 후 15점으로 게임이 종료됩니다.'
          : '보석을 모으고, 카드를 구매하고, 귀족을 맞이하세요.'}</p></div>
        <div className="turn-pill"><span className="turn-pill__light" /><div><small>{phase === 'finished' ? '승자' : phase === 'completed' ? '다음 차례' : phase === 'choosingNoble' ? '귀족 선택' : '현재 차례'}</small><strong>{phase === 'finished' ? game.winnerIds.map((id) => previewGame.players.find((player) => player.id === id)?.name ?? id).join(' · ') : currentPlayer?.name ?? '플레이어'}</strong></div></div>
      </div>

      <div className="game-layout">
        <aside className="players-column" aria-label="플레이어 현황">
          <div className="column-heading"><span className="eyebrow">PLAYERS</span><h2>플레이어</h2></div>
          <div className="players-list">{previewGame.players.map((player) => {
            const live = game.players[player.id];
            return <PlayerPanel player={{ ...player, score: live.score,
              bonuses: countCardBonuses(live.purchasedCardIds), purchasedCount: live.purchasedCardIds.length,
              reservedCount: live.reservedCardIds.length }}
              isCurrent={player.id === currentPlayerId} gems={live.gems} key={player.id} />;
          })}</div>
          <div className="side-card turn-help"><span className="eyebrow">TURN FLOW</span><h2>{phase === 'discarding' ? '초과 보석 반환' : phase === 'choosingNoble' ? '귀족 선택' : phase === 'finished' ? '게임 종료' : phase === 'completed' ? '턴 완료' : '한 턴에 한 가지 행동'}</h2><p>{phase === 'discarding' ? '보석을 정확히 반환해야 턴을 마칠 수 있습니다.' : phase === 'choosingNoble' ? '조건에 맞는 귀족 중 한 명을 선택해야 다음 턴으로 넘어갑니다.' : phase === 'finished' ? '결과 화면에서 순위와 승자를 확인하세요.' : phase === 'completed' ? '다음 플레이어 버튼으로 턴을 넘기세요.' : '은행의 보석을 받거나, 시장 카드를 눌러 구매·예약해 보세요.'}</p><span>{game.finalRoundTriggeredBy ? '최종 라운드 진행 중 · 마지막 플레이어가 끝나면 결과가 표시됩니다.' : '15점 이상을 얻으면 최종 라운드가 시작됩니다.'}</span></div>
        </aside>

        <div className="board-column">
          <NobleGallery nobles={availableNobles} eligibleIds={nobleChoices}
            onChoose={phase === 'choosingNoble' ? chooseNoble : undefined} />
          <section className="market-section" aria-labelledby="market-title">
            <div className="section-heading"><div><span className="eyebrow">MARKET</span><h2 id="market-title">개발 카드 시장</h2></div><span className="section-heading__meta">단계별 4장</span></div>
            <div className="market-levels">{levels.map((level) => (
              <div className="market-row" key={level}>
                <div className="market-row__label"><span>LEVEL</span><strong>{level}</strong><small>덱 {decks[level].length}장</small></div>
                <div className="market-row__cards">{market[level].map((id, slot) => {
                  const card = id ? getDevelopmentCard(id) : undefined;
                  return card ? <MarketCard card={card} key={`${level}-${slot}`} onSelect={() => selectCard(card.id, 'market')}
                    disabled={phase !== 'selecting'} featured={scenario === 'nobleFinish' && phase === 'selecting' && card.id === 'L1-RED-07'} />
                    : <div className="market-card-empty" key={`${level}-${slot}`}>빈 칸</div>;
                })}</div>
              </div>
            ))}</div>
          </section>
          <section className="reserved-section" aria-labelledby="reserved-title">
            <div className="section-heading"><div><span className="eyebrow">MY CARDS</span><h2 id="reserved-title">내 예약 카드</h2></div><span className="section-heading__meta">{reservedCardIds.length} / 3장</span></div>
            <div className="reserved-section__cards">{reservedCardIds.map((id) => {
              const card = getDevelopmentCard(id);
              return card && <MarketCard card={card} key={id} onSelect={() => selectCard(id, 'reserved')} disabled={phase !== 'selecting'} />;
            })}</div>
          </section>
        </div>

        <aside className="bank-column" aria-label="공급과 안내">
          <GemBank bank={bank} mode={mode} phase={phase} selectedColors={selectedColors} onSelect={selectColor} />
          <GemActionPanel />
          <section className="side-card legend-card" aria-labelledby="legend-title"><span className="eyebrow">HOW TO READ</span><h2 id="legend-title">카드 보는 법</h2><div className="legend-card__row"><span>01</span><p>오른쪽 위 숫자는 승점입니다.</p></div><div className="legend-card__row"><span>02</span><p>아래 보석은 구매 비용입니다.</p></div><div className="legend-card__row"><span>03</span><p>구매한 카드는 같은 색의 영구 할인을 줍니다.</p></div></section>
        </aside>
      </div>
      {selectedCard && selectedCardData && <CardActionModal key={`${selectedCard.source}-${selectedCard.id}`}
        card={selectedCardData} source={selectedCard.source} onClose={closeCard} />}
      {phase === 'finished' && <GameResultModal game={game} players={previewGame.players} onRestart={reset} />}
    </div>
  );
}

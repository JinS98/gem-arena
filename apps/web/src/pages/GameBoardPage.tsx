import { Link, useParams } from 'react-router-dom';
import type { CardLevel } from '@gem-arena/engine';
import { GemBank } from '../components/GemBank';
import { GemActionPanel } from '../components/GemActionPanel';
import { MarketCard } from '../components/MarketCard';
import { NobleGallery } from '../components/NobleGallery';
import { PlayerPanel } from '../components/PlayerPanel';
import { previewGame } from '../data/previewGame';
import { useDemoGemStore } from '../stores/demoGemStore';

const levels: CardLevel[] = [3, 2, 1];

export function GameBoardPage() {
  const { roomId } = useParams();
  const { bank, gems, mode, phase, selectedColors, selectColor } = useDemoGemStore();
  if (roomId !== 'demo') {
    return <section className="empty-page"><h1>아직 연결되지 않은 게임입니다</h1><p>현재는 로컬 게임판 미리보기를 확인할 수 있습니다.</p><Link className="primary-link" to="/game/demo">미리보기 열기</Link></section>;
  }

  return (
    <div className="game-page">
      <div className="preview-notice"><span className="preview-notice__dot" />로컬 보석 연습<span> · 실제 대전 연결 전</span></div>
      <div className="game-heading">
        <div><span className="eyebrow">THE BOARD · 3 PLAYERS</span><h1>게임판</h1><p>보석을 모으고, 카드를 구매하고, 귀족을 맞이하세요.</p></div>
        <div className="turn-pill"><span className="turn-pill__light" /><div><small>현재 차례</small><strong>나</strong></div></div>
      </div>

      <div className="game-layout">
        <aside className="players-column" aria-label="플레이어 현황">
          <div className="column-heading"><span className="eyebrow">PLAYERS</span><h2>플레이어</h2></div>
          <div className="players-list">{previewGame.players.map((player) => (
            <PlayerPanel player={player} isCurrent={player.id === previewGame.currentPlayerId} gems={player.isLocal ? gems : player.gems} key={player.id} />
          ))}</div>
          <div className="side-card turn-help"><span className="eyebrow">YOUR TURN</span><h2>{phase === 'discarding' ? '초과 보석 반환' : phase === 'completed' ? '연습 턴 완료' : '한 턴에 한 가지 행동'}</h2><p>{phase === 'discarding' ? '보석을 정확히 반환해야 턴을 마칠 수 있습니다.' : phase === 'completed' ? '다른 상황을 연습하려면 아래에서 초기화하세요.' : '오른쪽 은행에서 보석을 선택하고 획득해 보세요.'}</p><span>카드 구매·예약 조작은 16일차에 연결됩니다.</span></div>
        </aside>

        <div className="board-column">
          <NobleGallery nobles={previewGame.nobles} />
          <section className="market-section" aria-labelledby="market-title">
            <div className="section-heading"><div><span className="eyebrow">MARKET</span><h2 id="market-title">개발 카드 시장</h2></div><span className="section-heading__meta">단계별 4장</span></div>
            <div className="market-levels">{levels.map((level) => (
              <div className="market-row" key={level}>
                <div className="market-row__label"><span>LEVEL</span><strong>{level}</strong><small>덱 {previewGame.deckCounts[level]}장</small></div>
                <div className="market-row__cards">{previewGame.market[level].map((card) => <MarketCard card={card} key={card.id} />)}</div>
              </div>
            ))}</div>
          </section>
        </div>

        <aside className="bank-column" aria-label="공급과 안내">
          <GemBank bank={bank} mode={mode} phase={phase} selectedColors={selectedColors} onSelect={selectColor} />
          <GemActionPanel />
          <section className="side-card legend-card" aria-labelledby="legend-title"><span className="eyebrow">HOW TO READ</span><h2 id="legend-title">카드 보는 법</h2><div className="legend-card__row"><span>01</span><p>오른쪽 위 숫자는 승점입니다.</p></div><div className="legend-card__row"><span>02</span><p>아래 보석은 구매 비용입니다.</p></div><div className="legend-card__row"><span>03</span><p>구매한 카드는 같은 색의 영구 할인을 줍니다.</p></div></section>
        </aside>
      </div>
    </div>
  );
}

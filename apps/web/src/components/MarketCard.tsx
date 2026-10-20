import { CARD_COLORS } from '@gem-arena/engine';
import type { DevelopmentCard } from '@gem-arena/engine';
import { GemIcon, gemNames } from './GemIcon';

export function MarketCard({ card, onSelect, disabled = false }: { card: DevelopmentCard; onSelect: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`market-card market-card--${card.bonusColor}`} onClick={onSelect} disabled={disabled} aria-label={`${card.level}단계 ${gemNames[card.bonusColor]} 카드, ${card.points}점, 구매 또는 예약 보기`}>
      <div className="market-card__top">
        <span className="market-card__level">LEVEL {card.level}</span>
        <span className="market-card__points">{card.points}<small>점</small></span>
      </div>
      <div className="market-card__art" aria-hidden="true">
        <span className="market-card__orbit market-card__orbit--outer" />
        <span className="market-card__orbit market-card__orbit--inner" />
        <span className="market-card__crystal" />
      </div>
      <div className="market-card__bottom">
        <div className="market-card__type"><GemIcon color={card.bonusColor} small /><span>{gemNames[card.bonusColor]} 보너스</span></div>
        <div className="market-card__cost" aria-label="구매 비용">
          {CARD_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
            <span className={`cost-chip cost-chip--${color}`} key={color} title={`${gemNames[color]} ${card.cost[color]}개`} aria-label={`${gemNames[color]} ${card.cost[color]}개`}>
              <GemIcon color={color} small />{card.cost[color]}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

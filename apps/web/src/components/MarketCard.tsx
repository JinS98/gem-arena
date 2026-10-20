import { CARD_COLORS } from '@gem-arena/engine';
import type { DevelopmentCard } from '@gem-arena/engine';
import { developmentCardArtwork } from './cardArtwork';
import { GemIcon, gemNames } from './GemIcon';

export function CardFace({ card }: { card: DevelopmentCard }) {
  return (
    <div className={`card-face card-face--${card.bonusColor} card-face--level-${card.level}`}>
      <img className="card-face__portrait" src={developmentCardArtwork(card)} alt="" loading="lazy" />
      <span className="card-face__points" aria-hidden="true">{card.points}</span>
      <span className={`card-face__bonus gem-box gem-box--${card.bonusColor}`} aria-hidden="true"><GemIcon color={card.bonusColor} /></span>
      <div className="card-face__cost" aria-hidden="true">
        {CARD_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
          <span className={`card-face__cost-chip card-face__cost-chip--${color}`} key={color}>
            <GemIcon color={color} small /><strong>{card.cost[color]}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarketCard({ card, onSelect, disabled = false, featured = false }: {
  card: DevelopmentCard; onSelect: () => void; disabled?: boolean; featured?: boolean;
}) {
  const costDescription = CARD_COLORS.filter((color) => card.cost[color] > 0)
    .map((color) => `${gemNames[color]} ${card.cost[color]}개`).join(', ');
  return (
    <button type="button" className={`market-card${featured ? ' market-card--featured' : ''}`} onClick={onSelect} disabled={disabled}
      aria-label={`${card.level}단계 ${gemNames[card.bonusColor]} 카드, ${card.points}점, 비용 ${costDescription}, 구매 또는 예약 보기`}>
      <CardFace card={card} />
    </button>
  );
}

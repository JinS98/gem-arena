import { CARD_COLORS, remainingCardCost } from '@gem-arena/engine';
import type { ColorCounts, DevelopmentCard } from '@gem-arena/engine';
import { developmentCardArtwork } from './cardArtwork';
import { GemIcon, gemNames } from './GemIcon';

export function CardFace({ card, discountedCost, discountCount = 0 }: {
  card: DevelopmentCard; discountedCost?: ColorCounts; discountCount?: number;
}) {
  return (
    <div className={`card-face card-face--${card.bonusColor} card-face--level-${card.level}`}>
      <img className="card-face__portrait" src={developmentCardArtwork(card)} alt="" loading="lazy" />
      <span className="card-face__points" aria-hidden="true">{card.points}</span>
      <span className={`card-face__bonus gem-box gem-box--${card.bonusColor}`} aria-hidden="true"><GemIcon color={card.bonusColor} /></span>
      <div className={`card-face__cost${discountedCost ? ' card-face__cost--printed' : ''}`} aria-hidden="true">
        {CARD_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
          <span className={`card-face__cost-chip card-face__cost-chip--${color}`} key={color}>
            <GemIcon color={color} small /><strong>{card.cost[color]}</strong>
          </span>
        ))}
      </div>
      {discountedCost && <>
        <span className="card-face__discount-tag" aria-hidden="true">할인 적용 −{discountCount}</span>
        <div className="card-face__cost card-face__cost--discounted" aria-hidden="true">
          {CARD_COLORS.some(color => discountedCost[color] > 0)
            ? CARD_COLORS.filter(color => discountedCost[color] > 0).map(color => (
              <span className={`card-face__cost-chip card-face__cost-chip--${color}${discountedCost[color] < card.cost[color] ? ' card-face__cost-chip--reduced' : ''}`} key={color}>
                <GemIcon color={color} small /><strong>{discountedCost[color]}</strong>
              </span>
            ))
            : <span className="card-face__cost-free">무료</span>}
        </div>
      </>}
    </div>
  );
}

export function MarketCard({ card, onSelect, disabled = false, featured = false, className = '', bonuses }: {
  card: DevelopmentCard; onSelect: () => void; disabled?: boolean; featured?: boolean; className?: string; bonuses?: ColorCounts;
}) {
  const remaining = bonuses ? remainingCardCost(card.cost, bonuses) : null;
  const discountCount = remaining ? CARD_COLORS.reduce((sum, color) => sum + card.cost[color] - remaining[color], 0) : 0;
  const discountedCost = discountCount > 0 ? remaining ?? undefined : undefined;
  const costDescription = CARD_COLORS.filter((color) => card.cost[color] > 0)
    .map((color) => `${gemNames[color]} ${card.cost[color]}개`).join(', ') || '무료';
  const remainingDescription = discountedCost
    ? CARD_COLORS.filter(color => discountedCost[color] > 0).map(color => `${gemNames[color]} ${discountedCost[color]}개`).join(', ') || '무료'
    : '';
  return (
    <button type="button" className={`market-card${featured ? ' market-card--featured' : ''}${discountedCost ? ' market-card--discounted' : ''}${className ? ` ${className}` : ''}`} onClick={onSelect} disabled={disabled}
      aria-label={`${card.level}단계 ${gemNames[card.bonusColor]} 카드, ${card.points}점, 인쇄 비용 ${costDescription}${discountedCost ? `, 내 할인 적용 비용 ${remainingDescription}` : ''}, 구매 또는 예약 보기`}>
      <CardFace card={card} discountedCost={discountedCost} discountCount={discountCount} />
    </button>
  );
}

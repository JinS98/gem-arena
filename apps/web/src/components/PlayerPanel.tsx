import type { GemColor, Inventory } from '@gem-arena/engine';
import type { PreviewPlayer } from '../data/previewGame';
import { GemIcon, gemNames } from './GemIcon';

const colors: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];

export function PlayerPanel({ player, isCurrent, forfeited = false, gems = player.gems, showGemNames = false, bonusAnimation, gemAnimation, scoreAnimation }: {
  player: PreviewPlayer; isCurrent: boolean; forfeited?: boolean; gems?: PreviewPlayer['gems'];
  showGemNames?: boolean;
  bonusAnimation?: { color: GemColor; previousCount: number; phase: 'flying' | 'arrived' };
  gemAnimation?: { previous: Inventory; arrived: Inventory; phase: 'flying' | 'arrived' };
  scoreAnimation?: { previous: number; phase: 'flying' | 'arrived' };
}) {
  const displayedGems = gemAnimation?.phase === 'flying'
    ? Object.keys(gems).reduce((sum, color) => sum + gemAnimation.previous[color as keyof Inventory] + gemAnimation.arrived[color as keyof Inventory], 0)
    : Object.values(gems).reduce((sum, count) => sum + count, 0);
  return (
    <article className={`player-panel${isCurrent ? ' player-panel--current' : ''}`} data-player-id={player.id} aria-label={`${player.name}, ${player.score}점${forfeited ? ', 기권' : isCurrent ? ', 현재 차례' : ''}`}>
      <div className="player-panel__top">
        <span className={`player-panel__avatar${player.isLocal ? ' player-panel__avatar--local' : ''}`}>{player.initials}</span>
        <div className="player-panel__identity">
          <div className="player-panel__name-line">
            <strong>{player.name}</strong>
            {player.isLocal && <span className="player-panel__self">나</span>}
          </div>
          <span className="player-panel__status">{forfeited ? '기권 · 자산 제외' : isCurrent ? `현재 차례 · ${player.purchasedCount}장 구매 · ${player.reservedCount}장 예약` : `${player.purchasedCount}장 구매 · ${player.reservedCount}장 예약`}</span>
        </div>
        <div className={`player-panel__score${scoreAnimation?.phase === 'arrived' ? ' player-panel__score--arrived' : ''}`}><strong>{scoreAnimation?.phase === 'flying' ? scoreAnimation.previous : player.score}</strong><span>점</span></div>
      </div>
      <div className="player-panel__resources">
        <div className="player-panel__bonus-group">
          <div className="player-panel__resource-heading"><span>구매 카드 보너스</span><small>영구 할인</small></div>
          <div className="player-panel__bonuses" aria-label={`${player.name} 구매 카드 보너스`}>
            {colors.map((color) => (
              <span className={`bonus-chip gem-box gem-box--${color}${bonusAnimation?.color === color && bonusAnimation.phase === 'arrived' ? ' bonus-chip--arrived' : ''}`} data-bonus-color={color} key={color} title={`${gemNames[color]} 할인 ${player.bonuses[color]}`} aria-label={`${gemNames[color]} 할인 ${player.bonuses[color]}`}>
                <GemIcon color={color} small /><span className="bonus-chip__count">{bonusAnimation?.color === color && bonusAnimation.phase === 'flying' ? bonusAnimation.previousCount : player.bonuses[color]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="player-panel__held-group">
          <div className="player-panel__inventory">
            <span>보유 보석</span><strong>{displayedGems} <small>/ 10</small></strong>
          </div>
          <div className="player-panel__held" aria-label={`${player.name} 보유 보석`}>
            {([...colors, 'gold'] as const).map((color) => <span className={`gem-box gem-box--${color}${gemAnimation && gemAnimation.arrived[color] > 0 ? ' player-panel__held--arrived' : ''}`} data-held-color={color} key={color} title={`${gemNames[color]} ${gems[color]}개`}><GemIcon color={color} small />{showGemNames && <span className="player-panel__gem-name">{gemNames[color]}</span>}<span className="player-panel__held-count" key={gemAnimation?.arrived[color] ?? 0}>{gemAnimation && gemAnimation.phase === 'flying' ? gemAnimation.previous[color] + gemAnimation.arrived[color] : gems[color]}</span></span>)}
          </div>
        </div>
      </div>
    </article>
  );
}

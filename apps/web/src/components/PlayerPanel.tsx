import type { GemColor } from '@gem-arena/engine';
import type { PreviewPlayer } from '../data/previewGame';
import { GemIcon, gemNames } from './GemIcon';

const colors: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];

export function PlayerPanel({ player, isCurrent }: { player: PreviewPlayer; isCurrent: boolean }) {
  const totalGems = Object.values(player.gems).reduce((sum, count) => sum + count, 0);
  return (
    <article className={`player-panel${isCurrent ? ' player-panel--current' : ''}`} aria-label={`${player.name}, ${player.score}점${isCurrent ? ', 현재 차례' : ''}`}>
      <div className="player-panel__top">
        <span className={`player-panel__avatar${player.isLocal ? ' player-panel__avatar--local' : ''}`}>{player.initials}</span>
        <div className="player-panel__identity">
          <div className="player-panel__name-line">
            <strong>{player.name}</strong>
            {player.isLocal && <span className="player-panel__self">나</span>}
          </div>
          <span className="player-panel__status">{isCurrent ? '현재 차례' : `${player.purchasedCount}장 구매 · ${player.reservedCount}장 예약`}</span>
        </div>
        <div className="player-panel__score"><strong>{player.score}</strong><span>점</span></div>
      </div>
      <div className="player-panel__bonuses" aria-label="영구 할인">
        {colors.map((color) => (
          <span className={`bonus-chip bonus-chip--${color}`} key={color} title={`${gemNames[color]} 할인 ${player.bonuses[color]}`} aria-label={`${gemNames[color]} 할인 ${player.bonuses[color]}`}>
            <GemIcon color={color} small /> {player.bonuses[color]}
          </span>
        ))}
      </div>
      {player.isLocal && (
        <div className="player-panel__inventory">
          <span>보유 보석</span><strong>{totalGems} <small>/ 10</small></strong>
        </div>
      )}
    </article>
  );
}

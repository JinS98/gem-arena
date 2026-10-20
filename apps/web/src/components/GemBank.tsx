import type { Gem, GemColor, Inventory } from '@gem-arena/engine';
import type { GemMode, GemPracticePhase } from '../stores/demoGemStore';
import { GemIcon, gemNames } from './GemIcon';

const colors: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];

interface GemBankProps {
  bank: Inventory;
  mode: GemMode;
  phase: GemPracticePhase;
  selectedColors: GemColor[];
  onSelect: (color: GemColor) => void;
}

export function GemBank({ bank, mode, phase, selectedColors, onSelect }: GemBankProps) {
  return (
    <section className="side-card gem-bank" aria-labelledby="bank-title">
      <div className="side-card__heading"><div><span className="eyebrow">SUPPLY</span><h2 id="bank-title">보석 은행</h2></div><span className="side-card__symbol" aria-hidden="true">✦</span></div>
      <ul className="gem-bank__list">
        {colors.map((color) => (
          <li className="gem-bank__item" key={color}>
            {color === 'gold' ? (
              <div className="gem-bank__button gem-bank__button--static"><GemIcon color={color} /><span>{gemNames[color]} 보석</span><strong>{bank[color]}</strong></div>
            ) : (
              <button className={`gem-bank__button${selectedColors.includes(color) ? ' gem-bank__button--selected' : ''}`}
                type="button" onClick={() => onSelect(color)}
                disabled={phase !== 'selecting' || bank[color] === 0 ||
                  (mode === 'pair' && bank[color] < 4) ||
                  (mode === 'different' && selectedColors.length >= 3 && !selectedColors.includes(color))}
                aria-pressed={selectedColors.includes(color)}
                aria-label={`${gemNames[color]} 보석, 은행에 ${bank[color]}개${mode === 'pair' ? ', 같은 색 두 개 선택' : ''}`}>
                <GemIcon color={color} /><span>{gemNames[color]} 보석</span><strong>{bank[color]}</strong>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

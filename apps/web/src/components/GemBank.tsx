import type { Gem, Inventory } from '@gem-arena/engine';
import { GemIcon, gemNames } from './GemIcon';

const colors: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];

export function GemBank({ bank }: { bank: Inventory }) {
  return (
    <section className="side-card gem-bank" aria-labelledby="bank-title">
      <div className="side-card__heading"><div><span className="eyebrow">SUPPLY</span><h2 id="bank-title">보석 은행</h2></div><span className="side-card__symbol" aria-hidden="true">✦</span></div>
      <ul className="gem-bank__list">
        {colors.map((color) => (
          <li className="gem-bank__item" key={color}>
            <GemIcon color={color} />
            <span>{gemNames[color]} 보석</span>
            <strong>{bank[color]}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

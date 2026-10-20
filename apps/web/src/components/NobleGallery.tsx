import { CARD_COLORS } from '@gem-arena/engine';
import type { Noble } from '@gem-arena/engine';
import { GemIcon, gemNames } from './GemIcon';

export function NobleGallery({ nobles }: { nobles: Noble[] }) {
  return (
    <section className="nobles-section" aria-labelledby="nobles-title">
      <div className="section-heading"><div><span className="eyebrow">NOBLES</span><h2 id="nobles-title">방문 가능한 귀족</h2></div><span className="section-heading__meta">{nobles.length}명 공개</span></div>
      <div className="nobles-grid">
        {nobles.map((noble, index) => (
          <article className="noble-card" key={noble.id} aria-label={`귀족 ${index + 1}, ${noble.points}점`}>
            <div className="noble-card__emblem" aria-hidden="true">✧</div>
            <div className="noble-card__body">
              <span className="noble-card__name">귀족 {String(index + 1).padStart(2, '0')}</span>
              <div className="noble-card__requirements" aria-label="필요한 영구 할인">
                {CARD_COLORS.filter((color) => noble.requirements[color] > 0).map((color) => (
                  <span key={color} title={`${gemNames[color]} 할인 ${noble.requirements[color]}`} aria-label={`${gemNames[color]} 할인 ${noble.requirements[color]}`}><GemIcon color={color} small />{noble.requirements[color]}</span>
                ))}
              </div>
            </div>
            <strong className="noble-card__points">+{noble.points}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

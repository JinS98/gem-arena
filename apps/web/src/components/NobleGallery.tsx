import { CARD_COLORS, NOBLES } from '@gem-arena/engine';
import type { Noble } from '@gem-arena/engine';
import nobleOne from '../assets/cards/noble-1.jpg';
import nobleTwo from '../assets/cards/noble-2.jpg';
import nobleThree from '../assets/cards/noble-3.jpg';
import nobleFour from '../assets/cards/noble-4.jpg';
import nobleFive from '../assets/cards/noble-5.jpg';
import { GemIcon, gemNames } from './GemIcon';

const noblePortraits = [nobleOne, nobleTwo, nobleThree, nobleFour, nobleFive];

export function NobleGallery({ nobles, eligibleIds = [], onChoose }: {
  nobles: Noble[]; eligibleIds?: string[]; onChoose?: (id: string) => void;
}) {
  return (
    <section className="nobles-section" aria-labelledby="nobles-title">
      <div className="section-heading"><div><span className="eyebrow">NOBLES</span><h2 id="nobles-title">방문 가능한 귀족</h2></div><span className="section-heading__meta">{nobles.length}명 공개</span></div>
      {onChoose && <p className="nobles-section__prompt" role="status">조건을 만족한 귀족이 여러 명입니다. 이번 턴에 방문할 한 명을 선택하세요.</p>}
      <div className="nobles-grid">
        {nobles.map((noble, index) => {
          const portraitIndex = Math.max(0, NOBLES.findIndex((entry) => entry.id === noble.id)) % noblePortraits.length;
          const details = <>
            <img className="noble-card__portrait" src={noblePortraits[portraitIndex]} alt="" loading="lazy" />
            <div className="noble-card__body">
              <span className="noble-card__name">귀족 {String(index + 1).padStart(2, '0')}</span>
              <div className="noble-card__requirements" aria-label="필요한 영구 할인">
                {CARD_COLORS.filter((color) => noble.requirements[color] > 0).map((color) => (
                  <span className={`gem-box gem-box--${color}`} key={color} title={`${gemNames[color]} 할인 ${noble.requirements[color]}`} aria-label={`${gemNames[color]} 할인 ${noble.requirements[color]}`}><GemIcon color={color} small />{noble.requirements[color]}</span>
                ))}
              </div>
            </div>
            <strong className="noble-card__points">+{noble.points}</strong>
          </>;
          return onChoose ? <button type="button" className="noble-card noble-card--choice" key={noble.id}
            data-noble-id={noble.id}
            disabled={!eligibleIds.includes(noble.id)} onClick={() => onChoose(noble.id)}
            aria-label={`귀족 ${index + 1} 선택, ${noble.points}점`}>{details}</button>
            : <article className="noble-card" data-noble-id={noble.id} key={noble.id} aria-label={`귀족 ${index + 1}, ${noble.points}점`}>{details}</article>;
        })}
      </div>
    </section>
  );
}

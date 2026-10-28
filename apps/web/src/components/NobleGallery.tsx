import { CARD_COLORS, NOBLES } from '@gem-arena/engine';
import type { Noble } from '@gem-arena/engine';
import nobleOne from '../assets/cards/noble-1.jpg';
import nobleTwo from '../assets/cards/noble-2.jpg';
import nobleThree from '../assets/cards/noble-3.jpg';
import nobleFour from '../assets/cards/noble-4.jpg';
import nobleFive from '../assets/cards/noble-5.jpg';
import { GemIcon } from './GemIcon';
import { useGameTheme, useGemNames } from './GameTheme';
import { usePreviewAppearance } from './PreviewAppearance';
import { nobleThemeArtwork } from './cardArtwork';
import { narutoNobleNames } from '../data/narutoCards';

const noblePortraits = [nobleOne, nobleTwo, nobleThree, nobleFour, nobleFive];

export function NobleGallery({ nobles, eligibleIds = [], onChoose }: {
  nobles: Noble[]; eligibleIds?: string[]; onChoose?: (id: string) => void;
}) {
  const theme = useGameTheme();
  const preview = usePreviewAppearance();
  const gemNames = useGemNames();
  const nobleTitle = preview ? '스페셜 포토' : theme === 'lol' ? '전설적 동맹' : theme === 'demon-slayer' ? '특별 인연' : theme === 'naruto' ? '전설의 닌자' : '방문 가능한 귀족';
  const nobleShort = preview ? '포토' : theme === 'lol' ? '동맹' : theme === 'demon-slayer' ? '인연' : theme === 'naruto' ? '닌자' : '귀족';
  return (
    <section className="nobles-section" aria-labelledby="nobles-title">
      <div className="section-heading"><div><span className="eyebrow">NOBLES</span><h2 id="nobles-title">{nobleTitle}</h2></div><span className="section-heading__meta">{nobles.length}명 공개</span></div>
      {onChoose && <p className="nobles-section__prompt" role="status">조건을 만족한 {nobleShort}이 여러 명입니다. 이번 턴에 한 명을 선택하세요.</p>}
      <div className="nobles-grid">
        {nobles.map((noble, index) => {
          const portraitIndex = Math.max(0, NOBLES.findIndex((entry) => entry.id === noble.id));
          const nobleName = theme === 'naruto' ? narutoNobleNames[portraitIndex] : `${nobleShort} ${String(index + 1).padStart(2, '0')}`;
          const requirements = CARD_COLORS.filter(color => noble.requirements[color] > 0)
            .map(color => `${gemNames[color]} 할인 ${noble.requirements[color]}`).join(', ');
          const details = <>
            <img className="noble-card__portrait" src={preview ? preview.nobles[index % preview.nobles.length].src : nobleThemeArtwork(theme, portraitIndex, noblePortraits[portraitIndex % noblePortraits.length])} alt="" loading="lazy" />
            <div className="noble-card__body">
              <span className="noble-card__name">{preview ? preview.nobles[index % preview.nobles.length].label : nobleName}</span>
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
            aria-label={`${nobleName} 선택, ${noble.points}점, 필요 조건 ${requirements}`}>{details}</button>
            : <article className="noble-card" data-noble-id={noble.id} key={noble.id} aria-label={`${nobleName}, ${noble.points}점, 필요 조건 ${requirements}`}>{details}</article>;
        })}
      </div>
    </section>
  );
}

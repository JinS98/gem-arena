import { useEffect, useId, useRef } from 'react';
import { CARD_COLORS, getDevelopmentCard, type PublicPlayerView, type PublicReservedCard } from '@gem-arena/engine';
import { CardFace } from './MarketCard';
import { DeckCard } from './DeckCard';
import { useGemNames } from './GameTheme';
import './opponentReservedCards.scss';

export function OpponentReservedCardsModal({ playerName, player, onClose }: {
  playerName: string; player: PublicPlayerView; onClose: () => void;
}) {
  const titleId = useId();
  const gemNames = useGemNames();
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  // Older servers only publish the count. Missing information must remain face-down.
  const cards: PublicReservedCard[] = Array.from({ length: player.reservedCount }, (_, index) =>
    player.reservedCards?.[index] ?? { cardId: null, level: null });
  return <div className="reserved-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="reserved-modal opponent-reserved-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="reserved-modal__head"><div><span className="eyebrow">OPPONENT RESERVATIONS · {cards.length} / 3</span><h2 id={titleId}>{playerName}의 예약 카드</h2></div>
        <button ref={closeRef} type="button" aria-label="상대 예약 카드 닫기" onClick={onClose}>×</button></div>
      {cards.length === 0 ? <p className="reserved-modal__empty">현재 예약한 카드가 없습니다.</p> : <>
        <p className="reserved-modal__hint">시장에서 예약한 카드는 공개됩니다. 덱에서 가져온 카드는 뒷면만 확인할 수 있습니다.</p>
        <div className="opponent-reserved-cards">{cards.map((entry, index) => {
          const card = entry.cardId ? getDevelopmentCard(entry.cardId) : undefined;
          return <figure key={index} className={`opponent-reserved-card opponent-reserved-card--level-${entry.level ?? 1}${entry.level === null ? ' opponent-reserved-card--unknown' : ''}`}>
            {card ? <div className="opponent-reserved-card__face" role="img" aria-label={`${card.level}단계 ${gemNames[card.bonusColor]} 공개 예약 카드, ${card.points}점, 비용 ${CARD_COLORS.filter(color => card.cost[color] > 0).map(color => `${gemNames[color]} ${card.cost[color]}개`).join(', ') || '무료'}`}><CardFace card={card} /></div>
              : <div className="opponent-reserved-card__back" role="img" aria-label={`${entry.level ? `${entry.level}단계 ` : ''}비공개 예약 카드`}>
                <div aria-hidden="true"><DeckCard level={entry.level ?? 1} remaining={0} disabled onReserve={() => {}} /></div><span aria-hidden="true">비공개</span>
              </div>}
            <figcaption>{card ? '시장 예약 · 공개' : '비공개 예약'}</figcaption>
          </figure>;
        })}</div>
        {!player.reservedCards && <p className="reserved-modal__hint">공개 여부가 기록되지 않은 이전 예약 카드는 뒷면으로 표시합니다.</p>}
      </>}
    </section>
  </div>;
}

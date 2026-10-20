import { useEffect, useRef } from 'react';
import { getDevelopmentCard } from '@gem-arena/engine';
import { MarketCard } from './MarketCard';

export function ReservedCardsModal({ cardIds, playerName, onSelect, onClose }: {
  cardIds: string[]; playerName: string; onSelect: (cardId: string) => void; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      if (buttons.length === 0) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="reserved-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="reserved-modal" role="dialog" aria-modal="true" aria-labelledby="reserved-modal-title">
        <div className="reserved-modal__head">
          <div><span className="eyebrow">MY RESERVATIONS · {cardIds.length} / 3</span><h2 id="reserved-modal-title">{playerName} 예약 카드</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="예약 카드 창 닫기">×</button>
        </div>
        {cardIds.length === 0 ? <p className="reserved-modal__empty">현재 예약한 카드가 없습니다. 시장이나 단계별 덱에서 카드를 예약할 수 있습니다.</p>
          : <><p className="reserved-modal__hint">카드를 누르면 비용을 확인하고 구매할 수 있습니다.</p>
            <div className="reserved-modal__cards">{cardIds.map((id) => {
              const card = getDevelopmentCard(id);
              return card && <MarketCard key={id} card={card} onSelect={() => onSelect(id)} />;
            })}</div></>}
      </section>
    </div>
  );
}

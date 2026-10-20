import { useEffect, useRef, useState } from 'react';
import { CARD_COLORS, canPayForCard, countCardBonuses, remainingCardCost } from '@gem-arena/engine';
import type { DevelopmentCard, GemColor, Inventory } from '@gem-arena/engine';
import { useDemoGemStore } from '../stores/demoGemStore';
import { GemIcon, gemNames } from './GemIcon';

const emptyPayment = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

function suggestedPayment(card: DevelopmentCard, purchased: string[], held: Inventory): Inventory {
  const remaining = remainingCardCost(card.cost, countCardBonuses(purchased));
  const payment = emptyPayment();
  for (const color of CARD_COLORS) payment[color] = Math.min(remaining[color], held[color]);
  payment.gold = CARD_COLORS.reduce((sum, color) => sum + remaining[color] - payment[color], 0);
  return payment;
}

export function CardActionModal({ card, source, onClose }: {
  card: DevelopmentCard; source: 'market' | 'reserved'; onClose: () => void;
}) {
  const { gems, bank, purchasedCardIds, reservedCardIds, phase, purchaseCard, reserveMarketCard } = useDemoGemStore();
  const bonuses = countCardBonuses(purchasedCardIds);
  const remaining = remainingCardCost(card.cost, bonuses);
  const [payment, setPayment] = useState(() => suggestedPayment(card, purchasedCardIds, gems));
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canBuy = phase === 'selecting' && canPayForCard(card.cost, bonuses, gems, payment);
  const canReserve = source === 'market' && phase === 'selecting' && reservedCardIds.length < 3;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const changePayment = (color: GemColor, delta: -1 | 1) => {
    setPayment((current) => {
      const next = current[color] + delta;
      if (next < 0 || next > Math.min(remaining[color], gems[color])) return current;
      return { ...current, [color]: next, gold: current.gold - delta };
    });
    setError('');
  };

  const confirmBuy = () => {
    if (purchaseCard(card.id, source, payment)) onClose();
    else setError(useDemoGemStore.getState().notice);
  };
  const confirmReserve = () => {
    if (reserveMarketCard(card.id)) onClose();
    else setError(useDemoGemStore.getState().notice);
  };

  return (
    <div className="card-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="card-modal" role="dialog" aria-modal="true" aria-labelledby="card-modal-title" aria-describedby="card-modal-description">
        <div className="card-modal__head"><span className="eyebrow">LEVEL {card.level} · {source === 'market' ? 'MARKET' : 'MY RESERVATION'}</span><button ref={closeRef} type="button" className="card-modal__close" onClick={onClose} aria-label="카드 창 닫기">×</button></div>
        <h2 id="card-modal-title">{gemNames[card.bonusColor]} 개발 카드</h2>
        <p id="card-modal-description">구매하면 {card.points}점과 {gemNames[card.bonusColor]} 영구 할인 1개를 얻습니다.</p>
        <div className="card-modal__stats"><span>승점 <strong>+{card.points}</strong></span><span>영구 할인 <strong><GemIcon color={card.bonusColor} small /> +1</strong></span></div>
        <div className="card-modal__section-title"><strong>결제 보석</strong><span>카드 비용 − 영구 할인</span></div>
        <div className="card-modal__costs">
          {CARD_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
            <div className="card-modal__cost-row" key={color}>
              <GemIcon color={color} small /><span>{gemNames[color]}</span><small>{card.cost[color]} − {bonuses[color]} = {remaining[color]}</small>
              <button type="button" onClick={() => changePayment(color, -1)} disabled={payment[color] === 0} aria-label={`${gemNames[color]} 결제 줄이기`}>−</button>
              <strong>{payment[color]}</strong>
              <button type="button" onClick={() => changePayment(color, 1)} disabled={payment[color] >= Math.min(remaining[color], gems[color])} aria-label={`${gemNames[color]} 결제 늘리기`}>+</button>
            </div>
          ))}
        </div>
        <div className="card-modal__gold"><GemIcon color="gold" small /><span>황금 대체</span><strong>{payment.gold} / {gems.gold}개 보유</strong></div>
        <p className="card-modal__hint">색 보석을 줄이면 부족분만큼 황금으로 대체합니다. 보유량보다 많은 황금은 사용할 수 없습니다.</p>
        {error && <p className="card-modal__error" role="alert">{error}</p>}
        {phase !== 'selecting' && <p className="card-modal__error">한 턴에 한 가지 행동만 할 수 있습니다. ‘처음부터’를 눌러 다시 연습하세요.</p>}
        <div className="card-modal__actions">
          <button type="button" className="card-modal__buy" onClick={confirmBuy} disabled={!canBuy}>카드 구매</button>
          {source === 'market' && <button type="button" className="card-modal__reserve" onClick={confirmReserve} disabled={!canReserve}>예약{bank.gold > 0 ? ' · 황금 +1' : ''}</button>}
        </div>
        {source === 'market' && <p className="card-modal__footnote">예약 {reservedCardIds.length} / 3장 · 예약하면 이 카드가 내 예약 목록으로 이동합니다.</p>}
      </section>
    </div>
  );
}

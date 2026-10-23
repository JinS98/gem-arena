import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CARD_COLORS, canPayForCard, countCardBonuses, remainingCardCost } from '@gem-arena/engine';
import type { DevelopmentCard, GameAction, GemColor, ServerGameState } from '@gem-arena/engine';
import { useState } from 'react';
import { demoPayment } from '../data/tabletopDemo';
import { CardFace } from './MarketCard';
import { GemIcon } from './GemIcon';
import { useGemNames } from './GameTheme';

export function TabletopDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return <div className="tabletop-dialog-backdrop" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="tabletop-dialog" role="dialog" aria-modal="true" aria-labelledby={id} ref={dialogRef}>
      <div className="tabletop-dialog__heading"><div><span className="eyebrow">GEM ARENA · TABLETOP</span><h2 id={id}>{title}</h2></div><button type="button" onClick={onClose} aria-label="창 닫기">×</button></div>
      {children}
    </section>
  </div>;
}

export function TabletopCardDialog({ card, game, source, canAct, onAction, onClose }: {
  card: DevelopmentCard; game: ServerGameState; source: 'market' | 'reserved'; canAct: boolean;
  onAction: (action: GameAction) => boolean; onClose: () => void;
}) {
  const names = useGemNames();
  const player = game.players['demo-me'];
  const bonuses = countCardBonuses(player.purchasedCardIds);
  const remaining = remainingCardCost(card.cost, bonuses);
  const [payment, setPayment] = useState(() => demoPayment(card, game, 'demo-me'));
  const canBuy = canAct && canPayForCard(card.cost, bonuses, player.gems, payment);
  const changePayment = (color: GemColor, delta: number) => setPayment(current => ({
    ...current, [color]: current[color] + delta, gold: current.gold - delta,
  }));
  return <TabletopDialog title={`${names[card.bonusColor]} 개발 카드`} onClose={onClose}>
    <div className="tabletop-card-detail">
      <div className="tabletop-card-detail__face" data-tabletop-card={card.id}><CardFace card={card} /></div>
      <div className="tabletop-card-detail__info"><span className="tabletop-card-detail__level">LEVEL {card.level} · {source === 'market' ? '공개 시장' : '내 예약 카드'}</span>
        <h3>{card.points}점 <span>· 영구 할인 +1</span></h3>
        <div className="tabletop-payment">{CARD_COLORS.filter(color => card.cost[color] > 0).map(color => <div key={color}>
          <span><GemIcon color={color} />{names[color]}</span><small>{card.cost[color]} − 할인 {bonuses[color]}<br />실제 비용 {remaining[color]} · 보유 {player.gems[color]}</small>
          <div><button type="button" aria-label={`${names[color]} 사용량 줄이기`} disabled={!canAct || payment[color] <= 0} onClick={() => changePayment(color, -1)}>−</button><strong>{payment[color]}</strong>
            <button type="button" aria-label={`${names[color]} 사용량 늘리기`} disabled={!canAct || payment.gold <= 0 || payment[color] >= Math.min(remaining[color], player.gems[color])} onClick={() => changePayment(color, 1)}>+</button></div>
        </div>)}</div>
        <p className="tabletop-payment__gold"><GemIcon color="gold" /> 황금 대체 {payment.gold}개 <small>보유 {player.gems.gold}개</small></p>
        <div className="tabletop-dialog__actions"><button type="button" className="tabletop-primary" disabled={!canBuy} onClick={() => { if (onAction({ type: 'BUY_CARD', cardId: card.id, source, payment })) onClose(); }}>이 보석으로 구매</button>
          {source === 'market' && <button type="button" disabled={!canAct || player.reservedCardIds.length >= 3} onClick={() => { if (onAction({ type: 'RESERVE_CARD', cardId: card.id })) onClose(); }}>카드 예약{game.bank.gold > 0 ? ' · 황금 +1' : ''}</button>}</div>
        {!canAct && <p className="tabletop-dialog__hint">내 차례에 구매하거나 예약할 수 있습니다.</p>}
        {canAct && !canBuy && <p className="tabletop-dialog__hint">구매할 보석이 부족합니다. 예약하거나 보석을 더 모아보세요.</p>}
      </div>
    </div>
  </TabletopDialog>;
}

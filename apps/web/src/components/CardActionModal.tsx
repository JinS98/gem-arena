import { useEffect, useRef, useState } from 'react';
import { CARD_COLORS, canPayForCard, countCardBonuses, remainingCardCost } from '@gem-arena/engine';
import type { DevelopmentCard, GemColor, Inventory } from '@gem-arena/engine';
import { captureRewardSource } from '../animations/boardReward';
import type { RewardSource } from '../animations/boardReward';
import { useLocalGameStore } from '../stores/localGameStore';
import { GemIcon } from './GemIcon';
import { useGemNames } from './GameTheme';
import { CardFace } from './MarketCard';

const emptyPayment = (): Inventory => ({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

function suggestedPayment(card: DevelopmentCard, purchased: string[], held: Inventory): Inventory {
  const remaining = remainingCardCost(card.cost, countCardBonuses(purchased));
  const payment = emptyPayment();
  for (const color of CARD_COLORS) payment[color] = Math.min(remaining[color], held[color]);
  payment.gold = CARD_COLORS.reduce((sum, color) => sum + remaining[color] - payment[color], 0);
  return payment;
}

export function CardActionModal({ card, source, onClose, onReserve, onPurchaseStart, onPurchaseArrive }: {
  card: DevelopmentCard; source: 'market' | 'reserved'; onClose: () => void;
  onReserve: (cardId: string) => boolean;
  onPurchaseStart: (playerId: string, color: GemColor, previousCount: number,
    nobleReward?: { source: RewardSource | null; previousScore: number }) => void;
  onPurchaseArrive: () => void;
}) {
  const gemNames = useGemNames();
  const { gems, bank, purchasedCardIds, reservedCardIds, phase, purchaseCard } = useLocalGameStore();
  const bonuses = countCardBonuses(purchasedCardIds);
  const remaining = remainingCardCost(card.cost, bonuses);
  const [payment, setPayment] = useState(() => suggestedPayment(card, purchasedCardIds, gems));
  const [error, setError] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isPurchasingRef = useRef(false);
  const mountedRef = useRef(true);
  const flightGemRef = useRef<HTMLElement | null>(null);
  const animationsRef = useRef<Animation[]>([]);
  const onPurchaseArriveRef = useRef(onPurchaseArrive);
  onPurchaseArriveRef.current = onPurchaseArrive;
  const canAfford = canPayForCard(card.cost, bonuses, gems, payment);
  const canBuy = phase === 'selecting' && canAfford;
  const canReserve = source === 'market' && phase === 'selecting' && reservedCardIds.length < 3;
  const originalCost = CARD_COLORS.reduce((sum, color) => sum + card.cost[color], 0);
  const payableCost = CARD_COLORS.reduce((sum, color) => sum + remaining[color], 0);
  const goldShortage = Math.max(0, payment.gold - gems.gold);
  const spentGems = [...CARD_COLORS, 'gold'] as const;

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPurchasingRef.current) onClose();
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
      mountedRef.current = false;
      animationsRef.current.forEach((animation) => animation.cancel());
      flightGemRef.current?.remove();
      if (isPurchasingRef.current) onPurchaseArriveRef.current();
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

  const confirmBuy = async () => {
    if (!canBuy || isPurchasingRef.current) return;
    const before = useLocalGameStore.getState();
    const playerId = before.currentPlayerId;
    const previousNobles = before.game.players[playerId].nobleIds;
    const nobleSources = new Map([...document.querySelectorAll<HTMLElement>('[data-noble-id]')]
      .map((element) => [element.dataset.nobleId, captureRewardSource(element)]));
    const dialog = dialogRef.current;
    const modalRect = dialog?.getBoundingClientRect();
    const badge = dialog?.querySelector<HTMLElement>('.card-modal__preview .card-face__bonus');
    const badgeRect = badge?.getBoundingClientRect();
    const sourceRect = badgeRect && badgeRect.width > 0 ? badgeRect
      : modalRect ? new DOMRect(modalRect.right - 75, modalRect.top + 72, 39, 39) : null;
    const target = [...document.querySelectorAll<HTMLElement>('[data-player-id] [data-bonus-color]')]
      .find((element) => element.dataset.bonusColor === card.bonusColor &&
        element.closest<HTMLElement>('[data-player-id]')?.dataset.playerId === playerId);

    if (!purchaseCard(card.id, source, payment)) {
      setError(useLocalGameStore.getState().notice);
      return;
    }
    const claimedNobleId = useLocalGameStore.getState().game.players[playerId].nobleIds
      .find((id) => !previousNobles.includes(id));
    onPurchaseStart(playerId, card.bonusColor, bonuses[card.bonusColor], claimedNobleId ? {
      source: nobleSources.get(claimedNobleId) ?? null,
      previousScore: before.game.players[playerId].score + card.points,
    } : undefined);
    isPurchasingRef.current = true;
    setIsPurchasing(true);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!dialog || !modalRect || !sourceRect || !target || reducedMotion || !dialog.animate) {
      isPurchasingRef.current = false;
      onPurchaseArrive();
      onClose();
      return;
    }

    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const gem = (badge?.cloneNode(true) ?? document.createElement('span')) as HTMLElement;
    gem.className = `purchase-flight-gem gem-box gem-box--${card.bonusColor}`;
    gem.setAttribute('aria-hidden', 'true');
    gem.style.left = `${sourceX - 21}px`;
    gem.style.top = `${sourceY - 21}px`;
    document.body.append(gem);
    flightGemRef.current = gem;

    try {
      const collapse = dialog.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${(sourceX - modalRect.left - modalRect.width / 2) * .55}px, ${(sourceY - modalRect.top - modalRect.height / 2) * .55}px) scale(.58)`, opacity: 1, filter: 'blur(0)', offset: .55 },
        { transform: `translate(${sourceX - modalRect.left - modalRect.width / 2}px, ${sourceY - modalRect.top - modalRect.height / 2}px) scale(.025)`, opacity: 0, filter: 'blur(5px)' },
      ], { duration: 620, easing: 'cubic-bezier(.36, 0, .85, .24)', fill: 'forwards' });
      const backdropFade = backdropRef.current?.animate([
        { opacity: 1, offset: 0 }, { opacity: 1, offset: .58 }, { opacity: 0, offset: 1 },
      ], { duration: 720, fill: 'forwards' });
      const gemReveal = gem.animate([
        { opacity: 0, transform: 'scale(.6)' },
        { opacity: 1, transform: 'scale(1.5)', offset: .55 },
        { opacity: 1, transform: 'scale(1.1)' },
      ], { duration: 320, delay: 300, fill: 'forwards' });
      animationsRef.current = [collapse, gemReveal, ...(backdropFade ? [backdropFade] : [])];
      await Promise.all([collapse.finished, gemReveal.finished]);
      if (!mountedRef.current) return;

      const targetRect = target.getBoundingClientRect();
      const dx = targetRect.left + targetRect.width / 2 - sourceX;
      const dy = targetRect.top + targetRect.height / 2 - sourceY;
      const flight = gem.animate([
        { opacity: 1, transform: 'translate(0, 0) scale(1.1) rotate(0deg)' },
        { opacity: 1, transform: `translate(${dx * .48}px, ${dy * .35 - 60}px) scale(1.15) rotate(35deg)`, offset: .48 },
        { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(.6) rotate(70deg)`, offset: .88 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(90deg)` },
      ], { duration: 650, easing: 'cubic-bezier(.25, .7, .25, 1)', fill: 'forwards' });
      animationsRef.current.push(flight);
      await flight.finished;
    } catch {
      // An interrupted animation still applies the completed purchase.
    } finally {
      gem.remove();
      flightGemRef.current = null;
      if (mountedRef.current) {
        isPurchasingRef.current = false;
        onPurchaseArrive();
        onClose();
      }
    }
  };
  const confirmReserve = () => {
    if (isPurchasingRef.current) return;
    if (onReserve(card.id)) onClose();
    else setError(useLocalGameStore.getState().notice);
  };

  return (
    <div ref={backdropRef} className="card-modal-backdrop" onMouseDown={(event) => { if (!isPurchasingRef.current && event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`card-modal${isPurchasing ? ' card-modal--purchasing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="card-modal-title" aria-describedby="card-modal-description">
        <div className="card-modal__head"><span className="eyebrow">LEVEL {card.level} · {source === 'market' ? 'MARKET' : 'MY RESERVATION'}</span><button ref={closeRef} type="button" className="card-modal__close" onClick={onClose} disabled={isPurchasing} aria-label="카드 창 닫기">×</button></div>
        <h2 id="card-modal-title">{gemNames[card.bonusColor]} 개발 카드</h2>
        <p id="card-modal-description">구매하면 {card.points}점과 {gemNames[card.bonusColor]} 영구 할인 1개를 얻습니다.</p>
        <div className="card-modal__body">
          <div className="card-modal__preview" aria-hidden="true"><CardFace card={card} /></div>
          <div className="card-modal__checkout">
            <div className={`card-modal__purchase-status${canBuy ? ' card-modal__purchase-status--ready' : ''}`} role="status" aria-live="polite">
              <strong>{phase !== 'selecting' ? '이번 턴은 종료됨' : canAfford ? '구매 가능' : '보석 부족 · 구매 불가'}</strong>
              <span>{phase !== 'selecting' ? '이번 턴의 행동이 이미 끝났습니다.' : canAfford
                ? '표시된 사용량으로 지금 구매할 수 있습니다.'
                : `선택한 결제에는 ${gemNames.gold} ${goldShortage}개가 부족합니다. 다른 자원을 모으면 특별 자원 사용량이 줄어듭니다.`}</span>
            </div>
            <div className="card-modal__section-title"><strong>구매 비용</strong><span>카드 {originalCost}개 − 영구 할인 {originalCost - payableCost}개 = 필요 {payableCost}개</span></div>
            <div className="card-modal__cost-head"><span>보석 · 카드 비용 − 할인</span><span>필요</span><span>보유</span><span>사용</span></div>
            <div className="card-modal__costs">
              {CARD_COLORS.filter((color) => card.cost[color] > 0).map((color) => (
                <div className="card-modal__cost-row" key={color}>
                  <div className="card-modal__gem"><span className={`gem-box gem-box--${color}`}><GemIcon color={color} small />{gemNames[color]}</span><small>카드 {card.cost[color]} − 할인 {card.cost[color] - remaining[color]}</small></div>
                  <strong className="card-modal__needed">{remaining[color]}</strong>
                  <span className={`card-modal__owned${gems[color] < remaining[color] ? ' card-modal__owned--short' : ''}`}>{gems[color]}</span>
                  <div className="card-modal__stepper">
                    <button type="button" onClick={() => changePayment(color, -1)} disabled={payment[color] === 0} aria-label={`${gemNames[color]} 사용 수량 줄이기`}>−</button>
                    <strong>{payment[color]}</strong>
                    <button type="button" onClick={() => changePayment(color, 1)} disabled={payment[color] >= Math.min(remaining[color], gems[color])} aria-label={`${gemNames[color]} 사용 수량 늘리기`}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className={`card-modal__gold gem-box gem-box--gold${goldShortage > 0 ? ' card-modal__gold--short' : ''}`}><GemIcon color="gold" small /><span>특별 자원 · {gemNames.gold}</span><span>보유 {gems.gold}개</span><strong>사용 {payment.gold}개</strong></div>
            <p className="card-modal__hint">기본 자원의 사용 수량을 줄인 만큼 특별 자원을 사용합니다.</p>
            <div className="card-modal__payment-summary">
              <strong>{canAfford ? '이번 구매에 사용' : '구매에 필요한 결제'}</strong>
              <div>{spentGems.filter((color) => payment[color] > 0).map((color) =>
                <span className={`gem-box gem-box--${color}`} key={color}><GemIcon color={color} small />{gemNames[color]} {payment[color]}개</span>)}
                {payableCost === 0 && <span>보석 사용 없음</span>}</div>
            </div>
            {error && <p className="card-modal__error" role="alert">{error}</p>}
            <div className="card-modal__actions">
              <button type="button" className="card-modal__buy" onClick={confirmBuy} disabled={!canBuy || isPurchasing}>{canBuy ? '이 보석으로 구매' : phase === 'selecting' ? '보석 부족' : '이번 턴 구매 불가'}</button>
              {source === 'market' && <button type="button" className="card-modal__reserve" onClick={confirmReserve} disabled={!canReserve || isPurchasing}>예약{bank.gold > 0 ? ` · ${gemNames.gold} +1` : ''}</button>}
            </div>
            {source === 'market' && <p className="card-modal__footnote">예약 {reservedCardIds.length} / 3장 · 예약하면 이 카드가 내 예약 목록으로 이동합니다.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

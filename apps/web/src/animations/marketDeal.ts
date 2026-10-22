export async function flyMarketDeal(deck: HTMLElement | null, slot: HTMLElement | null, signal: AbortSignal): Promise<void> {
  if (!deck || !slot || signal.aborted || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const from = deck.getBoundingClientRect();
  const to = slot.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return;

  const flying = deck.cloneNode(true) as HTMLElement;
  const deckStyle = getComputedStyle(deck);
  for (const name of ['--deck-top', '--deck-bottom', '--deck-accent']) {
    flying.style.setProperty(name, deckStyle.getPropertyValue(name));
  }
  flying.classList.add('market-deal-flight');
  flying.removeAttribute('disabled');
  flying.setAttribute('aria-hidden', 'true');
  flying.setAttribute('tabindex', '-1');
  flying.style.left = `${from.left}px`;
  flying.style.top = `${from.top}px`;
  flying.style.width = `${from.width}px`;
  flying.style.height = `${from.height}px`;
  document.body.append(flying);

  const offsetX = to.left - from.left + (to.width - from.width) / 2;
  const offsetY = to.top - from.top + (to.height - from.height) / 2;
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const animation = flying.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
    { transform: 'translate(0, -14px) scale(1.04)', opacity: 1, offset: .18 },
    { transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY}) rotateY(0deg)`, opacity: 1, offset: .83 },
    { transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY}) rotateY(90deg)`, opacity: 1, offset: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'forwards' });
  const abort = () => animation.cancel();
  signal.addEventListener('abort', abort, { once: true });
  try { await animation.finished; }
  catch { /* Unmounting cancels the flight. */ }
  finally {
    signal.removeEventListener('abort', abort);
    flying.remove();
  }
}

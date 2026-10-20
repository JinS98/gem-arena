export interface RewardSource {
  rect: DOMRect;
  node: HTMLElement;
  focusRect: DOMRect | null;
}

export function captureRewardSource(element: HTMLElement | null): RewardSource | null {
  if (!element) return null;
  return { rect: element.getBoundingClientRect(), node: element.cloneNode(true) as HTMLElement,
    focusRect: element.querySelector<HTMLElement>('.noble-card__portrait')?.getBoundingClientRect() ?? null };
}

async function playRewardAnimation(
  visual: HTMLElement, frames: Keyframe[], duration: number, signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || !visual.animate) return;
  const animation = visual.animate(frames, {
    duration, easing: 'cubic-bezier(.22, .7, .25, 1)', fill: 'forwards',
  });
  const abort = () => animation.cancel();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  try {
    await animation.finished;
  } catch {
    // A route change can cancel an in-flight visual without reverting the action.
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export async function flyBoardReward(
  source: RewardSource | null, target: HTMLElement | null, kind: 'gem' | 'noble', signal: AbortSignal,
): Promise<void> {
  if (!source || !target || signal.aborted || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const visual = source.node;
  visual.classList.add('board-reward', `board-reward--${kind}`);
  visual.setAttribute('aria-hidden', 'true');
  visual.style.left = `${source.rect.left}px`;
  visual.style.top = `${source.rect.top}px`;
  visual.style.width = `${source.rect.width}px`;
  visual.style.height = `${source.rect.height}px`;
  document.body.append(visual);
  let portrait: HTMLElement | null = null;
  try {
    if (kind === 'noble') {
      const focus = source.focusRect ?? new DOMRect(source.rect.left + 8, source.rect.top + 8, 40, 50);
      const centerX = focus.left + focus.width / 2;
      const centerY = focus.top + focus.height / 2;
      await playRewardAnimation(visual, [
        { opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { opacity: 0, transform: `translate(${centerX - source.rect.left - source.rect.width / 2}px, ${centerY - source.rect.top - source.rect.height / 2}px) scale(.08)` },
      ], 440, signal);
      visual.remove();
      if (signal.aborted) return;
      portrait = source.node.querySelector<HTMLElement>('.noble-card__portrait')?.cloneNode(true) as HTMLElement | null;
      if (!portrait) return;
      portrait.className = 'board-reward board-reward--noble-token';
      portrait.setAttribute('aria-hidden', 'true');
      portrait.style.left = `${focus.left}px`;
      portrait.style.top = `${focus.top}px`;
      portrait.style.width = `${focus.width}px`;
      portrait.style.height = `${focus.height}px`;
      document.body.append(portrait);
      await playRewardAnimation(portrait, [
        { opacity: 0, transform: 'scale(.55)' },
        { opacity: 1, transform: 'scale(1.4)', offset: .55 },
        { opacity: 1, transform: 'scale(1)' },
      ], 260, signal);
      if (signal.aborted) return;
      const targetRect = target.getBoundingClientRect();
      const dx = targetRect.left + targetRect.width / 2 - centerX;
      const dy = targetRect.top + targetRect.height / 2 - centerY;
      await playRewardAnimation(portrait, [
        { opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { opacity: 1, transform: `translate(${dx * .5}px, ${dy * .35 - 42}px) scale(1.12) rotate(-15deg)`, offset: .48 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.2) rotate(20deg)` },
      ], 650, signal);
      return;
    }
    const targetRect = target.getBoundingClientRect();
    const dx = targetRect.left + targetRect.width / 2 - source.rect.left - source.rect.width / 2;
    const dy = targetRect.top + targetRect.height / 2 - source.rect.top - source.rect.height / 2;
    await playRewardAnimation(visual, [
      { opacity: 1, transform: 'translate(0, 0) scale(1)' },
      { opacity: 1, transform: `translate(${dx * .5}px, ${dy * .35 - 42}px) scale(1.25)`, offset: .5 },
      { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.3)` },
    ], 670, signal);
  } finally {
    visual.remove();
    portrait?.remove();
  }
}

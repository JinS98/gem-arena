import { useEffect, useRef } from 'react';
import { ThemePicker } from './ThemePicker';
import type { GameTheme } from './GameTheme';

export function GameStartModal({ playerCount, firstPlayerName, theme, onPlayerCountChange, onThemeChange, onBack, onStart }: {
  playerCount: 2 | 3 | 4;
  firstPlayerName: string;
  theme: GameTheme;
  onPlayerCountChange: (count: 2 | 3 | 4) => void;
  onThemeChange: (theme: GameTheme) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
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
    document.addEventListener('keydown', keepFocus);
    return () => {
      document.removeEventListener('keydown', keepFocus);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onBack]);

  return (
    <div className="game-start-backdrop">
      <section ref={dialogRef} className="game-start-modal" role="dialog" aria-modal="true" aria-labelledby="game-start-title" aria-describedby="game-start-description">
        <span className="eyebrow">LOCAL MATCH · {playerCount} PLAYERS</span>
        <div className="game-start-modal__emblem" aria-hidden="true"><span>✦</span></div>
        <h2 id="game-start-title">한 PC 대전</h2>
        <p id="game-start-description">함께 플레이할 인원과 테마를 고르세요.<br />게임 시작을 누르면 {firstPlayerName}의 3분이 시작됩니다.</p>
        <fieldset className="game-start-modal__players">
          <legend>플레이 인원</legend>
          <div className="game-start-modal__player-options">
            {([2, 3, 4] as const).map(count => <button key={count} type="button" aria-pressed={playerCount === count}
              className={playerCount === count ? 'is-selected' : ''}
              onClick={() => { if (count !== playerCount) onPlayerCountChange(count); }}>{count}명</button>)}
          </div>
        </fieldset>
        <ThemePicker theme={theme} onChange={onThemeChange} />
        <div className="game-start-modal__detail"><span>첫 번째 차례</span><strong>{firstPlayerName}</strong><span>턴 제한</span><strong>03:00</strong></div>
        <div className="game-start-modal__actions">
          <button type="button" onClick={onBack}>뒤로가기</button>
          <button type="button" onClick={onStart}>게임 시작 <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 8h10m-4-4 4 4-4 4" /></svg></button>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useRef } from 'react';

export function GameStartModal({ playerCount, firstPlayerName, onStart }: {
  playerCount: number; firstPlayerName: string; onStart: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    startRef.current?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') {
        event.preventDefault();
        startRef.current?.focus();
      }
    };
    document.addEventListener('keydown', keepFocus);
    return () => {
      document.removeEventListener('keydown', keepFocus);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <div className="game-start-backdrop">
      <section className="game-start-modal" role="dialog" aria-modal="true" aria-labelledby="game-start-title" aria-describedby="game-start-description">
        <span className="eyebrow">LOCAL MATCH · {playerCount} PLAYERS</span>
        <div className="game-start-modal__emblem" aria-hidden="true"><span>✦</span></div>
        <h2 id="game-start-title">게임 준비 완료</h2>
        <p id="game-start-description">모두 준비되었다면 게임을 시작하세요.<br />버튼을 누르면 {firstPlayerName}의 3분이 시작됩니다.</p>
        <div className="game-start-modal__detail"><span>첫 번째 차례</span><strong>{firstPlayerName}</strong><span>턴 제한</span><strong>03:00</strong></div>
        <button ref={startRef} type="button" onClick={onStart}>게임 시작하기 <span aria-hidden="true">→</span></button>
      </section>
    </div>
  );
}

import { useEffect, useRef } from 'react';

export type ForfeitDestination = 'spectate' | 'lobby';

export function ForfeitChoiceDialog({ finalOpponent, busy, error, onClose, onConfirm }: {
  finalOpponent: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (destination: ForfeitDestination) => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab') return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  return <div className="multiplayer-card-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section ref={dialogRef} className="multiplayer-forfeit-dialog" role="dialog" aria-modal="true" aria-labelledby="forfeit-title" aria-describedby="forfeit-description">
      <span className="eyebrow">LEAVE THE TABLE</span>
      <h2 id="forfeit-title">게임을 기권하시겠습니까?</h2>
      <p id="forfeit-description">기권하면 이번 게임에 다시 참가할 수 없고, 내 카드와 보석은 승리 판정에서 제외됩니다.</p>
      {finalOpponent && <p className="multiplayer-forfeit-dialog__notice">남은 참가자가 두 명입니다. 기권하면 게임이 종료되고 로비로 이동합니다.</p>}
      {error && <p className="multiplayer-forfeit-dialog__error" role="alert">{error}</p>}
      <div className="multiplayer-forfeit-dialog__actions">
        <button ref={cancelRef} type="button" className="multiplayer-forfeit-dialog__cancel" disabled={busy} onClick={onClose}>계속 플레이</button>
        <button type="button" className="multiplayer-forfeit-dialog__spectate" disabled={busy || finalOpponent} onClick={() => onConfirm('spectate')}>기권하고 관전</button>
        <button type="button" className="multiplayer-forfeit-dialog__leave" disabled={busy} onClick={() => onConfirm('lobby')}>{busy ? '기권 처리 중…' : '기권하고 로비로 나가기'}</button>
      </div>
    </section>
  </div>;
}

export function MultiplayerVictoryDialog({ winnerNames, byForfeit, onLobby }: {
  winnerNames: string[];
  byForfeit: boolean;
  onLobby: () => void;
}) {
  const lobbyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { lobbyRef.current?.focus(); }, []);
  return <div className="result-backdrop result-backdrop--multiplayer">
    <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="multi-result-title" aria-describedby="multi-result-reason">
      <span className="eyebrow">GAME FINISHED</span>
      <div className="result-modal__emblem" aria-hidden="true">✧</div>
      <h2 id="multi-result-title">{winnerNames.length > 1 ? '공동 승리!' : '승리!'}</h2>
      <p className="result-modal__winner">{winnerNames.join(' · ')}</p>
      <p id="multi-result-reason" className="result-modal__rule">{byForfeit ? '상대의 기권으로 게임이 종료되었습니다.' : '게임의 최종 결과가 확정되었습니다.'}</p>
      <button ref={lobbyRef} type="button" onClick={onLobby}>로비로 나가기</button>
    </section>
  </div>;
}

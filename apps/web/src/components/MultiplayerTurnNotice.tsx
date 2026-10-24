import { useEffect, useRef, useState } from 'react';
import './multiplayerTurnNotice.scss';

/** Non-blocking, once-per-turn announcement for the local player. */
export function MultiplayerTurnNotice({ roomId, turnId, isMyTurn, ready }: {
  roomId: string; turnId: string; isMyTurn: boolean; ready: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const announced = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
    if (!isMyTurn) {
      announced.current = null;
      clear();
      setVisible(false);
      return;
    }
    const key = `${roomId}:${turnId}`;
    const reveal = () => {
      if (!ready || document.hidden || announced.current === key) return;
      announced.current = key;
      clear();
      setVisible(true);
      timer.current = setTimeout(() => { setVisible(false); timer.current = null; }, 2000);
    };
    reveal();
    document.addEventListener('visibilitychange', reveal);
    return () => document.removeEventListener('visibilitychange', reveal);
  }, [roomId, turnId, isMyTurn, ready]);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
    announced.current = null;
  }, []);

  if (!visible || !isMyTurn || !ready) return null;
  return <div key={`${roomId}:${turnId}`} className="multiplayer-turn-notice" role="status" aria-live="polite" aria-atomic="true">
    <div className="multiplayer-turn-notice__edges" aria-hidden="true" />
    <div className="multiplayer-turn-notice__banner">
      <span className="multiplayer-turn-notice__gem" aria-hidden="true">◆</span>
      <div><small>YOUR TURN</small><strong>내 차례입니다</strong><span>보석을 받거나 카드를 구매·예약하세요</span></div>
      <span className="multiplayer-turn-notice__gem" aria-hidden="true">◆</span>
    </div>
  </div>;
}

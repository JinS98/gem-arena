import { useEffect, useRef, useState } from 'react';
import { expireGameTurn } from '../services/gameActions';

export function useMultiplayerTurnCountdown(roomId: string | undefined, deadline: number | null | undefined) {
  const [now, setNow] = useState(Date.now);
  const requestedDeadline = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline]);

  const remainingMs = typeof deadline === 'number' ? Math.max(0, deadline - now) : null;
  useEffect(() => {
    if (!roomId || typeof deadline !== 'number' || remainingMs !== 0 ||
      requestedDeadline.current === deadline) return;
    requestedDeadline.current = deadline;
    void expireGameTurn(roomId).catch(() => {
      // The scheduled server sweep advances turns if this browser is offline.
    });
  }, [roomId, deadline, remainingMs]);

  const seconds = Math.ceil((remainingMs ?? 0) / 1000);
  return {
    time: remainingMs === null ? '--:--' :
      `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    isWarning: remainingMs !== null && remainingMs <= 30_000,
    isExpired: remainingMs === 0,
  };
}

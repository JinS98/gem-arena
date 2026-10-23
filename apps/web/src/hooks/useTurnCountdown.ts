import { useEffect, useState } from 'react';
import { useLocalGameStore } from '../stores/localGameStore';

const WARNING_MS = 30 * 1000;
let alarmContext: AudioContext | null = null;

function unlockAlarm() {
  try {
    alarmContext ??= new AudioContext();
    void alarmContext.resume().catch(() => {});
  } catch {
    // The visual warning remains available when audio is unsupported.
  }
}

function playWarning() {
  try {
    unlockAlarm();
    if (!alarmContext || alarmContext.state !== 'running') return;
    const oscillator = alarmContext.createOscillator();
    const volume = alarmContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    volume.gain.setValueAtTime(0.0001, alarmContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.15, alarmContext.currentTime + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, alarmContext.currentTime + 0.3);
    oscillator.connect(volume).connect(alarmContext.destination);
    oscillator.start();
    oscillator.stop(alarmContext.currentTime + 0.31);
  } catch {
    // A muted browser still shows the warning on the board.
  }
}

export function useTurnCountdown() {
  const deadline = useLocalGameStore((state) => state.turnDeadlineAt);
  const warningPlayed = useLocalGameStore((state) => state.turnWarningPlayed);
  const markWarning = useLocalGameStore((state) => state.markTurnWarning);
  const expireTurn = useLocalGameStore((state) => state.expireTurn);
  const [remainingMs, setRemainingMs] = useState(() => deadline === null ? 0 : Math.max(0, deadline - Date.now()));

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAlarm);
    window.addEventListener('keydown', unlockAlarm);
    return () => {
      window.removeEventListener('pointerdown', unlockAlarm);
      window.removeEventListener('keydown', unlockAlarm);
    };
  }, []);

  useEffect(() => {
    if (deadline === null) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) expireTurn();
      else if (remaining <= WARNING_MS && markWarning()) playWarning();
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [deadline, expireTurn, markWarning]);

  const seconds = Math.ceil(remainingMs / 1000);
  return {
    time: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`,
    isWarning: deadline !== null && (warningPlayed || remainingMs <= WARNING_MS),
    isWaiting: deadline === null,
  };
}

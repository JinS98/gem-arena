import { useEffect, useRef } from 'react';
import './multiplayerTurnNotice.scss';
import './centerNotice.scss';

/** A non-modal central notice; the underlying form remains editable. */
export function CenterNotice({ message, title, noticeId, onClose }: {
  message: string; title: string; noticeId: number; onClose: (restoreFocus: boolean) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const clear = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
  const schedule = () => { clear(); timer.current = setTimeout(() => close.current(false), 6000); };
  useEffect(() => {
    schedule();
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(true); };
    document.addEventListener('keydown', keydown);
    return () => { clear(); document.removeEventListener('keydown', keydown); };
  }, [noticeId]);
  return <div key={noticeId} className="multiplayer-turn-notice center-notice" role="alert" aria-atomic="true">
    <div className="multiplayer-turn-notice__edges" aria-hidden="true" />
    <div className="multiplayer-turn-notice__banner center-notice__banner" onMouseEnter={clear}
      onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) schedule(); }}
      onFocusCapture={clear} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) schedule(); }}>
      <span className="center-notice__icon" aria-hidden="true">!</span>
      <div><small>PLEASE CHECK</small><strong>{title}</strong><span id="lobby-room-notice-message">{message}</span>
        <button type="button" onClick={() => onClose(true)}>확인</button></div>
      <button className="center-notice__close" type="button" aria-label="안내 닫기" onClick={() => onClose(true)}>×</button>
    </div>
  </div>;
}

import { useEffect, useRef, useState } from 'react';
import '../infinite.scss';

export function HiddenThemePassword({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal(); input.current?.focus();
    return () => { dialog.current?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="infinite-unlock" aria-labelledby="hidden-unlock-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (password === '0530') onUnlock(); else { setError(password ? '비밀번호가 맞지 않습니다.' : '비밀번호를 입력해 주세요.'); input.current?.focus(); } }}>
      <button type="button" className="infinite-unlock__close" aria-label="닫기" onClick={onClose}>×</button>
      <span className="eyebrow">HIDDEN THEME</span><h2 id="hidden-unlock-title">히든테마 잠금 해제</h2><p>비밀번호를 확인하면 테마를 선택할 수 있습니다.</p>
      <label htmlFor="hidden-theme-password">비밀번호</label><input ref={input} id="hidden-theme-password" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={password} aria-invalid={Boolean(error)} aria-describedby={error ? 'hidden-theme-error' : undefined} onChange={event => { setPassword(event.target.value); setError(''); }} />
      {error && <p id="hidden-theme-error" className="infinite-unlock__error" role="alert">{error}</p>}
      <button type="submit" className="infinite-unlock__submit">잠금 해제하고 선택</button>
    </form>
  </dialog>;
}

export function HiddenGameIntro({ onComplete }: { onComplete?: () => void }) {
  const [done, setDone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const callback = useRef(onComplete); callback.current = onComplete;
  const finished = useRef(false);
  function finish() { if (finished.current) return; finished.current = true; setDone(true); callback.current?.(); }
  useEffect(() => {
    dialog.current?.showModal();
    const timer = window.setTimeout(finish, 3500);
    return () => { window.clearTimeout(timer); dialog.current?.close(); };
  }, []);
  if (done) return null;
  return <dialog ref={dialog} className="hidden-game-intro" aria-labelledby="hidden-intro-title" onCancel={event => { event.preventDefault(); finish(); }}>
    <section className="infinite-preview"><div className="infinite-entry">
      <span className="eyebrow">GEM ARENA · PRIVATE EDITION</span><div className="infinite-entry__symbol" aria-hidden="true">∞</div>
      <p className="infinite-entry__overline">SIX VOICES. ONE INFINITE STORY.</p><h1 id="hidden-intro-title">INFINITE<span>THE COLLECTION</span></h1>
      <p>우리만 아는, 무한한 순간을 모으는 테이블.</p><div className="infinite-entry__line" /><p className="infinite-entry__members">성규 · 동우 · 우현 · 성열 · 엘 · 성종</p>
      <button type="button" className="infinite-secret" onClick={finish}>게임으로 들어가기 →</button><small>잠시 후 게임판으로 이동합니다.</small>
    </div></section>
  </dialog>;
}

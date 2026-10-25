import { useRef, useState, useEffect } from 'react';
import { TabletopDemoPage } from './TabletopDemoPage';
import { PreviewAppearanceProvider } from '../components/PreviewAppearance';
import { infiniteAppearance, infiniteAlbums, infiniteSources } from '../data/infiniteTheme';
import '../infinite.scss';

export function InfiniteThemePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (prompt) { dialog.current?.showModal(); input.current?.focus(); }
    else dialog.current?.close();
  }, [prompt]);
  function close() { setPrompt(false); setPassword(''); setError(''); trigger.current?.focus(); }
  return <div className={`infinite-preview${unlocked ? ' infinite-preview--open' : ''}`}>
    {!unlocked ? <section className="infinite-entry">
      <span className="eyebrow">GEM ARENA · PRIVATE EDITION</span>
      <div className="infinite-entry__symbol" aria-hidden="true">∞</div>
      <p className="infinite-entry__overline">SIX VOICES. ONE INFINITE STORY.</p>
      <h1>INFINITE<span>THE COLLECTION</span></h1>
      <p>우리만 아는, 무한한 순간을 모으는 테이블.</p>
      <div className="infinite-entry__line" />
      <p className="infinite-entry__members">성규 · 동우 · 우현 · 성열 · 엘 · 성종</p>
      <button ref={trigger} className="infinite-secret" type="button" onClick={() => setPrompt(true)}><span aria-hidden="true">✧</span> 히든 테마 열기</button>
      <small>멀티 보드 형태의 1인 체험</small>
    </section> : <PreviewAppearanceProvider value={infiniteAppearance}>
      <div className="infinite-preview__toolbar"><span>∞ INFINITE · HIDDEN EDITION</span><button type="button" onClick={() => setUnlocked(false)}>테마 잠그기</button></div>
      <TabletopDemoPage infinite />
      <section className="infinite-albums" aria-label="앨범 토큰 안내"><div><span className="eyebrow">THE DISCOGRAPHY</span><h2>보석 대신, 우리의 앨범.</h2><p>앨범 토큰의 테두리 색은 기존 보석 색과 같습니다. 황금 앨범은 모든 색을 대신합니다.</p></div>
        <div className="infinite-albums__grid">{infiniteAlbums.map(album => <article key={album.color} className={`infinite-album infinite-album--${album.color}`}>{(album.color === 'gold' || album.color === 'red') ? <div className="infinite-album__logo" role="img" aria-label={`${album.title} 앨범 표지의 로고 부분`} style={{ backgroundImage: `url(${album.cover})` }} /> : <img src={album.cover} alt={`${album.title} 앨범 표지`} loading="lazy" />}<small>{album.color === 'gold' ? 'GOLD · 만능 토큰' : album.year}</small><strong>{album.title}</strong></article>)}</div>
        <p className="infinite-albums__note">기본 토큰에 최근 단체 발매작 ‘우리의 계절’(2026)과 ‘LIKE INFINITE’(2025)를 배치했습니다. 황금은 대표곡 ‘내꺼하자’가 수록된 Over the Top입니다.</p>
        <details><summary>사진·앨범 출처 보기</summary><p>비공식 팬 테마 미리보기입니다. 실사진과 앨범 표지의 권리는 각 권리자에게 있습니다. 사진은 해당 앨범 발매 시기의 공개 사진을 사용했습니다. ‘우리의 계절’은 발매 직전 무한대집회Ⅴ 사진입니다. Over the Top과 Destiny 표지는 인물이 나오지 않도록 로고 부분만 표시합니다.</p>{infiniteSources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a>)}</details>
      </section>
    </PreviewAppearanceProvider>}
    <dialog ref={dialog} className="infinite-unlock" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onClose={() => { if (prompt) close(); }}>
      <form onSubmit={event => { event.preventDefault(); if (password === '0530') { close(); setUnlocked(true); } else { setError(password ? '비밀번호가 맞지 않습니다.' : '비밀번호를 입력해 주세요.'); input.current?.focus(); } }}>
        <button type="button" className="infinite-unlock__close" onClick={close} aria-label="창 닫기">×</button>
        <span className="eyebrow">PRIVATE COLLECTION</span><h2>우리만의 테이블</h2><p>비밀번호를 입력하면 히든 테마가 열립니다.</p>
        <label htmlFor="infinite-password">비밀번호</label><input ref={input} id="infinite-password" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={password} aria-invalid={Boolean(error)} aria-describedby={error ? 'infinite-password-error' : undefined} onChange={event => { setPassword(event.target.value); setError(''); }} />
        {error && <p id="infinite-password-error" className="infinite-unlock__error" role="alert">{error}</p>}
        <button type="submit" className="infinite-unlock__submit">컬렉션 열기 →</button>
      </form>
    </dialog>
  </div>;
}

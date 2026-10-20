import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { ensureAnonymousSession, nicknameError, savePreferredNickname } from '../services/playerIdentity';

type SessionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: User };

function readableError(error: unknown): string {
  if (error instanceof Error && error.message === 'Firebase .env 설정이 필요합니다.') {
    return 'Firebase 설정이 없습니다. 로컬 테스트는 에뮬레이터와 npm run dev:emulators를 실행해 주세요.';
  }
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'auth/admin-restricted-operation') {
    return 'Firebase Authentication 설정에서 사용자 계정 생성이 제한되어 있습니다. 같은 프로젝트의 설정 → 사용자 작업에서 계정 만들기를 허용해 주세요.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Authentication의 로그인 방법에서 익명 로그인을 활성화해 주세요.';
  }
  return '익명 로그인에 실패했습니다. 연결 상태와 Firebase 익명 인증 설정을 확인한 뒤 다시 시도해 주세요.';
}

export function LobbyPage() {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [nickname, setNickname] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    ensureAnonymousSession().then(user => {
      if (!active) return;
      setSession({ status: 'ready', user });
      const restored = user.displayName ?? '';
      setNickname(restored);
      setSavedNickname(restored);
    }).catch(error => {
      if (active) setSession({ status: 'error', message: readableError(error) });
    });
    return () => { active = false; };
  }, [attempt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.status !== 'ready' || saving) return;
    const error = nicknameError(nickname);
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const saved = await savePreferredNickname(session.user, nickname);
      setNickname(saved);
      setSavedNickname(saved);
    } catch {
      setFormError('닉네임을 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="identity-page">
    <div className="identity-page__intro">
      <span className="eyebrow">ENTER THE ARENA</span>
      <h1>함께할 준비를<br /><em>마쳐 주세요.</em></h1>
      <p>익명으로 입장하고, 친구들에게 보일 닉네임을 정해 주세요. 다음에 돌아와도 같은 브라우저에서는 내 자리를 이어갈 수 있습니다.</p>
      <Link className="text-link" to="/game/demo">먼저 게임판 둘러보기 ↗</Link>
    </div>
    <div className="identity-card" aria-live="polite">
      <span className="eyebrow">PLAYER IDENTITY</span>
      <h2>플레이어 입장</h2>
      {session.status === 'loading' && <p className="identity-card__message" role="status">익명 계정을 확인하고 있습니다…</p>}
      {session.status === 'error' && <div className="identity-card__message"><p role="alert">{session.message}</p><button type="button" className="identity-card__secondary" onClick={() => { setSession({ status: 'loading' }); setAttempt(value => value + 1); }}>다시 시도</button></div>}
      {session.status === 'ready' && <>
        <div className="identity-card__session"><span className="identity-card__status-dot" aria-hidden="true" /><span>익명 로그인 완료</span></div>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="player-nickname">닉네임</label>
          <input id="player-nickname" type="text" value={nickname} onChange={event => { setNickname(event.target.value); setFormError(''); }} autoComplete="nickname" maxLength={32} aria-invalid={Boolean(formError)} aria-describedby={formError ? 'nickname-error' : 'nickname-hint'} placeholder="2~16자 입력" disabled={saving} />
          <p id={formError ? 'nickname-error' : 'nickname-hint'} className={formError ? 'identity-card__error' : 'identity-card__hint'}>{formError || '앞뒤 공백을 제외한 2~16자 · 같은 닉네임도 사용할 수 있어요.'}</p>
          <button className="identity-card__submit" type="submit" disabled={saving || (nickname.trim() === savedNickname && Boolean(savedNickname))}>{saving ? '저장 중…' : savedNickname ? '닉네임 변경' : '닉네임 저장'}</button>
        </form>
        {savedNickname && <div className="identity-card__ready" role="status"><strong>{savedNickname}</strong>님, 입장 준비가 끝났습니다.<small>방을 만들거나 참가할 때 이 닉네임을 기본값으로 사용합니다. 방마다 변경할 수 있습니다.</small></div>}
        <p className="identity-card__next">방 생성과 초대 코드 입장은 20일차 작업에서 연결됩니다.</p>
      </>}
    </div>
  </section>;
}

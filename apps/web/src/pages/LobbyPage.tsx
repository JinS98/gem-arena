import { useEffect, useRef, useState, type FormEvent } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from 'firebase/auth';
import { getFirebase } from '../services/firebase';
import { ensureAnonymousSession, nicknameError, savePreferredNickname } from '../services/playerIdentity';
import { createRoom, isRoomConnectionError, joinRoom, roomErrorMessage, roomTitleError,
  withRoomRequestTimeout, type RoomAccess, type RoomListing } from '../services/rooms';
import { themePreviewArtwork } from '../components/cardArtwork';
import { normalizeGameTheme, themeLabels } from '../components/GameTheme';

type SessionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: User };

function readableError(error: unknown): string {
  if (error instanceof Error && error.message === 'Firebase .env 설정이 필요합니다.') {
    return '온라인 대전 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'auth/admin-restricted-operation') {
    return 'Firebase Authentication 설정에서 사용자 계정 생성이 제한되어 있습니다. 같은 프로젝트의 설정 → 사용자 작업에서 계정 만들기를 허용해 주세요.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Firebase Authentication의 로그인 방법에서 익명 로그인을 활성화해 주세요.';
  }
  const details = error && typeof error === 'object' && 'details' in error ? error.details : null;
  if (details && typeof details === 'object' && 'reason' in details && details.reason === 'REQUEST_TIMEOUT') {
    return '익명 로그인 응답이 지연되고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  }
  return '익명 로그인에 실패했습니다. 연결 상태와 Firebase 익명 인증 설정을 확인한 뒤 다시 시도해 주세요.';
}

export function LobbyPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionState>({ status: 'loading' });
  const [nickname, setNickname] = useState('');
  const [savedNickname, setSavedNickname] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomBusy, setRoomBusy] = useState(false);
  const [activeRoomKey, setActiveRoomKey] = useState('');
  const [listings, setListings] = useState<RoomListing[]>([]);
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const pendingRoomRequest = useRef<{ key: string; promise: Promise<RoomAccess> } | null>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    withRoomRequestTimeout(ensureAnonymousSession()).then(user => {
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

  useEffect(() => {
    if (session.status !== 'ready') return;
    const roomsQuery = query(collection(getFirebase().db, 'roomListings'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(roomsQuery, snapshot => {
      setListings(snapshot.docs.map(item => ({ ...item.data(), roomCode: item.id }) as RoomListing));
      setListStatus('ready');
    }, () => setListStatus('error'));
  }, [session.status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.status !== 'ready' || saving) return;
    const error = nicknameError(nickname);
    if (error) { setFormError(error); return; }
    setSaving(true);
    setFormError('');
    try {
      const saved = await withRoomRequestTimeout(savePreferredNickname(session.user, nickname));
      setNickname(saved);
      setSavedNickname(saved);
      setEditingNickname(false);
    } catch {
      setFormError('닉네임을 저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function enterRoom(kind: 'create' | 'join', selectedCode = roomCode) {
    if (session.status !== 'ready' || roomBusy) return;
    if (!savedNickname) {
      setEditingNickname(true);
      setFormError('먼저 닉네임을 저장해 주세요.');
      return;
    }
    if (kind === 'create') {
      const error = roomTitleError(roomTitle);
      if (error) { setRoomError(error); return; }
    }
    const code = selectedCode.trim().toUpperCase();
    const key = kind === 'create' ? `create:${roomTitle.trim()}` : `join:${code}`;
    setRoomError('');
    setRoomBusy(true);
    setActiveRoomKey(key);
    try {
      let pending = pendingRoomRequest.current;
      if (!pending || pending.key !== key) {
        pending = { key, promise: kind === 'create' ? createRoom(savedNickname, roomTitle) : joinRoom(code, savedNickname) };
        pendingRoomRequest.current = pending;
        const current = pending;
        void pending.promise.catch(() => {
          if (pendingRoomRequest.current === current) pendingRoomRequest.current = null;
        });
      }
      const access = await withRoomRequestTimeout(pending.promise);
      navigate(`/rooms/${access.roomId}`);
    } catch (error) {
      const message = roomErrorMessage(error);
      setRoomError(message);
      if (isRoomConnectionError(error)) window.alert(message);
    } finally {
      setRoomBusy(false);
      setActiveRoomKey('');
    }
  }

  const canEnter = session.status === 'ready' && Boolean(savedNickname) && !roomBusy;
  const entryLocked = !savedNickname || session.status !== 'ready';

  return <section className="lobby-page">
    <div className="lobby-page__heading">
      <div><span className="eyebrow">ONLINE ARENA</span><h1>온라인 대전 로비</h1><p>새로운 방을 열거나, 기다리는 플레이어의 방에 참가하세요.</p></div>
      <Link className="lobby-page__local" to="/game/local">한 PC에서 플레이 <span aria-hidden="true">↗</span></Link>
    </div>

    <div className="lobby-identity" aria-live="polite">
      {session.status === 'loading' && <p role="status">플레이어를 확인하고 있습니다…</p>}
      {session.status === 'error' && <div className="lobby-identity__error"><p role="alert">{session.message}</p><button type="button" onClick={() => { setSession({ status: 'loading' }); setAttempt(value => value + 1); }}>다시 시도</button></div>}
      {session.status === 'ready' && <>
        {savedNickname && !editingNickname ? <div className="lobby-identity__saved">
          <span className="lobby-identity__avatar" aria-hidden="true">{Array.from(savedNickname)[0]}</span>
          <div><span className="eyebrow">YOUR PLAYER</span><strong>{savedNickname}</strong></div>
          <span className="lobby-identity__online"><i aria-hidden="true" />입장 준비 완료</span>
          <button type="button" onClick={() => { setNickname(savedNickname); setEditingNickname(true); }}>닉네임 변경</button>
        </div> : <form className="lobby-identity__form" onSubmit={handleSubmit} noValidate>
          <div className="lobby-identity__form-copy"><span className="eyebrow">YOUR PLAYER</span><strong>{savedNickname ? '닉네임 변경' : '먼저 닉네임을 정해 주세요'}</strong></div>
          <div className="lobby-identity__input"><label htmlFor="player-nickname">닉네임</label><input ref={nicknameInputRef} id="player-nickname" type="text" value={nickname} onChange={event => { setNickname(event.target.value); setFormError(''); }} autoComplete="nickname" maxLength={32} placeholder="2~16자 입력" disabled={saving} aria-invalid={Boolean(formError)} aria-describedby={formError ? 'nickname-error' : 'nickname-hint'} /><small id={formError ? 'nickname-error' : 'nickname-hint'} className={formError ? 'lobby-identity__validation' : ''}>{formError || '다른 플레이어와 같은 닉네임도 사용할 수 있어요.'}</small></div>
          <div className="lobby-identity__form-actions"><button className="lobby-button lobby-button--gold" type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>{savedNickname && <button className="lobby-button lobby-button--quiet" type="button" onClick={() => { setNickname(savedNickname); setFormError(''); setEditingNickname(false); }}>취소</button>}</div>
        </form>}
      </>}
    </div>

    <div className={`lobby-page__entry${entryLocked ? ' lobby-page__entry--locked' : ''}`}>
    <div className="lobby-page__grid" inert={entryLocked}>
      <div className="lobby-page__controls" aria-busy={roomBusy}>
        <section className="lobby-panel lobby-panel--create">
          <span className="eyebrow">CREATE A ROOM</span><h2>새 방 만들기</h2><p>방 제목을 정하고 친구를 기다리세요. 생성 후 초대 코드를 공유할 수 있습니다.</p>
          <label htmlFor="room-title">방 제목</label>
          <input id="room-title" value={roomTitle} onChange={event => { setRoomTitle(event.target.value); setRoomError(''); }} maxLength={32} placeholder="예: 오늘 저녁 보석 대전" autoComplete="off" disabled={roomBusy} />
          <button type="button" className="lobby-button lobby-button--gold" onClick={() => void enterRoom('create')} disabled={!canEnter}>{activeRoomKey.startsWith('create:') ? '방 만드는 중…' : '방 만들기'} <span aria-hidden="true">↗</span></button>
        </section>
        <section className="lobby-panel lobby-panel--join">
          <span className="eyebrow">INVITATION</span><h2>초대 코드로 참가</h2><p>목록에 보이지 않는 방도 초대 코드로 참가할 수 있습니다.</p>
          <label htmlFor="room-code">8자리 초대 코드</label>
          <div className="lobby-panel__join"><input id="room-code" value={roomCode} onChange={event => { setRoomCode(event.target.value.toUpperCase()); setRoomError(''); }} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="초대 코드" disabled={roomBusy} /><button type="button" className="lobby-button lobby-button--outline" onClick={() => void enterRoom('join')} disabled={!canEnter}>방 참가</button></div>
        </section>
        {roomError && <p className="lobby-page__error" role="alert">{roomError}</p>}
      </div>

      <section className="lobby-panel lobby-panel--list" aria-live="polite">
        <div className="lobby-panel__list-heading"><div><span className="eyebrow">OPEN ROOMS</span><h2>참가할 방</h2></div><span className="lobby-panel__count">{listStatus === 'ready' ? `${listings.length}개` : '—'}</span></div>
        {listStatus === 'loading' && <p className="lobby-panel__state" role="status">대기 중인 방을 불러오고 있습니다…</p>}
        {listStatus === 'error' && <p className="lobby-panel__state" role="alert">방 목록을 불러오지 못했습니다. 잠시 후 다시 접속해 주세요.</p>}
        {listStatus === 'ready' && listings.length === 0 && <div className="lobby-panel__empty"><span aria-hidden="true">◇</span><strong>아직 기다리는 방이 없어요</strong><p>첫 번째 방을 열고 친구를 초대해 보세요.</p></div>}
        {listStatus === 'ready' && listings.length > 0 && <ul className="lobby-room-list">{listings.map(listing => {
          const full = listing.playerCount >= listing.capacity;
          const rowKey = `join:${listing.roomCode}`;
          const theme = normalizeGameTheme(listing.theme);
          return <li key={listing.roomCode} className={`lobby-room-list__item lobby-room-list__item--${theme}`}><img className="lobby-room-list__art" src={themePreviewArtwork(theme)} alt="" loading="lazy" /><div className="lobby-room-list__crest" aria-hidden="true">◆</div><div className="lobby-room-list__details"><strong>{listing.title}</strong><span className="lobby-room-list__theme">{themeLabels[theme]}</span><span>{listing.hostNickname} 방장 <i aria-hidden="true">·</i> {listing.playerCount}/{listing.capacity}명</span></div><button type="button" onClick={() => void enterRoom('join', listing.roomCode)} disabled={!canEnter || full}>{activeRoomKey === rowKey ? '참가 중…' : full ? '정원 마감' : '참가하기'}</button></li>;
        })}</ul>}
      </section>
    </div>
    {session.status === 'ready' && !savedNickname && <div className="lobby-page__lock" aria-labelledby="lobby-lock-title">
      <span className="lobby-page__lock-mark" aria-hidden="true">◆</span>
      <span className="eyebrow">PLAYER FIRST</span>
      <h2 id="lobby-lock-title">닉네임을 먼저 정해 주세요</h2>
      <p>저장하면 방 만들기와 참가하기가 열립니다.</p>
      <button type="button" className="lobby-button lobby-button--gold" onClick={() => nicknameInputRef.current?.focus()}>닉네임 입력하기 <span aria-hidden="true">↑</span></button>
    </div>}
    </div>
  </section>;
}

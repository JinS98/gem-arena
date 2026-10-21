import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link, useParams } from 'react-router-dom';
import { getFirebase } from '../services/firebase';
import { ensureAnonymousSession } from '../services/playerIdentity';
import { roomErrorMessage, setReady, startGame, type WaitingRoom } from '../services/rooms';

export function RoomPage() {
  const { roomId } = useParams();
  const [myUid, setMyUid] = useState('');
  const [room, setRoom] = useState<WaitingRoom | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let unsubscribeRoom = () => {};
    ensureAnonymousSession().then(user => {
      if (cancelled) return;
      setMyUid(user.uid);
      unsubscribeRoom = onSnapshot(doc(getFirebase().db, 'rooms', roomId), snapshot => {
        if (!snapshot.exists()) {
          setError('방을 찾지 못했습니다.');
          return;
        }
        const nextRoom = snapshot.data() as WaitingRoom;
        if (!nextRoom.players?.[user.uid]) {
          setError('이 방에 참가하지 않았습니다. 초대 코드로 참가해 주세요.');
          return;
        }
        setError('');
        setRoom(nextRoom);
      }, () => setError('방 정보를 읽지 못했습니다. Firestore 규칙을 확인해 주세요.'));
    }).catch(() => setError('로그인을 확인하지 못했습니다. 로비에서 다시 시도해 주세요.'));
    return () => {
      cancelled = true;
      unsubscribeRoom();
    };
  }, [roomId]);

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function changeReady() {
    if (!room || !myUid || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      await setReady(room.roomCode, !room.players[myUid].ready);
    } catch (error) {
      setActionError(roomErrorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  async function beginGame() {
    if (!room || actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      await startGame(room.roomCode);
    } catch (error) {
      setActionError(roomErrorMessage(error));
    } finally {
      setActionBusy(false);
    }
  }

  const isHost = room?.hostUid === myUid;
  const readyCount = room?.playerOrder.filter(uid => room.players[uid]?.ready).length ?? 0;
  const canStart = Boolean(room && isHost && room.status === 'waiting' &&
    room.playerOrder.length >= 2 && readyCount === room.playerOrder.length);

  return <section className="waiting-room">
    <div className="waiting-room__heading"><span className="eyebrow">PRIVATE ROOM</span><h1>대기실</h1><p>초대 코드를 친구에게 알려주면 같은 방에 참가할 수 있습니다.</p></div>
    {error && <div className="waiting-room__error" role="alert">{error}<br /><Link to="/lobby">로비로 돌아가기</Link></div>}
    {!error && !room && <p role="status">방 정보를 불러오고 있습니다…</p>}
    {!error && room && <div className="waiting-room__grid">
      <div className="waiting-room__panel">
        <span className="eyebrow">INVITATION CODE</span>
        <div className="waiting-room__code"><strong>{room.roomCode}</strong><button type="button" onClick={copyCode}>{copied ? '복사 완료' : '코드 복사'}</button></div>
        <p>상태: {room.status === 'waiting' ? '참가자 대기 중' : room.status === 'playing' ? '게임 진행 중' : '게임 종료'}</p>
        <Link className="text-link" to="/lobby">다른 방으로 이동</Link>
      </div>
      <div className="waiting-room__panel">
        <span className="eyebrow">PLAYERS · {room.playerOrder.length}/{room.capacity}</span>
        <h2>참가자</h2>
        <ol className="waiting-room__players">{room.playerOrder.map((uid, seatIndex) => ({ player: room.players[uid], seatIndex })).filter(({ player }) => Boolean(player)).map(({ player, seatIndex }) => <li key={player.uid}><span className="waiting-room__seat">{seatIndex + 1}</span><strong>{player.nickname}</strong>{player.uid === room.hostUid && <small>방장</small>}{player.uid === myUid && <small>나</small>}<span className={`waiting-room__readiness ${player.ready ? 'waiting-room__readiness--ready' : ''}`}>{player.ready ? '준비 완료' : '준비 전'}</span></li>)}</ol>
        {room.status === 'waiting' && <div className="waiting-room__controls">
          <p>준비 완료 {readyCount}/{room.playerOrder.length} · 2~4명 모두 준비하면 방장이 시작할 수 있습니다.</p>
          <button type="button" onClick={changeReady} disabled={actionBusy}>{room.players[myUid]?.ready ? '준비 취소' : '준비하기'}</button>
          {isHost && <button type="button" className="waiting-room__start" onClick={beginGame} disabled={actionBusy || !canStart}>게임 시작</button>}
          {!isHost && <p>방장이 게임을 시작하기를 기다리고 있습니다.</p>}
        </div>}
        {room.status === 'playing' && <p role="status">게임이 시작되었습니다. 멀티 게임판과 실제 턴 진행은 다음 작업에서 연결됩니다.</p>}
        {actionError && <p className="waiting-room__action-error" role="alert">{actionError}</p>}
      </div>
    </div>}
  </section>;
}

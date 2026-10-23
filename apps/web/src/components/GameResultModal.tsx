import { useEffect, useRef } from 'react';
import type { ServerGameState } from '@gem-arena/engine';
import type { PlayerDisplay } from '../data/playerDisplay';

export function GameResultModal({ game, players, onRestart, restartLabel = '새 게임' }: {
  game: ServerGameState; players: PlayerDisplay[]; onRestart: () => void; restartLabel?: string;
}) {
  const restartRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { restartRef.current?.focus(); }, []);
  const ranking = [...players].sort((a, b) => {
    const left = game.players[a.id];
    const right = game.players[b.id];
    return right.score - left.score || left.purchasedCardIds.length - right.purchasedCardIds.length;
  });
  const winnerNames = game.winnerIds.map((id) => players.find((player) => player.id === id)?.name ?? id);
  return (
    <div className="result-backdrop">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <span className="eyebrow">GAME FINISHED</span>
        <div className="result-modal__emblem" aria-hidden="true">✧</div>
        <h2 id="result-title">게임 종료</h2>
        <p className="result-modal__winner">{winnerNames.join(' · ')} {winnerNames.length > 1 ? '공동 승리' : '승리'}</p>
        <p className="result-modal__rule">최고 점수, 동점이면 구매 카드가 적은 순으로 결정했습니다.</p>
        <ol className="result-modal__ranking">
          {ranking.map((player) => {
            const result = game.players[player.id];
            return <li key={player.id} className={game.winnerIds.includes(player.id) ? 'is-winner' : ''}>
              <span>{player.name}{game.winnerIds.includes(player.id) && ' ✦'}</span>
              <small>구매 {result.purchasedCardIds.length}장 · 귀족 {result.nobleIds.length}명</small>
              <strong>{result.score}점</strong>
            </li>;
          })}
        </ol>
        <button ref={restartRef} type="button" onClick={onRestart}>{restartLabel}</button>
      </section>
    </div>
  );
}

import { canTakeGems, excessGemCount, gemCount, hasLegalBasicAction } from '@gem-arena/engine';
import type { Gem, GemColor } from '@gem-arena/engine';
import { useDemoGemStore } from '../stores/demoGemStore';
import { GemIcon, gemNames } from './GemIcon';

const colors: Gem[] = ['white', 'blue', 'green', 'red', 'black', 'gold'];
const regularColors: GemColor[] = ['white', 'blue', 'green', 'red', 'black'];

export function GemActionPanel() {
  const { bank, gems, game, currentPlayerId, scenario, mode, phase, selectedColors, returned, notice,
    setMode, changeReturn, takeSelected, confirmReturn, loadDiscardExample,
    loadNobleExample, loadFinalRoundExample, advanceTurn, passTurn, restart, reset } = useDemoGemStore();
  const takeColors = mode === 'pair' && selectedColors.length === 1
    ? [selectedColors[0], selectedColors[0]] : selectedColors;
  const canConfirmTake = phase === 'selecting' && canTakeGems(bank, takeColors);
  const availableColors = regularColors.filter((color) => bank[color] > 0).length;
  const excess = excessGemCount(gems);
  const selectedReturnCount = gemCount(returned);
  const canPass = phase === 'selecting' && !hasLegalBasicAction(game, currentPlayerId);

  return (
    <section className="side-card gem-action" aria-labelledby="gem-action-title">
      <span className="eyebrow">{scenario === 'fullGame' ? 'LOCAL MATCH' : 'LOCAL PRACTICE'}</span>
      <h2 id="gem-action-title">{scenario === 'fullGame' ? '현재 플레이어 행동' : '턴 연습'}</h2>
      <p className="gem-action__intro">{scenario === 'fullGame'
        ? '한 턴에 보석 획득·카드 구매·예약 중 한 가지를 선택하세요. 가능한 행동이 없으면 패스할 수 있습니다.'
        : '현재 플레이어의 보석 획득 또는 카드 행동 한 가지를 연습하세요. 실제 대전에는 반영되지 않습니다.'}</p>

      {phase === 'selecting' && <>
        <div className="gem-action__modes" role="group" aria-label="보석 획득 방식">
          <button type="button" className={mode === 'different' ? 'is-active' : ''} aria-pressed={mode === 'different'} onClick={() => setMode('different')}>서로 다른 색</button>
          <button type="button" className={mode === 'pair' ? 'is-active' : ''} aria-pressed={mode === 'pair'} onClick={() => setMode('pair')}>같은 색 2개</button>
        </div>
        <p className="gem-action__hint">{mode === 'pair'
          ? '은행에 4개 이상 남은 색 하나를 선택하세요.'
          : availableColors >= 3
            ? '은행에서 서로 다른 색 3개를 선택하세요.'
            : `은행에 남은 ${availableColors}색 중에서 선택하세요.`}</p>
        <div className="gem-action__selection"><span>선택</span><strong>{selectedColors.length === 0
          ? '은행의 보석을 누르세요'
          : mode === 'pair'
            ? `${gemNames[selectedColors[0]]} 2개`
            : selectedColors.map((color) => gemNames[color]).join(' · ')}</strong></div>
        <button className="gem-action__submit" type="button" onClick={takeSelected} disabled={!canConfirmTake}>보석 받기</button>
        {scenario === 'fullGame' && <button className="gem-action__pass" type="button" onClick={passTurn} disabled={!canPass}>행동이 없어서 패스</button>}
      </>}

      {phase === 'discarding' && <>
        <p className="gem-action__hint">보석이 10개를 넘었습니다. 원하는 보석 {excess}개를 은행에 반환하세요.</p>
        <div className="gem-action__return-list">
          {colors.filter((color) => gems[color] > 0).map((color) => (
            <div className="gem-action__return-row" key={color}>
              <GemIcon color={color} small /><span>{gemNames[color]} <small>보유 {gems[color]}</small></span>
              <button type="button" aria-label={`${gemNames[color]} 반환 수 줄이기`} onClick={() => changeReturn(color, -1)} disabled={returned[color] === 0}>−</button>
              <strong>{returned[color]}</strong>
              <button type="button" aria-label={`${gemNames[color]} 반환 수 늘리기`} onClick={() => changeReturn(color, 1)} disabled={returned[color] >= gems[color] || selectedReturnCount >= excess}>+</button>
            </div>
          ))}
        </div>
        <div className="gem-action__selection"><span>반환 선택</span><strong>{selectedReturnCount} / {excess}개</strong></div>
        <button className="gem-action__submit" type="button" onClick={confirmReturn} disabled={selectedReturnCount !== excess}>선택한 보석 반환</button>
      </>}

      {phase === 'choosingNoble' && <div className="gem-action__complete"><span aria-hidden="true">✧</span><strong>귀족 선택</strong><p>시장 위의 귀족 중 강조된 한 명을 선택하세요.</p></div>}
      {phase === 'completed' && <><div className="gem-action__complete"><span aria-hidden="true">✓</span><strong>턴 완료</strong><p>엔진이 다음 플레이어를 정했습니다.</p></div><button className="gem-action__submit" type="button" onClick={advanceTurn}>다음 플레이어 시작</button></>}

      <p className="gem-action__notice" role="status" aria-live="polite">{notice || `현재 보유 ${gemCount(gems)} / 10개`}</p>
      {scenario === 'fullGame' ? <div className="gem-action__examples">
        <button type="button" onClick={restart}>같은 인원으로 새 게임</button>
        <button type="button" onClick={reset}>샘플로 돌아가기</button>
      </div> : <div className="gem-action__examples">
        <button type="button" onClick={loadDiscardExample}>9개 보유 상황</button>
        <button type="button" onClick={loadNobleExample}>귀족·종료 상황</button>
        <button type="button" onClick={loadFinalRoundExample}>최종 턴 상황</button>
        <button type="button" onClick={reset}>처음부터</button>
      </div>}
    </section>
  );
}

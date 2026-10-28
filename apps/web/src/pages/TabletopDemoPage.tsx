import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CARD_COLORS, canPayForCard, canTakeGems, countCardBonuses, eligibleNobleIds, excessGemCount, forfeitPlayer,
  getDevelopmentCard, getNoble, hasLegalBasicAction, reduceGameAction } from '@gem-arena/engine';
import type { GameAction, Gem, GemColor, Inventory, ServerGameState } from '@gem-arena/engine';
import { createTabletopDemo, DEMO_ME, demoOpponentAction, demoPayment, demoPlayers, demoScenarios, emptyDemoGems, type DemoScenario } from '../data/tabletopDemo';
import { TabletopScene } from '../components/TabletopScene';
import { TabletopCardDialog, TabletopDialog } from '../components/TabletopDialog';
import { GameThemeProvider, type GameTheme } from '../components/GameTheme';
import { MarketCard } from '../components/MarketCard';
import { DeckCard } from '../components/DeckCard';
import { GemBank } from '../components/GemBank';
import { GemIcon } from '../components/GemIcon';
import { NobleGallery } from '../components/NobleGallery';
import { PlayerPanel } from '../components/PlayerPanel';
import '../tabletop.scss';

const colors: Gem[] = [...CARD_COLORS, 'gold'];

export function TabletopDemoPage({ infinite = false }: { infinite?: boolean }) {
  const [game, setGame] = useState(() => createTabletopDemo());
  const gameRef = useRef(game);
  gameRef.current = game;
  const [scenario, setScenario] = useState<DemoScenario>('explore');
  const [generation, setGeneration] = useState(0);
  const [theme, setTheme] = useState<GameTheme>('default');
  const [mode, setMode] = useState<'different' | 'pair'>('different');
  const [selected, setSelected] = useState<GemColor[]>([]);
  const [returned, setReturned] = useState<Inventory>(emptyDemoGems);
  const [selection, setSelection] = useState<{ id: string; source: 'market' | 'reserved' } | null>(null);
  const [reservedOpen, setReservedOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const inFlight = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (unlockTimer.current) clearTimeout(unlockTimer.current); }, []);
  const me = game.players[DEMO_ME];
  const currentId = game.playerOrder[game.turnIndex];
  const currentName = demoPlayers.find(player => player.id === currentId)?.name ?? '플레이어';
  const myTurn = currentId === DEMO_ME && !me.forfeited;
  const canAct = myTurn && !locked && game.phase !== 'finished';
  const bonuses = countCardBonuses(me.purchasedCardIds);
  const takeColors = mode === 'pair' && selected.length === 1 ? [selected[0], selected[0]] : selected;
  const excess = excessGemCount(me.gems);
  const returnCount = Object.values(returned).reduce((sum, value) => sum + value, 0);
  const selectedCard = selection ? getDevelopmentCard(selection.id) : undefined;
  const eligible = eligibleNobleIds(game, DEMO_ME);

  function reset(nextScenario: DemoScenario = scenario) {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    const next = createTabletopDemo(nextScenario);
    gameRef.current = next;
    setGame(next); setScenario(nextScenario); setGeneration(value => value + 1);
    setSelected([]); setReturned(emptyDemoGems()); setSelection(null); setReservedOpen(false);
    setForfeitOpen(false); setResultOpen(false); setError(''); setLocked(false); inFlight.current = false;
  }
  function commit(next: ServerGameState) {
    gameRef.current = next;
    setGame(next); setSelected([]); setReturned(emptyDemoGems()); setError('');
    setLocked(true); inFlight.current = true;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.querySelector('.tabletop-example--still') !== null;
    unlockTimer.current = setTimeout(() => {
      setLocked(false); inFlight.current = false;
      if (next.phase === 'finished') setResultOpen(true);
    }, reduced ? 0 : 1050);
  }
  function act(action: GameAction): boolean {
    if (inFlight.current || gameRef.current.phase === 'finished') return false;
    try {
      const before = gameRef.current;
      commit(reduceGameAction(before, before.playerOrder[before.turnIndex], action));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '이 행동은 지금 할 수 없습니다.');
      return false;
    }
  }
  function choose(color: GemColor) {
    setSelected(previous => mode === 'pair' ? previous.includes(color) ? [] : [color]
      : previous.includes(color) ? previous.filter(item => item !== color) : previous.length < 3 ? [...previous, color] : previous);
  }
  const panel = (id: string) => {
    const player = game.players[id];
    const identity = demoPlayers.find(item => item.id === id)!;
    return <PlayerPanel key={id} player={{ ...identity, score: player.score, gems: player.gems,
      bonuses: countCardBonuses(player.purchasedCardIds), purchasedCount: player.purchasedCardIds.length,
      reservedCount: player.reservedCardIds.length, isLocal: id === DEMO_ME }} isCurrent={id === currentId && game.phase !== 'finished'}
      forfeited={player.forfeited} showGemNames />;
  };
  const cardButton = (id: string, source: 'market' | 'reserved') => {
    const card = getDevelopmentCard(id)!;
    const affordable = canPayForCard(card.cost, bonuses, me.gems, demoPayment(card, game, DEMO_ME));
    return <div data-tabletop-card={id} className="tabletop-card-slot" key={id}>
      <MarketCard tactile={infinite} purchasable={infinite && affordable && myTurn} card={card} bonuses={bonuses} className={affordable && myTurn ? 'tabletop-card--affordable' : ''}
        onSelect={() => setSelection({ id, source })} />
      {!infinite && affordable && myTurn && <span className="tabletop-card-slot__hint" aria-hidden="true">구매 가능</span>}
    </div>;
  };

  const selfPanel = (<section className={infinite ? 'multiplayer-self multiplayer-self--expanded' : 'tabletop-self'}><div className={infinite ? 'multiplayer-self__heading' : 'tabletop-self__identity'}><div><span className="eyebrow">YOUR COLLECTION</span><h2>{infinite ? '내 현황' : '나의 상단'}</h2></div><span>보유 보석과 영구 할인은 따로 계산됩니다.</span></div>
          {panel(DEMO_ME)}<button type="button" className="tabletop-reserved-trigger" onClick={() => setReservedOpen(true)}><span aria-hidden="true">▱</span><div><small>나만 볼 수 있는 카드</small><strong>내 예약 카드 <em>{me.reservedCardIds.length} / 3</em></strong></div><span aria-hidden="true">↗</span></button>
        </section>);

  return <GameThemeProvider theme={theme}><TabletopScene key={generation} game={game} multiplayer={infinite}>
    <header className="tabletop-demo-heading"><div><span className="eyebrow">{infinite ? 'INSPIRIT · PRIVATE COLLECTION' : 'THE TABLETOP COLLECTION · 01'}</span><h1>{infinite ? <>다시 만난 우리의 <em>무한한 순간.</em></> : <>손끝에서 시작되는 <em>보석의 전략.</em></>}</h1><p>{infinite ? '여섯 멤버의 포토카드와 앨범을 모으는 INFINITE 컬렉션.' : '카드를 집고, 보석을 옮기고, 나만의 상단을 완성하세요.'}</p></div>
      <div className="tabletop-demo-heading__badge"><span aria-hidden="true">◇</span><div><strong>{infinite ? 'INFINITE' : '3D 예시'}</strong><small>연결 없이 혼자 체험하는 멀티 보드</small></div></div></header>
    <section className="tabletop-demo-controls" aria-label="시연 장면 선택"><div className="tabletop-demo-controls__scenes"><span>체험 장면</span>{Object.entries(demoScenarios).map(([id, item]) =>
      <button type="button" key={id} aria-pressed={scenario === id} onClick={() => reset(id as DemoScenario)}>{item.label}</button>)}</div>
      <div className="tabletop-demo-controls__options">{!infinite && <label>테마 <select value={theme} onChange={event => setTheme(event.target.value as GameTheme)}><option value="default">보석 상인</option><option value="lol">리그 오브 레전드</option><option value="demon-slayer">귀멸의 칼날</option><option value="naruto">나루토</option></select></label>}<button type="button" onClick={() => reset()}>장면 초기화 ↺</button></div></section>
    <p className="tabletop-demo-hint">{demoScenarios[scenario].hint}</p>
    <div className={infinite ? 'site-main--live-game infinite-live-board' : undefined}>
    <div className={`multiplayer-page tabletop-game game-theme--${theme}`} data-game-version={game.version} data-game-phase={game.phase}>
      <div className="multiplayer-page__heading"><div className="multiplayer-page__title"><span className="eyebrow">GEM ARENA · 4 PLAYER TABLE</span><h2>{infinite ? 'INFINITE · 앨범 컬렉션' : '보석 상인의 테이블'} <span>시연</span></h2></div>
        <div className="multiplayer-page__heading-side"><div className={`multiplayer-page__turn${myTurn ? ' multiplayer-page__turn--mine' : ''}`} role="status"><span className="multiplayer-page__turn-indicator" /><span className="multiplayer-page__turn-copy"><small>{locked ? '테이블 정리 중' : game.phase === 'finished' ? '게임 종료' : '현재 차례'}</small><strong>{game.phase === 'finished' ? '대전이 끝났습니다' : myTurn ? '내 차례' : currentName}</strong></span><span className="tabletop-turn-marker" aria-hidden="true">◆</span></div>
          <button className="tabletop-quiet" type="button" disabled={locked || me.forfeited || game.phase === 'finished'} onClick={() => setForfeitOpen(true)}>기권 시연</button></div></div>
      {error && <p className="multiplayer-page__error" role="alert">{error}</p>}
      <div className={`multiplayer-table${infinite ? '' : ' tabletop-table'}`}>
        <aside className="multiplayer-table__left"><NobleGallery nobles={game.availableNobleIds.map(id => getNoble(id)!)} eligibleIds={game.phase === 'choosingNoble' ? eligible : []}
          onChoose={canAct && game.phase === 'choosingNoble' ? id => { act({ type: 'CHOOSE_NOBLE', nobleId: id }); } : undefined} />
          <section className="multiplayer-opponents"><div className="multiplayer-section-label"><span className="eyebrow">OPPONENTS</span><h2>맞은편 플레이어</h2></div><div className="multiplayer-opponents__list">{demoPlayers.filter(player => player.id !== DEMO_ME).map(player => panel(player.id))}</div></section></aside>
        <section className="market-section"><div className="section-heading"><div><span className="eyebrow">THE MARKET</span><h2>{infinite ? '포토카드 컬렉션' : '개발 카드 시장'}</h2></div><span className="section-heading__meta">단계별 4장 · 카드를 눌러 확인</span></div>
          <div className="market-levels">{([3, 2, 1] as const).map(level => <div className={`market-row market-row--level-${level}`} key={level}>
            <div className="market-row__label" data-tabletop-deck={level}><DeckCard level={level} remaining={game.decks[level].length}
              disabled={!canAct || game.phase !== 'playing' || me.reservedCardIds.length >= 3 || game.decks[level].length === 0} onReserve={() => act({ type: 'RESERVE_CARD', level })} /></div>
            <div className="market-row__cards">{game.market[level].map((id, slot) => id ? cardButton(id, 'market') : <div key={slot} className="market-card-empty">빈자리</div>)}</div>
          </div>)}</div></section>
        <aside className={`multiplayer-actions${infinite ? '' : ' tabletop-bank'}`}><div className="section-heading"><div><span className="eyebrow">THE VAULT</span><h2>{infinite ? '앨범 보관소' : '보석 은행'}</h2></div><span aria-hidden="true">✧</span></div>
          <GemBank bank={game.bank} mode={mode} phase={canAct && game.phase === 'playing' ? 'selecting' : 'completed'} selectedColors={selected} onSelect={choose} />
          <div className="multiplayer-actions__panel"><span className="eyebrow">YOUR MOVE</span>
            {game.phase === 'finished' ? <><h3>게임이 끝났습니다</h3><button type="button" className="tabletop-primary" onClick={() => setResultOpen(true)}>결과 보기</button><button type="button" onClick={() => reset('explore')}>다시 체험하기</button></>
              : !myTurn || me.forfeited ? <><h3>{currentName}의 차례</h3><p>상대의 행동도 같은 테이블 위에서 확인하세요.</p><button type="button" className="tabletop-primary" disabled={locked} onClick={() => act(demoOpponentAction(game))}>{locked ? '행동을 보여주는 중…' : '상대 행동 보기 →'}</button></>
                : game.phase === 'discarding' ? <><h3>초과 보석 {excess}개 반환</h3><p>은행으로 돌려보낼 칩을 선택하세요.</p><div className="tabletop-return-list">{colors.filter(color => me.gems[color] > 0).map(color => <div key={color}><GemIcon color={color} /><span>보유 {me.gems[color]}</span><button type="button" aria-label={`${color} 반환 줄이기`} disabled={locked || returned[color] === 0} onClick={() => setReturned(value => ({ ...value, [color]: value[color] - 1 }))}>−</button><strong>{returned[color]}</strong><button type="button" aria-label={`${color} 반환 늘리기`} disabled={locked || returnCount >= excess || returned[color] >= me.gems[color]} onClick={() => setReturned(value => ({ ...value, [color]: value[color] + 1 }))}>+</button></div>)}</div><button type="button" className="tabletop-primary" disabled={locked || returnCount !== excess} onClick={() => act({ type: 'DISCARD_GEMS', gems: returned })}>선택한 보석 반환 {returnCount}/{excess}</button></>
                  : game.phase === 'choosingNoble' ? <><h3>귀족이 방문했습니다</h3><p>왼쪽에서 강조된 귀족 한 명을 선택하세요. 방문한 귀족은 3점을 줍니다.</p></>
                    : <><h3>어떤 전략을 펼칠까요?</h3><p>보석을 받거나, 카드를 구매·예약하세요.</p><div className="multiplayer-actions__modes"><button type="button" aria-pressed={mode === 'different'} className={mode === 'different' ? 'is-active' : ''} disabled={locked} onClick={() => { setMode('different'); setSelected([]); }}>다른 색 최대 3개</button><button type="button" aria-pressed={mode === 'pair'} className={mode === 'pair' ? 'is-active' : ''} disabled={locked} onClick={() => { setMode('pair'); setSelected([]); }}>같은 색 2개</button></div>
                      <div className="tabletop-selection">{selected.length ? selected.map((color, index) => <GemIcon key={index} color={color} />) : <span>위에서 보석을 골라보세요</span>}{mode === 'pair' && selected.length > 0 && <GemIcon color={selected[0]} />}</div>
                      <button type="button" className="tabletop-primary" disabled={locked || !canTakeGems(game.bank, takeColors)} onClick={() => act({ type: 'TAKE_GEMS', colors: takeColors })}>{locked ? '테이블 정리 중…' : '선택한 보석 받기'}</button>
                      {!hasLegalBasicAction(game, DEMO_ME) && <button type="button" disabled={locked} onClick={() => act({ type: 'PASS' })}>가능한 행동이 없어 패스</button>}</>}
          </div><button type="button" className="tabletop-timeout" disabled={locked || game.phase === 'finished'} onClick={() => act({ type: 'TIMEOUT' })}>시간 초과 · 다음 차례 시연 ↗</button>{infinite && selfPanel}</aside>
        {!infinite && selfPanel}
      </div>
    </div>
    </div>
    <footer className="tabletop-demo-footer"><span>{infinite ? 'INFINITE 비공식 팬 테마' : '3D 예시'} · 모든 플레이어는 시연용입니다. 새로고침하면 장면이 초기화됩니다.</span><Link to="/lobby">온라인 로비 ↗</Link></footer>
    <div className={infinite ? 'tabletop-example infinite-preview-dialogs' : undefined}>
    {selection && selectedCard && <TabletopCardDialog key={`${selection.source}-${selection.id}`} card={selectedCard} game={game} source={selection.source} canAct={canAct && game.phase === 'playing'} onAction={act} onClose={() => setSelection(null)} />}
    {reservedOpen && <TabletopDialog title={`내 예약 카드 · ${me.reservedCardIds.length}/3`} onClose={() => setReservedOpen(false)}><p className="tabletop-dialog__hint">카드를 선택하면 결제 비용을 확인하고 구매할 수 있습니다.</p><div className="tabletop-reserved-cards">{me.reservedCardIds.length ? me.reservedCardIds.map(id => <div key={id} onClickCapture={() => setReservedOpen(false)}>{cardButton(id, 'reserved')}</div>) : <p>시장 카드나 단계별 덱을 예약해 보세요.</p>}</div></TabletopDialog>}
    {forfeitOpen && <TabletopDialog title="기권을 시연할까요?" onClose={() => setForfeitOpen(false)}><p>내 보석을 은행으로 반환하고 이후에는 상대의 행동을 관전합니다. 장면 초기화로 다시 체험할 수 있습니다.</p><div className="tabletop-dialog__actions"><button type="button" onClick={() => { if (!inFlight.current) { commit(forfeitPlayer(gameRef.current, DEMO_ME)); setForfeitOpen(false); } }}>기권하고 관전</button><button type="button" onClick={() => setForfeitOpen(false)}>취소</button></div></TabletopDialog>}
    {resultOpen && <TabletopDialog title="게임 종료" onClose={() => setResultOpen(false)}><div className="tabletop-results"><span aria-hidden="true">♔</span><h3>{game.winnerIds.map(id => demoPlayers.find(player => player.id === id)?.name).join(' · ')} 승리</h3>{demoPlayers.map(player => <p key={player.id}><span>{player.name}{game.players[player.id].forfeited ? ' · 기권' : ''}</span><strong>{game.players[player.id].score}점</strong></p>)}<button type="button" className="tabletop-primary" onClick={() => reset('explore')}>다시 체험하기</button></div></TabletopDialog>}
    </div>
  </TabletopScene></GameThemeProvider>;
}

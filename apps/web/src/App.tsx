import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { GameBoardPage } from './pages/GameBoardPage';
import { LobbyPage } from './pages/LobbyPage';
import { MultiplayerGamePage } from './pages/MultiplayerGamePage';
import { RoomPage } from './pages/RoomPage';
import { RulesPage } from './pages/RulesPage';
import { themePreviewArtwork } from './components/cardArtwork';
import { GAME_THEMES, themeLabels, type GameTheme } from './components/GameTheme';

const homeThemeDescriptions: Record<GameTheme, string> = {
  default: '보석 상인의 도시',
  lol: '룬테라의 챔피언',
  'demon-slayer': '귀살대와 호흡',
};

function Home() {
  return <section className="welcome-page">
    <div className="welcome-page__copy">
      <span className="eyebrow">GEM ARENA · THREE WORLDS, ONE GAME</span>
      <div className="welcome-page__rule" aria-hidden="true"><span>◆</span></div>
      <h1>하나의 전략,<br /><em>세 가지 세계.</em></h1>
      <p>보석 상인의 도시, 룬테라, 귀살대의 세계에서 카드를 모으고 자원을 활용해 승점을 쌓으세요. 테마를 골라도 게임의 규칙은 같습니다.</p>
      <div className="welcome-page__actions">
        <Link className="primary-link" to="/lobby">온라인 대전 입장 <span aria-hidden="true">↗</span></Link>
        <Link className="welcome-page__secondary" to="/game/local">한 PC 대전 <span aria-hidden="true">→</span></Link>
      </div>
      <div className="welcome-page__details">
        <span><strong>02–04</strong> 플레이어</span>
        <span><strong>03:00</strong> 온라인 턴 제한</span>
        <span><strong>03</strong> 선택 가능한 테마</span>
      </div>
    </div>
    <div className="welcome-showcase" aria-label="게임 테마 미리보기">
      <div className="welcome-showcase__heading"><span>CHOOSE YOUR WORLD</span><span>같은 규칙, 새로운 분위기</span></div>
      <div className="welcome-showcase__cards">
        {GAME_THEMES.map((option, index) => <div className={'welcome-showcase__card welcome-showcase__card--' + option} key={option}>
          <img src={themePreviewArtwork(option)} alt="" />
          <span className="welcome-showcase__card-index">0{index + 1}</span>
          <div className="welcome-showcase__card-copy"><small>{homeThemeDescriptions[option]}</small><strong>{themeLabels[option]}</strong></div>
        </div>)}
      </div>
      <div className="welcome-showcase__footer"><span>테마는 게임 시작 전에 선택할 수 있습니다.</span><span>추가 테마는 비공식 팬 테마입니다.</span></div>
    </div>
  </section>;
}

export default function App() {
  const { pathname } = useLocation();
  const isLiveGame = pathname.startsWith('/game/') && pathname !== '/game/local';
  return <div className="app-shell">
    {!isLiveGame && <header className="site-header"><div className="site-header__inner"><Link className="brand" to="/" aria-label="Gem Arena 홈"><span className="brand__mark" aria-hidden="true">◆</span><span>GEM <strong>ARENA</strong></span></Link><nav aria-label="주 메뉴"><NavLink to="/" end>홈</NavLink><NavLink to="/lobby">로비</NavLink><NavLink to="/rules">룰</NavLink><NavLink to="/game/local">한 PC 대전</NavLink></nav>{pathname === '/game/local' && <span className="site-header__tag">LOCAL MATCH</span>}</div></header>}
    <main className={`site-main${isLiveGame ? ' site-main--live-game' : ''}`}><Routes><Route path="/" element={<Home />} /><Route path="/lobby" element={<LobbyPage />} /><Route path="/rooms/:roomId" element={<RoomPage />} /><Route path="/rules" element={<RulesPage />} /><Route path="/game/local" element={<GameBoardPage />} /><Route path="/game/:roomId" element={<MultiplayerGamePage />} /></Routes></main>
  </div>;
}

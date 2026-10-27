import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { GameBoardPage } from './pages/GameBoardPage';
import { LobbyPage } from './pages/LobbyPage';
import { MultiplayerGamePage } from './pages/MultiplayerGamePage';
import { RoomPage } from './pages/RoomPage';
import { RulesPage } from './pages/RulesPage';
import { TabletopDemoPage } from './pages/TabletopDemoPage';
import { themePreviewArtwork } from './components/cardArtwork';

function Home() {
  return <section className="welcome-page">
    <div className="welcome-page__copy">
      <span className="eyebrow">GEM ARENA · THE ORIGINAL GEM GAME</span>
      <div className="welcome-page__rule" aria-hidden="true"><span>◆</span></div>
      <h1>보석을 모아,<br /><em>전략을 완성하세요.</em></h1>
      <p>보석 상인의 도시에서 카드를 모으고 자원을 활용해 승점을 쌓으세요. 친구와 함께 한 판의 전략 대전을 즐길 수 있습니다.</p>
      <div className="welcome-page__actions">
        <Link className="primary-link" to="/lobby">온라인 대전 입장 <span aria-hidden="true">↗</span></Link>
        <Link className="welcome-page__secondary" to="/game/local">한 PC 대전 <span aria-hidden="true">→</span></Link>
      </div>
      <div className="welcome-page__details">
        <span><strong>02–04</strong> 플레이어</span>
        <span><strong>03:00</strong> 온라인 턴 제한</span>
      </div>
    </div>
    <div className="welcome-showcase" aria-label="게임 테마 미리보기">
      <div className="welcome-showcase__heading"><span>THE GEM ARENA</span><span>보석 상인의 도시</span></div>
      <div className="welcome-showcase__cards welcome-showcase__cards--single">
        <div className="welcome-showcase__card welcome-showcase__card--default">
          <img src={themePreviewArtwork('default')} alt="" />
          <span className="welcome-showcase__card-index">01</span>
          <div className="welcome-showcase__card-copy"><small>보석 상인의 도시</small><strong>기본 테마</strong></div>
        </div>
      </div>
      <div className="welcome-showcase__footer"><span>2~4명이 함께 플레이할 수 있습니다.</span></div>
    </div>
  </section>;
}

export default function App() {
  const { pathname } = useLocation();
  const isLiveGame = pathname.startsWith('/game/') && pathname !== '/game/local';
  return <div className="app-shell">
    {!isLiveGame && <header className="site-header"><div className="site-header__inner"><Link className="brand" to="/" aria-label="Gem Arena 홈"><span className="brand__mark" aria-hidden="true">◆</span><span>GEM <strong>ARENA</strong></span></Link><nav aria-label="주 메뉴"><NavLink to="/" end>홈</NavLink><NavLink to="/lobby">로비</NavLink><NavLink to="/rules">룰</NavLink><NavLink to="/game/local">한 PC 대전</NavLink></nav>{pathname === '/game/local' && <span className="site-header__tag">LOCAL MATCH</span>}</div></header>}
    <main className={`site-main${isLiveGame ? ' site-main--live-game' : ''}`}><Routes><Route path="/" element={<Home />} /><Route path="/lobby" element={<LobbyPage />} /><Route path="/rooms/:roomId" element={<RoomPage />} /><Route path="/rules" element={<RulesPage />} /><Route path="/examples/3d" element={<TabletopDemoPage />} /><Route path="/game/local" element={<GameBoardPage />} /><Route path="/game/:roomId" element={<MultiplayerGamePage />} /></Routes></main>
  </div>;
}

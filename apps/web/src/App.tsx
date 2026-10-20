import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { GameBoardPage } from './pages/GameBoardPage';
import { LobbyPage } from './pages/LobbyPage';
import { RoomPage } from './pages/RoomPage';
import { RulesPage } from './pages/RulesPage';

function Home() {
  return <section className="welcome-page"><span className="eyebrow">WELCOME TO GEM ARENA</span><h1>빛을 모아,<br /><em>전략을 완성하세요.</em></h1><p>친구들과 함께하는 보석 전략 게임. 익명으로 입장해 닉네임을 정하거나 게임판을 미리 둘러보세요.</p><div className="welcome-page__actions"><Link className="primary-link" to="/lobby">플레이어 입장 <span aria-hidden="true">↗</span></Link><Link className="text-link" to="/game/demo">게임판 미리보기</Link></div><div className="welcome-page__decoration" aria-hidden="true"><span /><span /><span /></div></section>;
}

export default function App() {
  return <div className="app-shell"><header className="site-header"><div className="site-header__inner"><Link className="brand" to="/" aria-label="Gem Arena 홈"><span className="brand__mark" aria-hidden="true">◆</span><span>GEM <strong>ARENA</strong></span></Link><nav aria-label="주 메뉴"><NavLink to="/" end>홈</NavLink><NavLink to="/lobby">로비</NavLink><NavLink to="/rules">룰</NavLink><NavLink to="/game/demo">게임판 미리보기</NavLink></nav><span className="site-header__tag">LOCAL PREVIEW</span></div></header><main className="site-main"><Routes><Route path="/" element={<Home />} /><Route path="/lobby" element={<LobbyPage />} /><Route path="/rooms/:roomId" element={<RoomPage />} /><Route path="/rules" element={<RulesPage />} /><Route path="/game/:roomId" element={<GameBoardPage />} /></Routes></main></div>;
}

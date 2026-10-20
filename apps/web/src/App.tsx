import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { GameBoardPage } from './pages/GameBoardPage';

function Home() {
  return <section className="welcome-page"><span className="eyebrow">WELCOME TO GEM ARENA</span><h1>빛을 모아,<br /><em>전략을 완성하세요.</em></h1><p>친구들과 함께하는 보석 전략 게임. 지금은 게임판의 화면 구성을 미리 볼 수 있습니다.</p><div className="welcome-page__actions"><Link className="primary-link" to="/game/demo">게임판 미리보기 <span aria-hidden="true">↗</span></Link><Link className="text-link" to="/lobby">로비 보기</Link></div><div className="welcome-page__decoration" aria-hidden="true"><span /><span /><span /></div></section>;
}

function Lobby() {
  return <section className="empty-page"><span className="eyebrow">LOBBY PREVIEW</span><h1>로비</h1><p>방 생성과 초대 코드는 20~21일차에 연결됩니다. 게임판 레이아웃을 먼저 확인해 보세요.</p><Link className="primary-link" to="/game/demo">게임판 미리보기</Link></section>;
}

export default function App() {
  return <div className="app-shell"><header className="site-header"><div className="site-header__inner"><Link className="brand" to="/" aria-label="Gem Arena 홈"><span className="brand__mark" aria-hidden="true">◆</span><span>GEM <strong>ARENA</strong></span></Link><nav aria-label="주 메뉴"><NavLink to="/" end>홈</NavLink><NavLink to="/lobby">로비</NavLink><NavLink to="/game/demo">게임판 미리보기</NavLink></nav><span className="site-header__tag">LOCAL PREVIEW</span></div></header><main className="site-main"><Routes><Route path="/" element={<Home />} /><Route path="/lobby" element={<Lobby />} /><Route path="/game/:roomId" element={<GameBoardPage />} /></Routes></main></div>;
}

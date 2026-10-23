import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { GameBoardPage } from './pages/GameBoardPage';
import { LobbyPage } from './pages/LobbyPage';
import { MultiplayerGamePage } from './pages/MultiplayerGamePage';
import { RoomPage } from './pages/RoomPage';
import { RulesPage } from './pages/RulesPage';
import blueNavigator from './assets/cards/merchant-blue-navigator.jpg';
import greenBotanist from './assets/cards/merchant-green-botanist.jpg';
import redRubyDealer from './assets/cards/merchant-red-ruby-dealer.jpg';

function Home() {
  return <section className="welcome-page">
    <div className="welcome-page__copy">
      <span className="eyebrow">GEM ARENA · STRATEGY CARD GAME</span>
      <div className="welcome-page__rule" aria-hidden="true"><span>◆</span></div>
      <h1>보석을 모으고,<br /><em>승리를 설계하세요.</em></h1>
      <p>카드를 모아 구매 비용을 낮추고, 귀족의 방문을 이끌어 내세요. 매 턴의 선택이 승부를 바꿉니다.</p>
      <div className="welcome-page__actions"><Link className="primary-link" to="/lobby">온라인 대전 입장 <span aria-hidden="true">↗</span></Link><Link className="welcome-page__secondary" to="/game/local">한 PC 대전 <span aria-hidden="true">→</span></Link></div>
      <div className="welcome-page__details"><span><strong>02—04</strong> 플레이어</span><span><strong>03:00</strong> 온라인 턴 제한</span><span><strong>15+</strong> 최종 라운드</span></div>
    </div>
    <div className="welcome-showcase" aria-label="보석 상인 카드 미리보기">
      <div className="welcome-showcase__heading"><span>THE MARKET</span><span>보석 상인의 거리</span></div>
      <div className="welcome-showcase__cards">
        <div className="welcome-showcase__card welcome-showcase__card--blue"><img src={blueNavigator} alt="항구의 파란 상인 카드" /><span className="welcome-showcase__card-number">2</span><span className="welcome-showcase__gem welcome-showcase__gem--blue" aria-label="파란 보석">◆</span></div>
        <div className="welcome-showcase__card welcome-showcase__card--green"><img src={greenBotanist} alt="정원의 초록 상인 카드" /><span className="welcome-showcase__card-number">3</span><span className="welcome-showcase__gem welcome-showcase__gem--green" aria-label="초록 보석">◆</span></div>
        <div className="welcome-showcase__card welcome-showcase__card--red"><img src={redRubyDealer} alt="시장의 붉은 상인 카드" /><span className="welcome-showcase__card-number">1</span><span className="welcome-showcase__gem welcome-showcase__gem--red" aria-label="빨간 보석">◆</span></div>
      </div>
      <div className="welcome-showcase__footer"><span>TAKE GEMS</span><i aria-hidden="true" /> <span>BUILD YOUR ENGINE</span><i aria-hidden="true" /> <span>WIN THE ARENA</span></div>
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

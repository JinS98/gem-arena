import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useGameUIStore } from './stores/gameUIStore';
function Home() { return <section><h2>친구와 함께 즐기는 전략 보드게임</h2><p>현재는 프로젝트 초기 뼈대입니다. 방 생성·대전 기능은 19~26일차에 구현합니다.</p><Link to="/lobby">로비 미리보기 →</Link></section> }
function Lobby() { return <section><h2>로비</h2><p>초대 코드와 준비 상태 UI는 추후 구현합니다.</p><Link to="/game/demo">게임판 미리보기</Link></section> }
function Game() { const { roomId } = useParams(); const selected = useGameUIStore(s=>s.selectedCardId); const select = useGameUIStore(s=>s.selectCard); return <section><h2>게임판 미리보기</h2><p>Room: {roomId}</p><p>게임 상태는 아직 서버와 연결되지 않았습니다.</p><button onClick={()=>select(selected ? null : 'preview-card')}>{selected ? '선택 해제' : '예시 카드 선택'}</button></section> }
export default function App() { return <main><header><h1>💎 Gem Arena</h1><nav><Link to="/">홈</Link> · <Link to="/lobby">로비</Link></nav></header><Routes><Route path="/" element={<Home/>}/><Route path="/lobby" element={<Lobby/>}/><Route path="/game/:roomId" element={<Game/>}/></Routes></main> }

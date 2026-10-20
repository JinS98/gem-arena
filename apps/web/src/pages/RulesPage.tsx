import { Link } from 'react-router-dom';
import { DEVELOPMENT_CARDS } from '@gem-arena/engine';
import { CardFace } from '../components/MarketCard';
import { GemIcon, gemNames } from '../components/GemIcon';

const regularGems = ['white', 'blue', 'green', 'red', 'black'] as const;
const topics = [
  ['setup', '목표와 준비'],
  ['turn', '한 턴의 흐름'],
  ['gems', '보석 받기'],
  ['cards', '카드 구매'],
  ['reserve', '카드 예약'],
  ['nobles', '귀족 방문'],
  ['finish', '종료와 승자'],
] as const;

export function RulesPage() {
  return (
    <div className="rules-page">
      <header className="rules-page__hero">
        <span className="eyebrow">GEM ARENA · HOW TO PLAY</span>
        <h1>게임 규칙</h1>
        <p>보석을 모아 개발 카드를 구매하고, 영구 할인을 쌓아 귀족을 맞이하세요. 한 턴에 기본 행동 하나를 선택합니다.</p>
        <Link className="rules-page__back" to="/game/demo">게임판으로 돌아가기 <span aria-hidden="true">↗</span></Link>
      </header>

      <nav className="rules-page__toc" aria-label="규칙 목차">
        {topics.map(([id, label]) => <a href={`#${id}`} key={id}>{label}</a>)}
      </nav>

      <div className="rules-page__grid">
        <section className="rules-section rules-section--wide" id="setup" aria-labelledby="rules-setup">
          <div className="rules-section__heading"><span>01</span><h2 id="rules-setup">목표와 준비</h2></div>
          <p>2~4명이 플레이합니다. 카드를 구매하거나 귀족을 방문해 점수를 얻고, 15점에 도달하면 최종 라운드가 시작됩니다.</p>
          <div className="rules-page__setup">
            <div><strong>개발 카드</strong><p>1·2·3단계 시장에 각각 4장씩 공개합니다. 단계 헤더는 차례로 초록·노랑·파랑입니다. 시장에서 카드가 빠지면 같은 단계 덱에서 한 장을 보충합니다.</p></div>
            <div><strong>귀족</strong><p>플레이어 수보다 한 명 많은 귀족이 공개됩니다. 방문 조건은 귀족 카드의 보석 아이콘으로 확인합니다.</p></div>
            <div><strong>은행</strong><p>일반 보석은 색마다 2인 4개, 3인 5개, 4인 7개로 시작합니다. 황금 보석은 인원과 관계없이 5개입니다.</p></div>
          </div>
        </section>

        <section className="rules-section rules-section--wide" id="turn" aria-labelledby="rules-turn">
          <div className="rules-section__heading"><span>02</span><h2 id="rules-turn">한 턴의 흐름</h2></div>
          <p>현재 플레이어는 아래 기본 행동 중 <strong>하나만</strong> 수행합니다.</p>
          <ol className="rules-page__actions">
            <li><strong>보석 받기</strong><span>은행에서 규칙에 맞게 보석을 가져옵니다.</span></li>
            <li><strong>카드 구매</strong><span>시장이나 내 예약 카드의 비용을 내고 구매합니다.</span></li>
            <li><strong>카드 예약</strong><span>시장 카드 또는 단계별 덱 맨 위 카드를 내 예약 목록으로 가져옵니다.</span></li>
          </ol>
          <p>행동 뒤 보석이 10개를 넘으면 초과분을 정확히 반환합니다. 이어 귀족 방문을 판정한 후 다음 플레이어로 넘어갑니다. 가능한 기본 행동이 하나도 없을 때만 패스할 수 있습니다.</p>
          <p><strong>로컬 게임 추가 규칙:</strong> 새 게임 안내에서 시작 버튼을 누르면 첫 번째 차례의 3분이 시작됩니다. 30초가 남으면 알림이 한 번 울립니다. 시간이 끝나면 필요한 보석 반환이나 귀족 선택을 자동으로 처리하고 다음 플레이어의 턴을 시작합니다. 제한 시간 안에 행동을 마쳤다면 획득 효과가 끝난 뒤 다음 플레이어의 턴과 새 3분이 자동으로 시작됩니다.</p>
        </section>

        <section className="rules-section" id="gems" aria-labelledby="rules-gems">
          <div className="rules-section__heading"><span>03</span><h2 id="rules-gems">보석 받기</h2></div>
          <div className="rules-page__gems">{regularGems.map((color) =>
            <span key={color}><GemIcon color={color} small />{gemNames[color]}</span>)}
            <span><GemIcon color="gold" small />황금</span>
          </div>
          <ul className="rules-page__list">
            <li>서로 다른 일반 보석 <strong>3색을 1개씩</strong> 받습니다. 은행에 남은 색이 1~2개라면 그 안에서 서로 다른 색을 최대 남은 색 수만큼 받을 수 있습니다.</li>
            <li>한 색을 <strong>2개</strong> 받으려면, 가져오기 전에 은행에 그 색 보석이 <strong>4개 이상</strong> 있어야 합니다.</li>
            <li>황금 보석은 보석 받기 행동으로 가져올 수 없습니다. 일반 보석과 황금을 합친 보유 한도는 <strong>10개</strong>입니다.</li>
          </ul>
        </section>

        <section className="rules-section" id="cards" aria-labelledby="rules-cards">
          <div className="rules-section__heading"><span>04</span><h2 id="rules-cards">카드 읽기와 구매</h2></div>
          <div className="rules-page__card-guide">
            <div className="rules-page__sample-card" aria-hidden="true"><CardFace card={DEVELOPMENT_CARDS[0]} /></div>
            <ol>
              <li><strong>왼쪽 위</strong> 구매 시 얻는 점수</li>
              <li><strong>오른쪽 위</strong> 구매 후 계속 적용되는 색상 할인 1개</li>
              <li><strong>왼쪽 아래</strong> 구매에 필요한 색별 보석</li>
            </ol>
          </div>
          <p>색마다 카드 비용에서 이미 구매한 카드의 같은 색 할인을 뺍니다. 할인은 보석을 받는 효과가 아니며, 비용은 0 아래로 내려가지 않습니다. 남은 비용은 해당 색 보석이나 황금 보석으로 정확히 냅니다. 황금 1개는 부족한 어느 색 1개든 대신할 수 있습니다.</p>
        </section>

        <section className="rules-section" id="reserve" aria-labelledby="rules-reserve">
          <div className="rules-section__heading"><span>05</span><h2 id="rules-reserve">카드 예약</h2></div>
          <ul className="rules-page__list">
            <li>시장에 공개된 카드를 누르거나, 단계 헤더의 <strong>덱 예약</strong>을 눌러 해당 단계 덱 맨 위 카드를 가져옵니다.</li>
            <li>예약 카드는 최대 <strong>3장</strong>까지 보관합니다. 은행에 황금 보석이 남아 있으면 예약할 때 1개를 받습니다.</li>
            <li>예약한 카드는 상단의 <strong>내 예약 카드</strong>에서 확인하고, 이후 자신의 턴에 비용을 내서 구매할 수 있습니다.</li>
          </ul>
        </section>

        <section className="rules-section" id="nobles" aria-labelledby="rules-nobles">
          <div className="rules-section__heading"><span>06</span><h2 id="rules-nobles">귀족 방문</h2></div>
          <ul className="rules-page__list">
            <li>귀족의 보석 아이콘은 필요한 <strong>구매 카드의 영구 할인 수</strong>입니다. 손에 든 보석과 예약 카드는 조건에 포함되지 않습니다.</li>
            <li>턴의 기본 행동과 필요한 반환이 끝나면 방문 가능한 귀족을 확인합니다. 한 명이면 자동으로 방문하고, 여러 명이면 <strong>한 명을 선택</strong>합니다.</li>
            <li>귀족은 한 턴에 한 명만 방문할 수 있으며, 방문하면 <strong>3점</strong>을 얻습니다.</li>
          </ul>
        </section>

        <section className="rules-section rules-section--wide" id="finish" aria-labelledby="rules-finish">
          <div className="rules-section__heading"><span>07</span><h2 id="rules-finish">종료와 승자</h2></div>
          <p>턴을 마쳤을 때 누군가 <strong>15점 이상</strong>이면 그 라운드의 남은 플레이어까지 차례를 진행합니다. 모든 플레이어가 같은 수의 턴을 마치면 게임이 종료됩니다.</p>
          <p>가장 점수가 높은 플레이어가 승리합니다. 점수가 같으면 <strong>구매한 개발 카드가 더 적은 플레이어</strong>가 승리하며, 카드 수까지 같으면 공동 승리입니다. 전원이 자산·점수 변화 없이 연속으로 패스해도 게임이 종료됩니다.</p>
        </section>
      </div>
    </div>
  );
}

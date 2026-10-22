import type { CardLevel } from '@gem-arena/engine';

export function DeckCard({ level, remaining, disabled, onReserve }: {
  level: CardLevel;
  remaining: number;
  disabled: boolean;
  onReserve: () => void;
}) {
  return <button type="button" className="market-deck" aria-label={`${level}단계 덱에서 카드 예약, 남은 카드 ${remaining}장`}
    disabled={disabled} onClick={onReserve}>
    <svg className="market-deck__art" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="182" height="282" rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity=".8" />
      <rect x="17" y="17" width="166" height="266" rx="5" fill="none" stroke="currentColor" opacity=".52" />
      <path d="M35 42h130M35 258h130M37 54v34m126-34v34M37 212v34m126-34v34" fill="none" stroke="currentColor" opacity=".48" />
      <path d="M100 74 158 150 100 226 42 150Z" fill="none" stroke="currentColor" strokeWidth="2" opacity=".72" />
      <path d="M100 90 144 150 100 210 56 150Z" fill="currentColor" opacity=".1" />
      <path d="M100 93 141 144 100 197 59 144Z" fill="none" stroke="currentColor" strokeWidth="2" opacity=".9" />
      <path d="m100 93-19 51 19 53 19-53-19-51ZM59 144h82M81 144l19-51 19 51-19 53-19-53Z" fill="none" stroke="currentColor" opacity=".75" />
      <path d="M100 29v25M89 41h22M100 246v25M89 259h22" fill="none" stroke="currentColor" opacity=".72" />
      <circle cx="100" cy="150" r="67" fill="none" stroke="currentColor" opacity=".22" />
    </svg>
    <span className="market-deck__level">LEVEL <strong>{level}</strong></span>
    <span className="market-deck__count">덱 {remaining}장</span>
    <span className="market-deck__action">예약하기</span>
  </button>;
}

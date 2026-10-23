import { themePreviewArtwork } from './cardArtwork';
import { GAME_THEMES, themeLabels, type GameTheme } from './GameTheme';

const descriptions: Record<GameTheme, string> = {
  default: '보석 상인의 도시',
  lol: '룬테라의 챔피언과 마법',
  'demon-slayer': '귀살대와 호흡의 전투',
};

export function ThemePicker({ theme, onChange, disabled = false }: {
  theme: GameTheme; onChange: (theme: GameTheme) => void; disabled?: boolean;
}) {
  return <fieldset className="theme-picker" disabled={disabled}>
    <legend>게임 테마</legend>
    <div className="theme-picker__options">
      {GAME_THEMES.map(option => <button key={option} type="button"
        className={`theme-picker__option theme-picker__option--${option}${theme === option ? ' is-selected' : ''}`}
        aria-pressed={theme === option} onClick={() => onChange(option)}>
        <img src={themePreviewArtwork(option)} alt="" loading="lazy" />
        <span className="theme-picker__copy"><strong>{themeLabels[option]}</strong><small>{descriptions[option]}</small></span>
        <span className="theme-picker__check" aria-hidden="true">{theme === option ? '✓' : '◇'}</span>
      </button>)}
    </div>
    <p className="theme-picker__note">그림과 자원 이름만 바뀌며 비용과 규칙은 같습니다. 두 추가 테마는 비공식 팬 테마입니다.</p>
  </fieldset>;
}

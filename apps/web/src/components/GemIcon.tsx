import type { Gem } from '@gem-arena/engine';
import { useGameTheme } from './GameTheme';

const themedIcons = import.meta.glob('../assets/gems/themes/*.png', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

export const gemNames: Record<Gem, string> = {
  white: '흰색', blue: '파란색', green: '초록색',
  red: '빨간색', black: '검은색', gold: '황금',
};

export function GemIcon({ color, small = false }: { color: Gem; small?: boolean }) {
  const theme = useGameTheme();
  const artwork = theme === 'default' ? undefined : themedIcons[`../assets/gems/themes/${theme}-${color}.png`];
  return <span className={`gem-icon gem-icon--${color} gem-icon--theme-${theme}${artwork ? ' gem-icon--illustrated' : ''}${small ? ' gem-icon--small' : ''}`}
    style={artwork ? { backgroundImage: `url(${artwork})` } : undefined} aria-hidden="true" />;
}

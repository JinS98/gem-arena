import type { Gem } from '@gem-arena/engine';
import { useGameTheme } from './GameTheme';

export const gemNames: Record<Gem, string> = {
  white: '흰색', blue: '파란색', green: '초록색',
  red: '빨간색', black: '검은색', gold: '황금',
};

export function GemIcon({ color, small = false }: { color: Gem; small?: boolean }) {
  const theme = useGameTheme();
  return <span className={`gem-icon gem-icon--${color} gem-icon--theme-${theme}${small ? ' gem-icon--small' : ''}`} aria-hidden="true" />;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { Gem } from '@gem-arena/engine';

export type GameTheme = 'default' | 'lol' | 'demon-slayer';
export const GAME_THEMES: readonly GameTheme[] = ['default', 'lol', 'demon-slayer'];

export const themeLabels: Record<GameTheme, string> = {
  default: '기본 테마',
  lol: '리그 오브 레전드',
  'demon-slayer': '귀멸의 칼날',
};

export const themeGemNames: Record<GameTheme, Record<Gem, string>> = {
  default: { white: '흰색 보석', blue: '파란색 보석', green: '초록색 보석', red: '빨간색 보석', black: '검은색 보석', gold: '황금 보석' },
  lol: { white: '천상의 파편', blue: '마법 수정', green: '자연의 정수', red: '화염의 정수', black: '공허의 결정', gold: '초월의 정수' },
  'demon-slayer': { white: '안개', blue: '물', green: '바람', red: '불', black: '혈귀', gold: '태양' },
};

export const themeGemShortNames: Record<GameTheme, Record<Gem, string>> = {
  default: { white: '흰색', blue: '파란색', green: '초록색', red: '빨간색', black: '검은색', gold: '황금' },
  lol: { white: '천상', blue: '마나', green: '자연', red: '화염', black: '공허', gold: '초월' },
  'demon-slayer': { white: '안개', blue: '물', green: '바람', red: '불', black: '혈귀', gold: '태양' },
};

const ThemeContext = createContext<GameTheme>('default');

export function GameThemeProvider({ theme, children }: { theme: GameTheme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useGameTheme(): GameTheme {
  return useContext(ThemeContext);
}

export function useGemNames(): Record<Gem, string> {
  return themeGemNames[useGameTheme()];
}

export function useGemShortNames(): Record<Gem, string> {
  return themeGemShortNames[useGameTheme()];
}

export function normalizeGameTheme(value: unknown): GameTheme {
  return GAME_THEMES.includes(value as GameTheme) ? value as GameTheme : 'default';
}

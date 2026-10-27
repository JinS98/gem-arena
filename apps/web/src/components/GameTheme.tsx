import { createContext, useContext, type ReactNode } from 'react';
import type { Gem } from '@gem-arena/engine';

export type GameTheme = 'default';
export const GAME_THEMES: readonly GameTheme[] = ['default'];

export const themeLabels: Record<GameTheme, string> = {
  default: '기본 테마',
};

export const themeGemNames: Record<GameTheme, Record<Gem, string>> = {
  default: { white: '흰색 보석', blue: '파란색 보석', green: '초록색 보석', red: '빨간색 보석', black: '검은색 보석', gold: '황금 보석' },
};

export const themeGemShortNames: Record<GameTheme, Record<Gem, string>> = {
  default: { white: '흰색', blue: '파란색', green: '초록색', red: '빨간색', black: '검은색', gold: '황금' },
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

export function normalizeGameTheme(_value: unknown): GameTheme {
  return 'default';
}

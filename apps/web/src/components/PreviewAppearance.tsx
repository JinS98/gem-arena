import { createContext, useContext, type ReactNode } from 'react';
import type { DevelopmentCard, Gem } from '@gem-arena/engine';

// Display-only overrides. This does not register a playable online theme.
export interface PreviewAppearance {
  names: Record<Gem, string>;
  icons: Record<Gem, string>;
  card: (card: DevelopmentCard) => { src: string; label: string };
  nobles: readonly { src: string; label: string }[];
}
const Context = createContext<PreviewAppearance | null>(null);
export function PreviewAppearanceProvider({ value, children }: { value: PreviewAppearance; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const usePreviewAppearance = () => useContext(Context);

import type { DevelopmentCard, GemColor } from '@gem-arena/engine';
import type { GameTheme } from './GameTheme';
import whiteBase from '../assets/cards/merchant-white.jpg';
import whiteJeweler from '../assets/cards/merchant-white-jeweler.jpg';
import whiteScholar from '../assets/cards/merchant-white-scholar.jpg';
import whiteDiplomat from '../assets/cards/merchant-white-diplomat.jpg';
import whiteSculptor from '../assets/cards/merchant-white-sculptor.jpg';
import whiteArchitect from '../assets/cards/merchant-white-architect.jpg';
import blueBase from '../assets/cards/merchant-blue.jpg';
import blueNavigator from '../assets/cards/merchant-blue-navigator.jpg';
import blueCartographer from '../assets/cards/merchant-blue-cartographer.jpg';
import blueHarborTrader from '../assets/cards/merchant-blue-harbor-trader.jpg';
import blueAstronomer from '../assets/cards/merchant-blue-astronomer.jpg';
import blueExplorer from '../assets/cards/merchant-blue-explorer.jpg';
import greenBase from '../assets/cards/merchant-green.jpg';
import greenApothecary from '../assets/cards/merchant-green-apothecary.jpg';
import greenBotanist from '../assets/cards/merchant-green-botanist.jpg';
import greenForestTrader from '../assets/cards/merchant-green-forest-trader.jpg';
import greenHerbMerchant from '../assets/cards/merchant-green-herb-merchant.jpg';
import greenGardenArchitect from '../assets/cards/merchant-green-garden-architect.jpg';
import redBase from '../assets/cards/merchant-red.jpg';
import redGlassblower from '../assets/cards/merchant-red-glassblower.jpg';
import redRubyDealer from '../assets/cards/merchant-red-ruby-dealer.jpg';
import redTextileDyer from '../assets/cards/merchant-red-textile-dyer.jpg';
import redMetalsmith from '../assets/cards/merchant-red-metalsmith.jpg';
import redFestivalMerchant from '../assets/cards/merchant-red-festival-merchant.jpg';
import blackBase from '../assets/cards/merchant-black.jpg';
import blackNightBroker from '../assets/cards/merchant-black-night-broker.jpg';
import blackAlchemist from '../assets/cards/merchant-black-alchemist.jpg';
import blackMineOverseer from '../assets/cards/merchant-black-mine-overseer.jpg';
import blackEngraver from '../assets/cards/merchant-black-engraver.jpg';
import blackTreasurer from '../assets/cards/merchant-black-treasurer.jpg';

const artwork: Record<GemColor, readonly string[]> = {
  white: [whiteBase, whiteJeweler, whiteScholar, whiteDiplomat, whiteSculptor, whiteArchitect],
  blue: [blueBase, blueNavigator, blueCartographer, blueHarborTrader, blueAstronomer, blueExplorer],
  green: [greenBase, greenApothecary, greenBotanist, greenForestTrader, greenHerbMerchant, greenGardenArchitect],
  red: [redBase, redGlassblower, redRubyDealer, redTextileDyer, redMetalsmith, redFestivalMerchant],
  black: [blackBase, blackNightBroker, blackAlchemist, blackMineOverseer, blackEngraver, blackTreasurer],
};

// The card ID remains the lookup key; theme artwork only changes the displayed image.
const themedArtwork = import.meta.glob('../assets/cards/themes/*/*.{jpg,png}', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

export function themePreviewArtwork(theme: GameTheme): string {
  if (theme === 'hidden') return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#111725"/><text x="100" y="130" text-anchor="middle" fill="#ddc18a" font-size="100">✧</text></svg>')}`;
  if (theme === 'lol') return themedArtwork['../assets/cards/themes/lol/L3-BLUE-01.jpg']
    ?? themedArtwork['../assets/cards/themes/lol/L1-WHITE-05.jpg'] ?? whiteBase;
  if (theme === 'demon-slayer') return themedArtwork['../assets/cards/themes/demon-slayer/L3-RED-01.jpg']
    ?? themedArtwork['../assets/cards/themes/demon-slayer/L1-WHITE-01.png'] ?? redBase;
  return blueNavigator;
}

const nobleThemeCardIds: Record<Exclude<GameTheme, 'default' | 'hidden'>, readonly string[]> = {
  lol: ['L3-WHITE-04', 'L3-BLUE-04', 'L3-GREEN-04', 'L3-RED-04', 'L1-BLACK-01'],
  'demon-slayer': ['L1-WHITE-04', 'L1-BLUE-01', 'L1-GREEN-02', 'L1-RED-01', 'L3-GREEN-04'],
};

export function nobleThemeArtwork(theme: GameTheme, index: number, fallback: string): string {
  if (theme === 'default' || theme === 'hidden') return fallback;
  const id = nobleThemeCardIds[theme][index % nobleThemeCardIds[theme].length];
  const stem = `../assets/cards/themes/${theme}/${id}`;
  return themedArtwork[`${stem}.jpg`] ?? themedArtwork[`${stem}.png`] ?? fallback;
}

export function developmentCardArtwork(card: DevelopmentCard, theme: GameTheme = 'default'): string {
  const images = artwork[card.bonusColor];
  const patternIndex = Number(card.id.slice(-2)) - 1;
  if (theme !== 'default') {
    const stem = `../assets/cards/themes/${theme}/${card.id}`;
    return themedArtwork[`${stem}.jpg`] ?? themedArtwork[`${stem}.png`]
      ?? images[(patternIndex + card.level - 1) % images.length];
  }
  return images[(patternIndex + card.level - 1) % images.length];
}

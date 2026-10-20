import type { DevelopmentCard, GemColor } from '@gem-arena/engine';
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

export function developmentCardArtwork(card: DevelopmentCard): string {
  const images = artwork[card.bonusColor];
  const patternIndex = Number(card.id.slice(-2)) - 1;
  return images[(patternIndex + card.level - 1) % images.length];
}

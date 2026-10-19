export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
export type Gem = GemColor | 'gold';
export type Inventory = Record<Gem, number>;
export type ColorCounts = Record<GemColor, number>;
export type CardLevel = 1 | 2 | 3;
export type GamePhase = 'waiting' | 'playing' | 'discarding' | 'choosingNoble' | 'finished';
export interface DevelopmentCard { id:string; level:CardLevel; bonusColor:GemColor; points:number; cost:ColorCounts }
export interface Noble { id:string; points:number; requirements:ColorCounts }
export interface PlayerState { uid:string; seatIndex:number; gems:Inventory; purchasedCardIds:string[]; reservedCardIds:string[]; score:number }
export interface ServerGameState { phase:GamePhase; version:number; turnIndex:number; playerOrder:string[]; players:Record<string,PlayerState>; bank:Inventory; market:Record<CardLevel,(string|null)[]>; decks:Record<CardLevel,string[]>; availableNobleIds:string[]; finalRoundTriggeredBy:string|null; winnerIds:string[] }
export type GameAction =
 | { type:'TAKE_GEMS'; colors:GemColor[] }
 | { type:'BUY_CARD'; cardId:string; source:'market'|'reserved'; payment:Inventory }
 | { type:'RESERVE_CARD'; cardId?:string; level?:CardLevel }
 | { type:'DISCARD_GEMS'; gems:Inventory }
 | { type:'CHOOSE_NOBLE'; nobleId:string }
 | { type:'PASS' };

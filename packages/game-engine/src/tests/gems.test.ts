import { describe, expect, it } from 'vitest';
import { canTakeGems, gemCount } from '../rules/gems';
import type { GemColor } from '../types/index';
const bank = {white:4, blue:2, green:1, red:0, black:3, gold:5};
describe('보석 획득 규칙',()=>{
 it('서로 다른 세 종류를 획득할 수 있다',()=>expect(canTakeGems(bank,['white','blue','green'])).toBe(true));
 it('세 종류 이상 남아 있으면 한두 종류만 받을 수 없다',()=>{
  expect(canTakeGems(bank,['white'])).toBe(false);
  expect(canTakeGems(bank,['white','blue'])).toBe(false);
 });
 it('남은 색이 두 종류 또는 한 종류뿐이면 한두 종류를 받는다',()=>{
  const twoColors = {...bank, green:0, black:0};
  const oneColor = {...twoColors, blue:0};
  expect(canTakeGems(twoColors,['white','blue'])).toBe(true);
  expect(canTakeGems(twoColors,['white'])).toBe(true);
  expect(canTakeGems(oneColor,['white'])).toBe(true);
 });
 it('은행에 없는 색상은 획득할 수 없다',()=>expect(canTakeGems(bank,['red'])).toBe(false));
 it('같은 색상 두 개는 은행에 4개 이상 있어야 한다',()=>{
  expect(canTakeGems({...bank, white:3},['white','white'])).toBe(false);
  expect(canTakeGems(bank,['white','white'])).toBe(true);
 });
 it('황금 보석을 일반 획득 행동으로 가져올 수 없다',()=>expect(canTakeGems(bank,['gold' as GemColor])).toBe(false));
 it('총 보유량을 계산한다',()=>expect(gemCount(bank)).toBe(15));
});

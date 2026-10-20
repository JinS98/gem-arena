import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nicknameError, normalizeNickname } from './nickname.ts';

test('닉네임은 앞뒤 공백을 제거해 2~16자로 검사한다', () => {
  assert.equal(normalizeNickname('  보석 장인  '), '보석 장인');
  assert.equal(nicknameError('  가  '), '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.');
  assert.equal(nicknameError('   '), '닉네임은 앞뒤 공백을 제외하고 2~16자로 입력해 주세요.');
  assert.equal(nicknameError('가나'), null);
  assert.equal(nicknameError('가'.repeat(16)), null);
  assert.ok(nicknameError('가'.repeat(17)));
  assert.equal(nicknameError('😀😀'), null);
});

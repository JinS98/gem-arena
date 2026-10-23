import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { DEVELOPMENT_CARDS } from '../../../packages/game-engine/dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const subjects = JSON.parse(readFileSync(join(root, 'docs/theme-card-map.json'), 'utf8'));
const characters = JSON.parse(readFileSync(join(root, 'docs/theme-character-map.json'), 'utf8'));
const colors = ['white', 'blue', 'green', 'red', 'black'];
const levels = { 1: 40, 2: 30, 3: 20 };

assert.equal(DEVELOPMENT_CARDS.length, 90);
for (const [level, count] of Object.entries(levels)) {
  assert.equal(DEVELOPMENT_CARDS.filter(card => card.level === Number(level)).length, count);
}

for (const theme of ['lol', 'demon-slayer']) {
  const directory = join(root, 'apps/web/src/assets/cards/themes', theme);
  const filenames = readdirSync(directory).sort();
  const expected = DEVELOPMENT_CARDS.map(card => `${card.id}.jpg`).sort();
  assert.deepEqual(filenames, expected, `${theme}: card images must match the engine catalog exactly`);
  const assigned = [];
  for (const card of DEVELOPMENT_CARDS) {
    const pattern = Number(card.id.slice(-2)) - 1;
    const candidates = subjects[theme]?.[card.level]?.[card.bonusColor];
    assert.equal(candidates?.length, { 1: 8, 2: 6, 3: 4 }[card.level], `${theme}: ${card.id} subject group`);
    const subject = candidates[pattern];
    assert.equal(typeof subject, 'string', `${theme}: ${card.id} subject`);
    assert.ok(subject.trim(), `${theme}: ${card.id} blank subject`);
    assigned.push(subject.toLowerCase());
  }
  assert.equal(new Set(assigned).size, 90, `${theme}: duplicate subjects`);
  for (const color of [...colors, 'gold']) {
    assert.ok(existsSync(join(root, 'apps/web/src/assets/gems/themes', `${theme}-${color}.png`)));
  }
  console.log(`${theme}: 90 card images, 90 distinct subjects, 6 resource icons`);
}

const demonSlayerAppearances = new Map();
for (const [id, character] of Object.entries(characters['demon-slayer'])) {
  const card = DEVELOPMENT_CARDS.find(candidate => candidate.id === id);
  assert.ok(card, `Unknown character card: ${id}`);
  const subject = subjects['demon-slayer'][card.level][card.bonusColor][Number(id.slice(-2)) - 1];
  assert.ok(subject.toLowerCase().includes(character.toLowerCase()), `${id}: character assignment differs from subject`);
  demonSlayerAppearances.set(character, (demonSlayerAppearances.get(character) ?? 0) + 1);
}
for (const [character, count] of demonSlayerAppearances) {
  assert.ok(count <= 2, `${character} appears on ${count} Demon Slayer cards`);
}
console.log(`demon-slayer: ${demonSlayerAppearances.size} named characters, at most 2 cards each`);

import test from 'node:test';
import assert from 'node:assert/strict';
import { NAMES, normalizeText, randomName } from '../src/messageRules.js';

test('message validation rejects empty, invalid and overly long text', () => {
  assert.equal(normalizeText('  Hello team  '), 'Hello team');
  assert.throws(() => normalizeText(' \n '), /enter a message/);
  assert.throws(() => normalizeText('x'.repeat(2001)), /2000/);
  assert.throws(() => normalizeText(42), /enter a message/);
  assert.equal(normalizeText('x'.repeat(2000)).length, 2000);
});

test('random sender is always one of the five required names', () => {
  assert.deepEqual(NAMES, ['Alan', 'Bob', 'Carol', 'Dean', 'Elin']);
  for (let i = 0; i < 1000; i++) assert.ok(NAMES.includes(randomName()));
});

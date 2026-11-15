import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from '../src/accountRules.js';

test('registration validates and normalizes account details', () => {
  const valid = { name: '  Ada Example ', location: 'Pune', age: '30', email: ' ADA@Example.com ', password: 'password123', confirmPassword: 'password123' };
  assert.equal(validateRegistration(valid).email, 'ada@example.com');
  assert.throws(() => validateRegistration({ ...valid, age: 12 }), /Age/);
  assert.throws(() => validateRegistration({ ...valid, age: 13.5 }), /Age/);
  assert.throws(() => validateRegistration({ ...valid, email: 'bad' }), /email/);
  assert.throws(() => validateRegistration(null), /account details/);
  assert.throws(() => validateRegistration({ ...valid, confirmPassword: 'different' }), /match/);
  assert.throws(() => validateRegistration({ ...valid, password: 'short' }), /Password/);
  assert.throws(() => validateRegistration({ ...valid, password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }), /72 bytes/);
});

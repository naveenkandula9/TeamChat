export const NAMES = ['Alan', 'Bob', 'Carol', 'Dean', 'Elin'];
export const MAX_MESSAGE_LENGTH = 2000;

export function normalizeText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Please enter a message.');
  if (value.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  return value.trim();
}

export function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

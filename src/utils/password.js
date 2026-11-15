import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

export const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(':');

  if (!salt || !hash) {
    return false;
  }

  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
};

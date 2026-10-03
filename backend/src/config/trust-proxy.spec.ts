import { resolveTrustProxy } from './trust-proxy';

describe('resolveTrustProxy', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['0', false],
    ['abc', false],
    ['-1', false],
    ['true', 1],
    [' TRUE ', 1],
    ['1', 1],
    ['2', 2],
  ])('%p -> %p', (raw, expected) => {
    expect(resolveTrustProxy(raw)).toBe(expected);
  });
});

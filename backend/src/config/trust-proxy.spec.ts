/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/require-await -- tests : mocks axios/supertest typés any */
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

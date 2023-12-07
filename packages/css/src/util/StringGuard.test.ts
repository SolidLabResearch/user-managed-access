import { isString } from './StringGuard';

describe('StringGuard', () => {
  it('should return true for a valid string', () => {
    expect(isString('abc')).toBe(true);
  });
  it('should return true for a valid String object', () => {
    expect(isString(String())).toBe(true);
  });
});

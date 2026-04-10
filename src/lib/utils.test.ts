import { describe, it, expect } from 'vitest';
import { cn, parseDateOnly, isExpiredOption } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });

  it('merges tailwind conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('parseDateOnly', () => {
  it('parses YYYY-MM-DD without timezone shift', () => {
    const date = parseDateOnly('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
  });

  it('sets time to midnight', () => {
    const date = parseDateOnly('2024-06-20');
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });
});

describe('isExpiredOption', () => {
  it('returns false for closed positions', () => {
    expect(isExpiredOption({ status: 'closed', trade_type: 'call', expiration_date: '2020-01-01' })).toBe(false);
  });

  it('returns false for stocks', () => {
    expect(isExpiredOption({ status: 'open', trade_type: 'stock', expiration_date: '2020-01-01' })).toBe(false);
  });

  it('returns false for options with no expiration', () => {
    expect(isExpiredOption({ status: 'open', trade_type: 'call', expiration_date: null })).toBe(false);
  });

  it('returns true for expired open options', () => {
    expect(isExpiredOption({ status: 'open', trade_type: 'call', expiration_date: '2020-01-01' })).toBe(true);
  });

  it('returns true for expired open puts', () => {
    expect(isExpiredOption({ status: 'open', trade_type: 'put', expiration_date: '2020-01-01' })).toBe(true);
  });

  it('returns false for future expiration', () => {
    expect(isExpiredOption({ status: 'open', trade_type: 'call', expiration_date: '2099-12-31' })).toBe(false);
  });
});

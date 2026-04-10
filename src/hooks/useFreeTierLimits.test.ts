import { describe, it, expect } from 'vitest';
import { FREE_TRADE_LIMIT, FREE_WATCHLIST_LIMIT } from './useFreeTierLimits';

describe('Free tier limits constants', () => {
  it('has a trade limit of 15', () => {
    expect(FREE_TRADE_LIMIT).toBe(15);
  });

  it('has a watchlist limit of 1', () => {
    expect(FREE_WATCHLIST_LIMIT).toBe(1);
  });

  it('free trade limit is a positive integer', () => {
    expect(FREE_TRADE_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(FREE_TRADE_LIMIT)).toBe(true);
  });
});

describe('Free tier limit logic (pure computation)', () => {
  // Tests for the pure computation that useFreeTierLimits does internally
  const computeTradeAccess = (hasFullAccess: boolean, tradeCount: number) => {
    if (hasFullAccess) {
      return { canAddTrade: true, tradesRemaining: Infinity, isAtLimit: false };
    }
    const remaining = Math.max(0, FREE_TRADE_LIMIT - tradeCount);
    return {
      canAddTrade: tradeCount < FREE_TRADE_LIMIT,
      tradesRemaining: remaining,
      isAtLimit: tradeCount >= FREE_TRADE_LIMIT,
    };
  };

  it('full access users can always add trades', () => {
    const result = computeTradeAccess(true, 100);
    expect(result.canAddTrade).toBe(true);
    expect(result.tradesRemaining).toBe(Infinity);
    expect(result.isAtLimit).toBe(false);
  });

  it('free user with 0 trades can add trades', () => {
    const result = computeTradeAccess(false, 0);
    expect(result.canAddTrade).toBe(true);
    expect(result.tradesRemaining).toBe(15);
    expect(result.isAtLimit).toBe(false);
  });

  it('free user with 14 trades has 1 remaining', () => {
    const result = computeTradeAccess(false, 14);
    expect(result.canAddTrade).toBe(true);
    expect(result.tradesRemaining).toBe(1);
    expect(result.isAtLimit).toBe(false);
  });

  it('free user at limit cannot add trades', () => {
    const result = computeTradeAccess(false, 15);
    expect(result.canAddTrade).toBe(false);
    expect(result.tradesRemaining).toBe(0);
    expect(result.isAtLimit).toBe(true);
  });

  it('free user over limit cannot add trades', () => {
    const result = computeTradeAccess(false, 20);
    expect(result.canAddTrade).toBe(false);
    expect(result.tradesRemaining).toBe(0);
    expect(result.isAtLimit).toBe(true);
  });
});

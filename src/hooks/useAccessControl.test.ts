import { describe, it, expect } from 'vitest';
import { computeHasFullAccess } from './useAccessControl';

describe('computeHasFullAccess', () => {
  it('grants access to owners', () => {
    expect(computeHasFullAccess('owner', 'free', false)).toBe(true);
  });

  it('grants access to admins', () => {
    expect(computeHasFullAccess('admin', 'free', false)).toBe(true);
  });

  it('grants access to monthly subscribers', () => {
    expect(computeHasFullAccess('user', 'monthly', false)).toBe(true);
  });

  it('grants access to lifetime subscribers', () => {
    expect(computeHasFullAccess('user', 'lifetime', false)).toBe(true);
  });

  it('grants access to comped users', () => {
    expect(computeHasFullAccess('user', 'free', true)).toBe(true);
  });

  it('denies access to free users without comped access', () => {
    expect(computeHasFullAccess('user', 'free', false)).toBe(false);
  });

  it('denies access to trial users without other qualifiers', () => {
    expect(computeHasFullAccess('user', 'trial', false)).toBe(false);
  });

  it('denies access to expired users', () => {
    expect(computeHasFullAccess('user', 'expired', false)).toBe(false);
  });

  it('grants access when multiple criteria met (admin + paid)', () => {
    expect(computeHasFullAccess('admin', 'monthly', true)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock import.meta.env before importing logger
describe('logger', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
    vi.resetModules();
  });

  it('should log in development mode', async () => {
    vi.stubEnv('DEV', 'true');
    // Re-import to pick up the env
    const { logger } = await import('./logger');

    logger.log('test message');
    logger.warn('test warning');
    logger.error('test error');

    expect(console.log).toHaveBeenCalledWith('test message');
    expect(console.warn).toHaveBeenCalledWith('test warning');
    expect(console.error).toHaveBeenCalledWith('test error');
  });

  it('should support multiple arguments', async () => {
    vi.stubEnv('DEV', 'true');
    const { logger } = await import('./logger');

    logger.log('message', { key: 'value' }, 42);
    expect(console.log).toHaveBeenCalledWith('message', { key: 'value' }, 42);
  });

  it('should have log, warn, and error methods', async () => {
    const { logger } = await import('./logger');
    expect(typeof logger.log).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});

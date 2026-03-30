import { jest } from '@jest/globals';
import { logger } from '../src/logger.js';

describe('logger', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('prefixes info logs with [Runway: info]', () => {
    logger.info('test message');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Runway: info]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('prefixes success logs with [Runway: success]', () => {
    logger.success('test message');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Runway: success]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('prefixes warn logs with [Runway: warn]', () => {
    logger.warn('test message');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Runway: warn]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('prefixes error logs with [Runway: error]', () => {
    logger.error('test message');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[Runway: error]'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('test message'));
  });

  it('prints the large ASCII header', () => {
    logger.printHeader('RUNWAY', '0.0.0');
    // Check for a characteristic line of the ASCII art
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('VMMMMP'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('v0.0.0'));
  });

  it('formats stepSuccess with timing in milliseconds', () => {
    logger.stepSuccess('001_migration.sql', 123);
    // Standard ASCII checkmarks are often rendered as tick symbols or just 'success' text
    // Based on src/logger.js: console.log(`  ${chalk.green('✔')} ${chalk.bold(name).padEnd(30)} ${chalk.gray(`${duration}ms`)}`);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('001_migration.sql'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123ms'));
  });

  it('formats suggestions with cyan color and prefix', () => {
    logger.suggest('runway migrate');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Next step:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('runway migrate'));
  });
});

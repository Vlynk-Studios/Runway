import { jest } from '@jest/globals';
import { create } from '../src/commands/create.js';
import fs from 'fs';
import { logger } from '../src/logger.js';
import path from 'path';

describe('create command logging and naming', () => {
  let mockWriteSync;
  
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockWriteSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['001_initial.sql']);
    
    // Mock the logger to catch what it outputs without logging to stdout
    jest.spyOn(logger, 'success').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'suggest').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('converts spaces to hyphens and lowercase characters', async () => {
    await create('ADD custom Roles Table');
    
    // Check that writeFileSync was called with formatted filenames
    const writeCalls = mockWriteSync.mock.calls;
    expect(writeCalls.length).toBe(2);
    
    // The previous max value was 001, so this should be 002
    expect(path.basename(writeCalls[0][0])).toBe('002_add-custom-roles-table.sql');
    expect(path.basename(writeCalls[1][0])).toBe('002_add-custom-roles-table.down.sql');
  });

  it('outputs the customized hyphen-based migration log', async () => {
    await create('Space to Hyphen Test');
    
    // create.js now calls logger.success 3 times: header + up path + down path
    const successCalls = logger.success.mock.calls;
    expect(successCalls.length).toBe(3);
    
    // First call is the header
    expect(successCalls[0][0]).toContain('Migration created:');
    // Second call is the .up.sql path
    expect(successCalls[1][0]).toContain('002_space-to-hyphen-test.sql');
    // Third call is the .down.sql path
    expect(successCalls[2][0]).toContain('002_space-to-hyphen-test.down.sql');
  });
});

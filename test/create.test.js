import { jest } from '@jest/globals';
import { create } from '../src/commands/create.js';
import fs from 'fs';
import { logger } from '../src/logger.js';
import path from 'path';

describe('create command logging and naming', () => {
  let mockExit;
  let mockWriteSync;
  let mockReadDirSync;
  let mockExistsSync;
  
  beforeEach(() => {
    jest.resetModules();
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockWriteSync = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    mockReadDirSync = jest.spyOn(fs, 'readdirSync').mockReturnValue(['001_initial.sql']);
    
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
    
    // Check the success message
    const successCalls = logger.success.mock.calls;
    expect(successCalls.length).toBe(1);
    
    // Matches the required format with "Migration creada "
    expect(successCalls[0][0]).toContain('Migration creada —');
    expect(successCalls[0][0]).toContain('002_space-to-hyphen-test.sql');
  });
});

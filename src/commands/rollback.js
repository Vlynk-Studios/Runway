import { logger } from '../logger.js';

/**
 * Reverts the last migration applied to the database.
 * // TODO: v0.2.0
 */
export async function rollback() {
  logger.warn('The "rollback" command is coming in version v0.2.0!');
  logger.info('Please visit our roadmap at https://github.com/vlynk-studios/runway for updates.');
}

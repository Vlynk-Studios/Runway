import { config, validateDatabaseConfig } from './src/config.js';
import { logger } from './src/logger.js';

logger.printHeader('CONFIG TEST');

console.log('Final Config:', JSON.stringify(config, null, 2));

try {
    validateDatabaseConfig();
    logger.success('Validation passed!');
} catch (error) {
    logger.error('Validation failed: ' + error.message);
}

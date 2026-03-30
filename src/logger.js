// Logger with ANSI colors (migrated from Vlynk)

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m' // Added gray/bright black
};

const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatMessage = (level, color, message) => {
  const timestamp = `${colors.dim}${getTimestamp()}${colors.reset}`;
  const label = `${color}${level.toUpperCase().padEnd(7)}${colors.reset}`;
  return `${timestamp} ${label} ${message}`;
};

export const logger = {
  info: (message) => console.log(formatMessage('info', colors.cyan, message)),
  warn: (message) => console.log(formatMessage('warn', colors.yellow, message)),
  error: (message) => console.error(formatMessage('error', colors.red, message)),
  success: (message) => console.log(formatMessage('success', colors.green, message)),

  printDivider: () => {
    console.log(`${colors.dim}${'-'.repeat(50)}${colors.reset}`);
  },

  printHeader: (name = 'RUNWAY', version = '') => {
    console.log('\n');
    console.log(`${colors.bright}${colors.magenta}${name}${version ? ' v' + version : ''}${colors.reset}`);
    logger.printDivider();
  }
};

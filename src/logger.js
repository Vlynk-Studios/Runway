import chalk from 'chalk';

/**
 * Professional logger with chalk colors and standardized formatting.
 */
export const logger = {
  info: (message) =>
    console.log(`${chalk.gray('[Runway: info]')}    ${message}`),
  warn: (message) =>
    console.log(`${chalk.yellow('[Runway: warn]')}    ${message}`),
  error: (message) =>
    console.error(`${chalk.red('[Runway: error]')}   ${message}`),
  success: (message) =>
    console.log(`${chalk.green('[Runway: success]')} ${message}`),

  /**
   * Displays a stylized success message with execution timing.
   */
  stepSuccess: (name, duration) => {
    const icon = chalk.green('[OK]');
    console.log(` ${icon} ${chalk.bold(name).padEnd(30)} ${chalk.gray(`${duration}ms`)}`);
  },

  /**
   * Suggests the next logical command to the user.
   */
  suggest: (command) => {
    console.log(
      `\nNext step:\n${chalk.cyan('>')} ${chalk.cyan.bold(command)}\n`,
    );
  },

  printDivider: () => {
    console.log(chalk.dim('-'.repeat(50)));
  },

  /**
   * Displays a compact header for regular command execution.
   */
  printMiniHeader: (version = '') => {
    console.log(chalk.bold.cyan('Runway') + chalk.gray(` v${version}\n`));
  },

  /**
   * Displays the high-impact ASCII header for entry points like init.
   */
  printHeader: (_name = 'RUNWAY', version = '') => {
    const asciiArt = chalk.cyan(`
    dMMMMb  dMP dMP dMMMMb  dMP dMP dMP .aMMMb  dMP dMP 
   dMP.dMP dMP dMP dMP dMP dMP dMP dMP dMP"dMP dMP.dMP  
  dMMMMK" dMP dMP dMP dMP dMP dMP dMP dMMMMMP  VMMMMP   
 dMP"AMF dMP.aMP dMP dMP dMP.dMP.dMP dMP dMP dA .dMP    
dMP dMP  VMMMP" dMP dMP  VMMMPVMMP" dMP dMP  VMMMP"     
    `);
    console.log(asciiArt);
    console.log(chalk.gray(`                             v${version}\n`));
  },
};

// Exporting colors for backward compatibility where needed, though chalk is preferred.
export const colors = {
  reset: '',
  bright: '',
  dim: '',
  cyan: (t) => chalk.cyan(t),
  yellow: (t) => chalk.yellow(t),
  red: (t) => chalk.red(t),
  green: (t) => chalk.green(t),
  magenta: (t) => chalk.magenta(t),
  gray: (t) => chalk.gray(t),
};

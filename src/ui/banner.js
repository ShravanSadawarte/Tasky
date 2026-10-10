import chalk from 'chalk';

function colorsEnabled(plain) {
  if (plain) return false;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  return true;
}

/** Compact Tasky wordmark. Printed only for help / interactive menu, not every command. */
export function printBanner({ plain = false } = {}) {
  if (plain || !colorsEnabled(false)) {
    console.log('TASKY — Your tasks. Your flow.');
    return;
  }
  const line = chalk.cyan('╭──────────────────────────────────────╮');
  const mid1 = `│  ${chalk.bold.cyan('T A S K Y')}                            │`;
  const mid2 = `│  ${chalk.gray('Your tasks. Your flow.')}              │`;
  const bot = chalk.cyan('╰──────────────────────────────────────╯');
  console.log(`${line}\n${mid1}\n${mid2}\n${bot}`);
}

export function success(msg, { plain = false } = {}) {
  const icon = supportsUnicode() ? '✓' : 'OK';
  if (plain || !colorsEnabled(false)) {
    console.log(`${icon} ${msg}`);
    return;
  }
  console.log(chalk.green(`${icon} ${msg}`));
}

export function warning(msg, { plain = false } = {}) {
  const icon = supportsUnicode() ? '!' : '!';
  if (plain || !colorsEnabled(false)) {
    console.log(`${icon} ${msg}`);
    return;
  }
  console.log(chalk.yellow(`${icon} ${msg}`));
}

export function failure(msg, { plain = false } = {}) {
  const icon = supportsUnicode() ? '✕' : 'X';
  if (plain || !colorsEnabled(false)) {
    console.error(`${icon} ${msg}`);
    return;
  }
  console.error(chalk.red(`${icon} ${msg}`));
}

export function hint(msg, { plain = false } = {}) {
  if (plain || !colorsEnabled(false)) {
    console.log(`  ${msg}`);
    return;
  }
  console.log(chalk.gray(`  ${msg}`));
}

export function supportsUnicode() {
  if (process.platform === 'win32') {
    // Modern Windows Terminal supports unicode; legacy conhost may not.
    // WT_SESSION is set inside Windows Terminal.
    if (process.env.WT_SESSION) return true;
    if (process.env.TERM === 'xterm-256color') return true;
    // Default to true on Windows 10+; fallback glyphs are still safe.
    return true;
  }
  return true;
}

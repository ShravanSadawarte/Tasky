import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { cmdAdd } from './commands/add.js';
import { cmdList } from './commands/list.js';
import { cmdDone, cmdUndo } from './commands/done.js';
import { cmdEdit, cmdDelete } from './commands/edit.js';
import { cmdSearch, cmdStats, cmdToday, cmdOverdue, cmdClearCompleted } from './commands/misc.js';
import { cmdExport, cmdImport } from './commands/transfer.js';
import { failure, hint } from './ui/banner.js';
import { runInteractiveMenu } from './ui/interactive-menu.js';

function getVersion() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(here, '..', 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const KNOWN = [
  'add', 'list', 'done', 'undo', 'edit', 'delete',
  'search', 'stats', 'today', 'overdue', 'clear-completed',
  'export', 'import', 'help',
];

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function suggest(input) {
  let best = null;
  let bestDist = Infinity;
  for (const cmd of KNOWN) {
    const d = editDistance(input, cmd);
    if (d < bestDist) {
      bestDist = d;
      best = cmd;
    }
  }
  return bestDist <= 3 ? best : null;
}

function isPlain() {
  return (
    process.argv.includes('--plain') ||
    (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '')
  );
}

/** Run a command handler with friendly error reporting. */
async function guard(fn) {
  try {
    await fn();
  } catch (err) {
    const plain = isPlain();
    failure(err.message ?? 'Something went wrong.', { plain });
    if (err.hint) hint(err.hint, { plain });
    else if (err.name === 'NotFoundError') hint('Run "tasky list" to see available IDs.', { plain });
    process.exitCode = err.exitCode ?? 1;
  }
}

export async function run(argv = process.argv) {
  const program = new Command();
  program
    .name('tasky')
    .description('Tasky — your tasks, your flow. A beautiful CLI task manager.')
    .version(getVersion(), '--version', 'Show Tasky version')
    .option('--plain', 'Plain output without colors or fancy tables (script-friendly)')
    .showHelpAfterError('(run "tasky --help" for usage)')
    .configureOutput({
      writeErr: (str) => process.stderr.write(str),
    });

  const plainOpt = () => ({ plain: program.opts().plain === true });

  program
    .command('add <title>')
    .description('Add a new task')
    .option('--priority <level>', 'Priority: low, medium, high (default: medium)')
    .option('--due <date>', 'Due date in YYYY-MM-DD format')
    .option('--tag <tag...>', 'Tags (repeatable or comma-separated)')
    .action((title, options) => guard(() => cmdAdd(title, options, plainOpt())));

  program
    .command('list')
    .description('List tasks (with optional filters)')
    .option('--status <status>', 'Filter by status: pending, completed')
    .option('--priority <level>', 'Filter by priority: low, medium, high')
    .option('--tag <tag>', 'Filter by tag')
    .option('--sort <field>', 'Sort by: id, due, created, priority, title (default: id)')
    .action((options) => guard(() => cmdList(options, plainOpt())));

  program
    .command('done <id>')
    .description('Mark a task as completed')
    .action((id) => guard(() => cmdDone(id, plainOpt())));

  program
    .command('undo <id>')
    .description('Reopen a completed task (back to pending)')
    .action((id) => guard(() => cmdUndo(id, plainOpt())));

  program
    .command('edit <id>')
    .description('Edit a task (interactive, or use flags)')
    .option('--title <title>', 'New title')
    .option('--priority <level>', 'New priority: low, medium, high')
    .option('--due <date>', 'New due date (YYYY-MM-DD)')
    .option('--clear-due', 'Clear the due date')
    .option('--tag <tag...>', 'Replace tags (repeatable or comma-separated)')
    .action((id, options) => guard(() => cmdEdit(id, options, plainOpt())));

  program
    .command('delete <id>')
    .description('Delete a task (asks for confirmation)')
    .option('--force', 'Delete without asking for confirmation')
    .action((id, options) => guard(() => cmdDelete(id, options, plainOpt())));

  program
    .command('search <query>')
    .description('Search tasks by title or tag')
    .action((query) => guard(() => cmdSearch(query, plainOpt())));

  program
    .command('stats')
    .description('Show task statistics')
    .action(() => guard(() => cmdStats(plainOpt())));

  program
    .command('today')
    .description('Show tasks due today')
    .action(() => guard(() => cmdToday(plainOpt())));

  program
    .command('overdue')
    .description('Show overdue tasks')
    .action(() => guard(() => cmdOverdue(plainOpt())));

  program
    .command('clear-completed')
    .description('Remove all completed tasks (asks for confirmation)')
    .option('--force', 'Remove without asking for confirmation')
    .action((options) => guard(() => cmdClearCompleted(options, plainOpt())));

  program
    .command('export <file>')
    .description('Export tasks to a JSON file')
    .action((file) => guard(() => cmdExport(file, plainOpt())));

  program
    .command('import <file>')
    .description('Import tasks from a JSON file (validates + skips duplicates)')
    .action((file) => guard(() => cmdImport(file, plainOpt())));

  program
    .command('help')
    .description('Show help')
    .action(() => program.outputHelp());

  program.addHelpText(
    'after',
    `
Examples:
  $ tasky add "Learn React"
  $ tasky add "Practice DSA" --priority high
  $ tasky add "Build portfolio" --due 2026-11-15
  $ tasky add "Study Node.js" --tag learning
  $ tasky list --status pending
  $ tasky search "React"
  $ tasky done 1
  $ tasky stats

Run "tasky <command> --help" for command-specific options.
Data is stored locally per user — no account, no network needed.`,
  );

  // Unknown command -> suggest the closest valid one.
  program.on('command:*', ([unknown]) => {
    const plain = isPlain();
    failure(`Unknown command "${unknown}".`, { plain });
    const s = suggest(unknown);
    if (s) hint(`Did you mean "tasky ${s}"?`, { plain });
    hint('Run "tasky --help" to see all commands.', { plain });
    process.exitCode = 1;
  });

  // No subcommand: interactive menu in a TTY, concise help otherwise.
  const noCommand = argv.slice(2).filter((a) => !a.startsWith('-')).length === 0;
  const hasHelpFlag = argv.includes('--help') || argv.includes('-h');
  const hasVersionFlag = argv.includes('--version') || argv.includes('-V');
  if (noCommand && !hasHelpFlag && !hasVersionFlag) {
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
    if (interactive) {
      try {
        await runInteractiveMenu(plainOpt());
      } catch (err) {
        failure(err.message ?? 'Interactive menu failed.', plainOpt());
        process.exitCode = 1;
      }
      return;
    }
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}

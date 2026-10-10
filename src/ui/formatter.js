import chalk from 'chalk';
import Table from 'cli-table3';
import { supportsUnicode } from './banner.js';

function useColor(plain) {
  if (plain) return false;
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') return false;
  return true;
}

function statusCell(task, color) {
  const uni = supportsUnicode();
  if (task.status === 'completed') {
    const label = uni ? '✓ Completed' : 'Done';
    return color ? chalk.green(label) : label;
  }
  const label = uni ? '○ Pending' : 'Pending';
  return color ? chalk.yellow(label) : label;
}

function priorityCell(priority, color) {
  if (!color) return priority;
  if (priority === 'high') return chalk.red(priority);
  if (priority === 'medium') return chalk.magenta(priority);
  return chalk.cyan(priority);
}

function idCell(id, color) {
  const s = String(id).padStart(2, '0');
  return color ? chalk.gray(s) : s;
}

/** Render tasks as an aligned table. Plain mode = simple tab text for scripts. */
export function formatTaskTable(tasks, { plain = false } = {}) {
  if (tasks.length === 0) return '';
  const color = useColor(plain);
  if (plain) {
    const lines = ['ID\tSTATUS\tPRIORITY\tDUE\tTAGS\tTITLE'];
    for (const t of tasks) {
      lines.push(
        `${t.id}\t${t.status}\t${t.priority}\t${t.due ?? '-'}\t${(t.tags ?? []).join(',') || '-'}\t${t.title}`,
      );
    }
    return lines.join('\n');
  }
  const table = new Table({
    head: [
      color ? chalk.bold('ID') : 'ID',
      color ? chalk.bold('STATUS') : 'STATUS',
      color ? chalk.bold('TASK') : 'TASK',
      color ? chalk.bold('PRIORITY') : 'PRIORITY',
      color ? chalk.bold('DUE') : 'DUE',
      color ? chalk.bold('TAGS') : 'TAGS',
    ],
    style: { head: [], border: [] },
    wordWrap: true,
    colWidths: [6, 14, 34, 10, 12, 20],
  });
  for (const t of tasks) {
    const title = t.status === 'completed' && color ? chalk.strikethrough.gray(t.title) : t.title;
    table.push([
      idCell(t.id, color),
      statusCell(t, color),
      title,
      priorityCell(t.priority, color),
      t.due ?? (color ? chalk.gray('-') : '-'),
      (t.tags ?? []).length ? (t.tags ?? []).join(', ') : color ? chalk.gray('-') : '-',
    ]);
  }
  return table.toString();
}

export function printTaskList(tasks, { plain = false } = {}) {
  if (tasks.length === 0) {
    if (plain) {
      console.log('No tasks found.');
    } else {
      console.log(chalk.gray('No tasks found.'));
      console.log(chalk.gray('  Get started: tasky add "Your first task"'));
    }
    return;
  }
  console.log(formatTaskTable(tasks, { plain }));
}

export function formatTaskDetail(task, { plain = false } = {}) {
  const color = useColor(plain);
  const paint = (label, value) => {
    if (!color) return `${label}: ${value}`;
    return `${chalk.gray(label + ':')} ${value}`;
  };
  return [
    paint('ID', task.id),
    paint('Title', task.title),
    paint('Status', task.status),
    paint('Priority', task.priority),
    paint('Due', task.due ?? '-'),
    paint('Tags', (task.tags ?? []).join(', ') || '-'),
  ].join('\n');
}

/** Compact stats block with a text progress bar. */
export function formatStats(stats, { plain = false } = {}) {
  const color = useColor(plain);
  const barWidth = 20;
  const filled = Math.round((stats.completionRate / 100) * barWidth);
  const uni = supportsUnicode() && !plain;
  const fullCh = uni ? '█' : '#';
  const emptyCh = uni ? '░' : '-';
  const bar = fullCh.repeat(filled) + emptyCh.repeat(barWidth - filled);
  const line = (label, value) => {
    if (!color) return `${label}: ${value}`;
    return `${chalk.gray(label.padEnd(12))} ${chalk.bold.white(String(value))}`;
  };
  const rows = [
    line('Total', stats.total),
    line('Completed', stats.completed),
    line('Pending', stats.pending),
    line('Overdue', stats.overdue),
    line('Due today', stats.dueToday),
    color
      ? `${chalk.gray('Progress'.padEnd(12))} ${chalk.green(bar)} ${chalk.bold(`${stats.completionRate}%`)}`
      : `Progress: [${bar}] ${stats.completionRate}%`,
  ];
  return rows.join('\n');
}

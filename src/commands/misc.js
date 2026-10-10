import { searchTasks, sortTasks, getStats, getTodayTasks, getOverdueTasks, clearCompleted } from '../services/task-service.js';
import { loadTasks, saveTasks } from '../storage/task-store.js';
import { success, warning } from '../ui/banner.js';
import { printTaskList, formatStats } from '../ui/formatter.js';
import { confirmOrExit } from '../ui/interactive-menu.js';

export function cmdSearch(query, { plain = false } = {}) {
  const q = String(query ?? '').trim();
  if (!q) {
    warning('Please provide a search term.', { plain });
    console.log('  Example: tasky search "React"');
    process.exitCode = 1;
    return;
  }
  const results = sortTasks(searchTasks(loadTasks(), q), 'id');
  if (results.length === 0) {
    warning(`No tasks match "${q}".`, { plain });
    return;
  }
  printTaskList(results, { plain });
}

export function cmdStats({ plain = false } = {}) {
  const tasks = loadTasks();
  const stats = getStats(tasks);
  if (tasks.length === 0) {
    console.log(formatStats(stats, { plain }));
    warning('No tasks yet — statistics will appear after you add some.', { plain });
    console.log('  Get started: tasky add "Your first task"');
    return;
  }
  console.log(formatStats(stats, { plain }));
}

export function cmdToday({ plain = false } = {}) {
  const tasks = getTodayTasks(loadTasks());
  if (tasks.length === 0) {
    warning('Nothing due today. Enjoy the calm.', { plain });
    return;
  }
  printTaskList(sortTasks(tasks, 'priority'), { plain });
}

export function cmdOverdue({ plain = false } = {}) {
  const tasks = getOverdueTasks(loadTasks());
  if (tasks.length === 0) {
    success('No overdue tasks. Nicely done.', { plain });
    return;
  }
  printTaskList(tasks, { plain });
}

export async function cmdClearCompleted(options, { plain = false } = {}) {
  const tasks = loadTasks();
  const count = tasks.filter((t) => t.status === 'completed').length;
  if (count === 0) {
    warning('No completed tasks to clear.', { plain });
    return;
  }
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!options.force) {
    if (!interactive) {
      warning(`Refusing to remove ${count} completed task(s) without confirmation.`, { plain });
      console.log('  Re-run with --force: tasky clear-completed --force');
      process.exitCode = 1;
      return;
    }
    const ok = await confirmOrExit(`Remove ${count} completed task(s)?`, { plain });
    if (!ok) {
      warning('Cancelled — nothing changed.', { plain });
      return;
    }
  }
  const { tasks: next, removed } = clearCompleted(tasks);
  saveTasks(next);
  success(`Removed ${removed} completed task(s).`, { plain });
}

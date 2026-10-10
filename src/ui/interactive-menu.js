import { confirm, input, select } from '@inquirer/prompts';
import { printBanner, success, warning } from './banner.js';
import { printTaskList, formatStats } from './formatter.js';
import {
  completeTask,
  createTask,
  getOverdueTasks,
  getStats,
  getTodayTasks,
  searchTasks,
  sortTasks,
} from '../services/task-service.js';
import { validateDue } from '../utils/validation.js';
import { getDataFile, loadTasks, saveTasks } from '../storage/task-store.js';

function isExitError(err) {
  return (
    err &&
    (err.name === 'ExitPromptError' ||
      err.name === 'AbortPromptError' ||
      err.message === 'User force closed the prompt with 0 null')
  );
}

export async function runInteractiveMenu({ plain = false } = {}) {
  printBanner({ plain });
  if (!plain) console.log('Welcome to Tasky. Pick an option below (Ctrl+C to exit).\n');

  for (;;) {
    let action;
    try {
      action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: 'Add a task', value: 'add' },
          { name: 'View all tasks', value: 'list' },
          { name: 'Complete a task', value: 'done' },
          { name: 'Search tasks', value: 'search' },
          { name: 'View statistics', value: 'stats' },
          { name: 'Settings / storage info', value: 'settings' },
          { name: 'Exit', value: 'exit' },
        ],
      });
    } catch (err) {
      if (isExitError(err)) {
        console.log(plain ? 'Goodbye!' : 'Goodbye! Your tasks are saved.');
        return;
      }
      throw err;
    }

    try {
      if (action === 'exit') {
        console.log(plain ? 'Goodbye!' : 'Goodbye! Your tasks are saved.');
        return;
      }
      if (action === 'add') await menuAdd({ plain });
      else if (action === 'list') menuList({ plain });
      else if (action === 'done') await menuDone({ plain });
      else if (action === 'search') await menuSearch({ plain });
      else if (action === 'stats') menuStats({ plain });
      else if (action === 'settings') menuSettings();
    } catch (err) {
      if (isExitError(err)) {
        console.log(plain ? 'Goodbye!' : 'Goodbye! Your tasks are saved.');
        return;
      }
      throw err;
    }
    if (!plain) console.log('');
  }
}

async function menuAdd({ plain }) {
  const title = await input({ message: 'Task title:' });
  if (!title.trim()) {
    warning('Title cannot be empty — task not created.', { plain });
    return;
  }
  const priority = await select({
    message: 'Priority:',
    choices: [
      { name: 'Low', value: 'low' },
      { name: 'Medium', value: 'medium' },
      { name: 'High', value: 'high' },
    ],
    default: 'medium',
  });
  const dueRaw = await input({ message: 'Due date (YYYY-MM-DD, blank for none):' });
  let due = null;
  if (dueRaw.trim()) {
    try {
      due = validateDue(dueRaw.trim());
    } catch (err) {
      warning(`${err.message} Task saved without a due date.`, { plain });
      due = null;
    }
  }
  const tagsRaw = await input({ message: 'Tags (comma-separated, blank for none):' });
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
  const tasks = loadTasks();
  const { task, tasks: next } = createTask(tasks, { title, priority, due, tags });
  saveTasks(next);
  success(`Task #${task.id} created: "${task.title}"`, { plain });
}

function menuList({ plain }) {
  const tasks = sortTasks(loadTasks(), 'id');
  printTaskList(tasks, { plain });
}

async function menuDone({ plain }) {
  const pending = sortTasks(loadTasks(), 'id').filter((t) => t.status === 'pending');
  if (pending.length === 0) {
    warning('No pending tasks. Add one with "tasky add".', { plain });
    return;
  }
  const id = await select({
    message: 'Which task did you complete?',
    choices: pending.map((t) => ({ name: `#${t.id} — ${t.title}`, value: t.id })),
  });
  const { tasks: next, already } = completeTask(loadTasks(), id);
  if (already) {
    warning(`Task #${id} is already completed.`, { plain });
    return;
  }
  saveTasks(next);
  success(`Task #${id} marked as completed.`, { plain });
}

async function menuSearch({ plain }) {
  const q = await input({ message: 'Search for:' });
  const results = searchTasks(loadTasks(), q);
  if (results.length === 0) {
    warning(`No tasks match "${q}".`, { plain });
    return;
  }
  printTaskList(sortTasks(results, 'id'), { plain });
}

function menuStats({ plain }) {
  const stats = getStats(loadTasks());
  console.log(formatStats(stats, { plain }));
}

function menuSettings() {
  const tasks = loadTasks();
  const today = getTodayTasks(tasks).length;
  const overdue = getOverdueTasks(tasks).length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  console.log(`Storage file : ${getDataFile()}`);
  console.log(`Total tasks  : ${tasks.length}`);
  console.log(`Completed    : ${completed}`);
  console.log(`Due today    : ${today}`);
  console.log(`Overdue      : ${overdue}`);
  console.log('Data stays on this machine. Delete the file above to reset Tasky.');
}

export async function confirmOrExit(message, { plain = false } = {}) {
  void plain;
  try {
    return await confirm({ message, default: false });
  } catch (err) {
    if (isExitError(err)) return false;
    throw err;
  }
}

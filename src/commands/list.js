import { filterTasks, sortTasks } from '../services/task-service.js';
import { loadTasks } from '../storage/task-store.js';
import { warning } from '../ui/banner.js';
import { printTaskList } from '../ui/formatter.js';
import { validatePriority, validateStatus } from '../utils/validation.js';

const SORT_FIELDS = ['id', 'due', 'created', 'priority', 'title'];

export function cmdList(options, { plain = false } = {}) {
  let status = null;
  let priority = null;
  if (options.status) status = validateStatus(options.status);
  if (options.priority) priority = validatePriority(options.priority);

  let sortBy = 'id';
  if (options.sort) {
    const s = String(options.sort).toLowerCase();
    if (!SORT_FIELDS.includes(s)) {
      throw new Error(
        `Invalid --sort "${options.sort}". Choose one of: ${SORT_FIELDS.join(', ')}.`,
      );
    }
    sortBy = s;
  }

  const tasks = loadTasks();
  const filtered = filterTasks(tasks, { status, priority, tag: options.tag ?? null });
  const sorted = sortTasks(filtered, sortBy);

  if (sorted.length === 0) {
    if (tasks.length === 0) {
      warning('No tasks yet. Add your first one:', { plain });
      console.log(plain ? '  tasky add "Learn React"' : '  tasky add "Learn React"');
    } else {
      warning('No tasks match these filters.', { plain });
      console.log('  Try "tasky list" to see everything.');
    }
    return;
  }
  printTaskList(sorted, { plain });
}

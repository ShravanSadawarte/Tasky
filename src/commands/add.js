import { createTask } from '../services/task-service.js';
import { loadTasks, saveTasks } from '../storage/task-store.js';
import { success, hint } from '../ui/banner.js';
import { formatTaskDetail } from '../ui/formatter.js';

export function cmdAdd(title, options, { plain = false } = {}) {
  const tasks = loadTasks();
  const { task, tasks: next } = createTask(tasks, {
    title,
    priority: options.priority ?? 'medium',
    due: options.due ?? null,
    tags: options.tag ?? [],
  });
  try {
    saveTasks(next);
  } catch (err) {
    console.error(`Cannot save task: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  success(`Task created successfully (ID: ${task.id})`, { plain });
  console.log(formatTaskDetail(task, { plain }));
  hint('Run "tasky list" to see all tasks.', { plain });
}

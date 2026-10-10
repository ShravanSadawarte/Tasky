import { completeTask, reopenTask } from '../services/task-service.js';
import { loadTasks, saveTasks } from '../storage/task-store.js';
import { success, warning } from '../ui/banner.js';
import { validateId } from '../utils/validation.js';

export function cmdDone(idRaw, { plain = false } = {}) {
  const id = validateId(idRaw);
  const { tasks: next, already } = completeTask(loadTasks(), id);
  if (already) {
    warning(`Task #${id} is already completed.`, { plain });
    return;
  }
  saveTasks(next);
  success(`Task #${id} marked as completed.`, { plain });
}

export function cmdUndo(idRaw, { plain = false } = {}) {
  const id = validateId(idRaw);
  const { tasks: next, already } = reopenTask(loadTasks(), id);
  if (already) {
    warning(`Task #${id} is already pending.`, { plain });
    return;
  }
  saveTasks(next);
  success(`Task #${id} reopened (back to pending).`, { plain });
}

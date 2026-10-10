import { input, select } from '@inquirer/prompts';
import { deleteTask, getTaskById, updateTask } from '../services/task-service.js';
import { loadTasks, saveTasks } from '../storage/task-store.js';
import { failure, success, warning } from '../ui/banner.js';
import { formatTaskDetail } from '../ui/formatter.js';
import { validateId } from '../utils/validation.js';
import { confirmOrExit } from '../ui/interactive-menu.js';

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function cmdEdit(idRaw, options, { plain = false } = {}) {
  const id = validateId(idRaw);
  const tasks = loadTasks();
  const existing = getTaskById(tasks, id);
  if (!existing) {
    failure(`No task found with ID ${id}.`, { plain });
    console.log('  Run "tasky list" to see available IDs.');
    process.exitCode = 1;
    return;
  }

  // Non-interactive flag-driven edit: --title / --priority / --due / --tag / --clear-due
  const hasFlags =
    options.title !== undefined ||
    options.priority !== undefined ||
    options.due !== undefined ||
    options.tag !== undefined ||
    options.clearDue === true;
  if (hasFlags) {
    const updates = {};
    if (options.title !== undefined) updates.title = options.title;
    if (options.priority !== undefined) updates.priority = options.priority;
    if (options.clearDue === true) updates.due = null;
    else if (options.due !== undefined) updates.due = options.due;
    if (options.tag !== undefined) updates.tags = options.tag;
    const { task, tasks: next } = updateTask(tasks, id, updates);
    saveTasks(next);
    success(`Task #${id} updated.`, { plain });
    console.log(formatTaskDetail(task, { plain }));
    return;
  }

  if (!isInteractive()) {
    failure('Edit needs an interactive terminal (or use flags).', { plain });
    console.log('  Example: tasky edit 1 --title "New title" --priority high');
    console.log('  Example: tasky edit 1 --clear-due');
    process.exitCode = 1;
    return;
  }

  const field = await select({
    message: `Editing #${id} "${existing.title}". What to change?`,
    choices: [
      { name: `Title (current: ${existing.title})`, value: 'title' },
      { name: `Priority (current: ${existing.priority})`, value: 'priority' },
      { name: `Due date (current: ${existing.due ?? 'none'})`, value: 'due' },
      { name: `Tags (current: ${(existing.tags ?? []).join(', ') || 'none'})`, value: 'tags' },
      { name: 'Cancel', value: 'cancel' },
    ],
  });
  if (field === 'cancel') {
    warning('Edit cancelled — nothing changed.', { plain });
    return;
  }
  if (field === 'title') {
    const title = await input({ message: 'New title (blank = keep current):' });
    if (!title.trim()) {
      warning('Title unchanged.', { plain });
      return;
    }
    const { task, tasks: next } = updateTask(tasks, id, { title });
    saveTasks(next);
    success(`Task #${id} updated.`, { plain });
    console.log(formatTaskDetail(task, { plain }));
  } else if (field === 'priority') {
    const priority = await select({
      message: 'New priority:',
      choices: [
        { name: 'Low', value: 'low' },
        { name: 'Medium', value: 'medium' },
        { name: 'High', value: 'high' },
      ],
      default: existing.priority,
    });
    const { task, tasks: next } = updateTask(tasks, id, { priority });
    saveTasks(next);
    success(`Task #${id} updated.`, { plain });
    console.log(formatTaskDetail(task, { plain }));
  } else if (field === 'due') {
    const dueRaw = await input({
      message: 'New due date YYYY-MM-DD (blank = keep, "none" = clear):',
    });
    if (!dueRaw.trim()) {
      warning('Due date unchanged.', { plain });
      return;
    }
    const due = dueRaw.trim().toLowerCase() === 'none' ? null : dueRaw.trim();
    const { task, tasks: next } = updateTask(tasks, id, { due });
    saveTasks(next);
    success(`Task #${id} updated.`, { plain });
    console.log(formatTaskDetail(task, { plain }));
  } else if (field === 'tags') {
    const tagsRaw = await input({
      message: 'New tags, comma-separated (blank = keep, "none" = clear):',
    });
    if (!tagsRaw.trim()) {
      warning('Tags unchanged.', { plain });
      return;
    }
    const tags = tagsRaw.trim().toLowerCase() === 'none' ? [] : tagsRaw.split(',');
    const { task, tasks: next } = updateTask(tasks, id, { tags });
    saveTasks(next);
    success(`Task #${id} updated.`, { plain });
    console.log(formatTaskDetail(task, { plain }));
  }
}

export async function cmdDelete(idRaw, options, { plain = false } = {}) {
  const id = validateId(idRaw);
  const tasks = loadTasks();
  const existing = getTaskById(tasks, id);
  if (!existing) {
    failure(`No task found with ID ${id}.`, { plain });
    console.log('  Run "tasky list" to see available IDs.');
    process.exitCode = 1;
    return;
  }
  if (!options.force) {
    if (!isInteractive()) {
      failure(`Refusing to delete task #${id} without confirmation.`, { plain });
      console.log('  Re-run with --force for non-interactive deletion:');
      console.log(`  tasky delete ${id} --force`);
      process.exitCode = 1;
      return;
    }
    const ok = await confirmOrExit(`Delete task #${id} "${existing.title}"?`, { plain });
    if (!ok) {
      warning('Deletion cancelled — nothing changed.', { plain });
      return;
    }
  }
  const { tasks: next } = deleteTask(tasks, id);
  saveTasks(next);
  success(`Task #${id} deleted.`, { plain });
}

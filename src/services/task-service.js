import {
  parseTags,
  todayString,
  validateDue,
  validatePriority,
  validateTitle,
} from '../utils/validation.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function getNextId(tasks) {
  let max = 0;
  for (const t of tasks) {
    if (Number.isInteger(t.id) && t.id > max) max = t.id;
  }
  return max + 1;
}

export function getTaskById(tasks, id) {
  return tasks.find((t) => t.id === id) ?? null;
}

function nowIso() {
  return new Date().toISOString();
}

export function createTask(tasks, { title, priority = 'medium', due = null, tags = [] }) {
  const cleanTitle = validateTitle(title);
  const cleanPriority = validatePriority(priority);
  const cleanDue = validateDue(due);
  const cleanTags = parseTags(tags);
  const task = {
    id: getNextId(tasks),
    title: cleanTitle,
    status: 'pending',
    priority: cleanPriority,
    due: cleanDue,
    tags: cleanTags,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
  };
  return { tasks: [...tasks, task], task };
}

export function filterTasks(
  tasks,
  { status = null, priority = null, tag = null } = {},
) {
  let out = [...tasks];
  if (status) out = out.filter((t) => t.status === status);
  if (priority) out = out.filter((t) => t.priority === priority);
  if (tag) {
    const needle = String(tag).toLowerCase();
    out = out.filter((t) => (t.tags ?? []).some((x) => x.toLowerCase() === needle));
  }
  return out;
}

export function sortTasks(tasks, sortBy = 'id') {
  const out = [...tasks];
  switch (sortBy) {
    case 'due':
      out.sort((a, b) => {
        const da = a.due ?? '9999-12-31';
        const db = b.due ?? '9999-12-31';
        if (da !== db) return da < db ? -1 : 1;
        return a.id - b.id;
      });
      break;
    case 'created':
      out.sort((a, b) => {
        const ca = a.createdAt ?? '';
        const cb = b.createdAt ?? '';
        if (ca !== cb) return ca < cb ? -1 : 1;
        return a.id - b.id;
      });
      break;
    case 'priority':
      out.sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority] ?? 9;
        const pb = PRIORITY_RANK[b.priority] ?? 9;
        if (pa !== pb) return pa - pb;
        return a.id - b.id;
      });
      break;
    case 'title':
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'id':
    default:
      out.sort((a, b) => a.id - b.id);
      break;
  }
  return out;
}

export function searchTasks(tasks, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
  );
}

export function completeTask(tasks, id) {
  const task = getTaskById(tasks, id);
  if (!task) {
    throw new NotFoundError(
      `No task found with ID ${id}.`,
      'Run "tasky list" to see available IDs.',
    );
  }
  if (task.status === 'completed') return { tasks, task, already: true };
  const stamp = nowIso();
  const next = tasks.map((t) =>
    t.id === id
      ? { ...t, status: 'completed', completedAt: stamp, updatedAt: stamp }
      : t,
  );
  return { tasks: next, task: { ...task, status: 'completed' }, already: false };
}

export function reopenTask(tasks, id) {
  const task = getTaskById(tasks, id);
  if (!task) {
    throw new NotFoundError(
      `No task found with ID ${id}.`,
      'Run "tasky list" to see available IDs.',
    );
  }
  if (task.status === 'pending') return { tasks, task, already: true };
  const stamp = nowIso();
  const next = tasks.map((t) =>
    t.id === id
      ? { ...t, status: 'pending', completedAt: null, updatedAt: stamp }
      : t,
  );
  return { tasks: next, task: { ...task, status: 'pending' }, already: false };
}

export function updateTask(tasks, id, updates = {}) {
  const task = getTaskById(tasks, id);
  if (!task) {
    throw new NotFoundError(
      `No task found with ID ${id}.`,
      'Run "tasky list" to see available IDs.',
    );
  }
  const next = { ...task };
  if (updates.title !== undefined) next.title = validateTitle(updates.title);
  if (updates.priority !== undefined) next.priority = validatePriority(updates.priority);
  if (updates.due !== undefined) {
    // null clears the due date; undefined means "leave unchanged"
    // (handled by the check above).
    next.due = updates.due === null ? null : validateDue(updates.due);
  }
  if (updates.tags !== undefined) next.tags = parseTags(updates.tags);
  if (updates.status !== undefined) {
    if (updates.status !== 'pending' && updates.status !== 'completed') {
      throw new ValidationError('Status must be "pending" or "completed".');
    }
    next.status = updates.status;
    next.completedAt = updates.status === 'completed' ? nowIso() : null;
  }
  next.updatedAt = nowIso();
  const out = tasks.map((t) => (t.id === id ? next : t));
  return { tasks: out, task: next };
}

export function deleteTask(tasks, id) {
  const task = getTaskById(tasks, id);
  if (!task) {
    throw new NotFoundError(
      `No task found with ID ${id}.`,
      'Run "tasky list" to see available IDs.',
    );
  }
  return { tasks: tasks.filter((t) => t.id !== id), task };
}

export function isOverdue(task, today = todayString()) {
  return task.status === 'pending' && task.due !== null && task.due !== undefined && task.due < today;
}

export function getStats(tasks, today = todayString()) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const pending = total - completed;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const dueToday = tasks.filter(
    (t) => t.status === 'pending' && t.due === today,
  ).length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  const byPriority = {
    high: tasks.filter((t) => t.priority === 'high' && t.status === 'pending').length,
    medium: tasks.filter((t) => t.priority === 'medium' && t.status === 'pending').length,
    low: tasks.filter((t) => t.priority === 'low' && t.status === 'pending').length,
  };
  return { total, completed, pending, overdue, dueToday, completionRate, byPriority };
}

export function getTodayTasks(tasks, today = todayString()) {
  return tasks.filter((t) => t.status === 'pending' && t.due === today);
}

export function getOverdueTasks(tasks, today = todayString()) {
  return tasks.filter((t) => isOverdue(t, today)).sort((a, b) => {
    if (a.due !== b.due) return a.due < b.due ? -1 : 1;
    return a.id - b.id;
  });
}

export function clearCompleted(tasks) {
  const remaining = tasks.filter((t) => t.status !== 'completed');
  return { tasks: remaining, removed: tasks.length - remaining.length };
}

/**
 * Validate + merge imported tasks.
 * - Accepts an array of records ({title, status?, priority?, due?, tags?}).
 * - Invalid records are skipped (counted), never crash the import.
 * - Duplicate handling: same id AND same title+due -> skip as duplicate;
 *   colliding id with different content -> assign a fresh id.
 */
export function importTasks(existing, imported) {
  if (!Array.isArray(imported)) {
    throw new ValidationError(
      'Import file must contain a JSON array of tasks.',
      'Example file: [{ "title": "Learn React" }]',
    );
  }
  let tasks = [...existing];
  let added = 0;
  let skipped = 0;
  const seen = new Set(tasks.map((t) => `${t.id}|${t.title}|${t.due ?? ''}`));

  for (const rec of imported) {
    try {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
        skipped += 1;
        continue;
      }
      const title = validateTitle(rec.title);
      const priority = rec.priority === undefined ? 'medium' : validatePriority(rec.priority);
      const due = rec.due === undefined ? null : validateDue(rec.due);
      const tags = rec.tags === undefined ? [] : parseTags(rec.tags);
      const status =
        rec.status === undefined
          ? 'pending'
          : (() => {
              const s = String(rec.status).toLowerCase();
              if (s !== 'pending' && s !== 'completed') {
                throw new ValidationError(`Invalid status "${rec.status}".`);
              }
              return s;
            })();

      let id = Number.isInteger(rec.id) && rec.id > 0 ? rec.id : getNextId(tasks);
      const key = `${id}|${title}|${due ?? ''}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      if (tasks.some((t) => t.id === id)) {
        id = getNextId(tasks); // id collision with different content -> reassign
      }
      const stamp = nowIso();
      tasks.push({
        id,
        title,
        status,
        priority,
        due,
        tags,
        createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : stamp,
        updatedAt: stamp,
        completedAt: status === 'completed' ? stamp : null,
      });
      seen.add(`${id}|${title}|${due ?? ''}`);
      added += 1;
    } catch {
      skipped += 1;
    }
  }
  tasks.sort((a, b) => a.id - b.id);
  return { tasks, added, skipped };
}

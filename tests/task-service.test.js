import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  completeTask,
  reopenTask,
  updateTask,
  deleteTask,
  filterTasks,
  sortTasks,
  searchTasks,
  getStats,
  getTodayTasks,
  getOverdueTasks,
  clearCompleted,
  importTasks,
  getNextId,
} from '../src/services/task-service.js';
import {
  validateTitle,
  validatePriority,
  validateDue,
  validateId,
  parseTags,
  isValidRecord,
} from '../src/utils/validation.js';

describe('validation', () => {
  test('rejects empty titles', () => {
    assert.throws(() => validateTitle(''), /empty/);
    assert.throws(() => validateTitle('   '), /empty/);
  });

  test('trims titles and enforces max length', () => {
    assert.equal(validateTitle('  Learn React  '), 'Learn React');
    assert.throws(() => validateTitle('x'.repeat(201)), /too long/);
  });

  test('accepts low/medium/high priorities case-insensitively', () => {
    assert.equal(validatePriority('HIGH'), 'high');
    assert.equal(validatePriority('Low'), 'low');
    assert.equal(validatePriority(), 'medium');
    assert.throws(() => validatePriority('urgent'), /Invalid priority/);
  });

  test('validates due dates strictly (YYYY-MM-DD, real calendar days)', () => {
    assert.equal(validateDue('2026-11-15'), '2026-11-15');
    assert.equal(validateDue(null), null);
    assert.equal(validateDue(''), null);
    assert.throws(() => validateDue('15-11-2026'), /YYYY-MM-DD/);
    assert.throws(() => validateDue('2026-02-30'), /has 28 days/);
    assert.throws(() => validateDue('2026-13-01'), /Month/);
    assert.throws(() => validateDue('not-a-date'), /YYYY-MM-DD/);
  });

  test('parses tags from arrays and comma-separated strings', () => {
    assert.deepEqual(parseTags(['a', 'b,c']), ['a', 'b', 'c']);
    assert.deepEqual(parseTags('  learning  '), ['learning']);
    assert.deepEqual(parseTags(undefined), []);
    assert.throws(() => parseTags('bad tag!'), /Invalid tag/);
  });

  test('validates numeric IDs', () => {
    assert.equal(validateId('3'), 3);
    assert.equal(validateId(1), 1);
    assert.throws(() => validateId('0'), /Invalid task ID/);
    assert.throws(() => validateId('-2'), /Invalid task ID/);
    assert.throws(() => validateId('abc'), /Invalid task ID/);
    assert.throws(() => validateId('1.5'), /Invalid task ID/);
  });

  test('isValidRecord detects malformed storage rows', () => {
    assert.equal(isValidRecord({ id: 1, title: 'x', status: 'pending', priority: 'low' }), true);
    assert.equal(isValidRecord(null), false);
    assert.equal(isValidRecord({ id: 0, title: 'x' }), false);
    assert.equal(isValidRecord({ id: 1, title: '  ' }), false);
    assert.equal(isValidRecord({ id: 1, title: 'x', status: 'done' }), false);
    assert.equal(isValidRecord({ id: 1, title: 'x', status: 'pending', priority: 'urgent' }), false);
    assert.equal(isValidRecord({ id: 1, title: 'x', status: 'pending', priority: 'low', due: '2026-02-30' }), false);
  });
});

describe('task-service CRUD', () => {
  test('createTask assigns stable incremental IDs and defaults', () => {
    let tasks = [];
    let r = createTask(tasks, { title: 'Learn React' });
    assert.equal(r.task.id, 1);
    assert.equal(r.task.status, 'pending');
    assert.equal(r.task.priority, 'medium');
    assert.equal(r.task.due, null);
    assert.deepEqual(r.task.tags, []);
    tasks = r.tasks;
    r = createTask(tasks, { title: 'Second', priority: 'high', due: '2026-11-15', tags: ['dev'] });
    assert.equal(r.task.id, 2);
    assert.equal(r.task.priority, 'high');
    assert.equal(r.task.due, '2026-11-15');
    assert.deepEqual(r.task.tags, ['dev']);
  });

  test('IDs are never reused after deletion', () => {
    let tasks = [];
    tasks = createTask(tasks, { title: 'a' }).tasks;
    tasks = createTask(tasks, { title: 'b' }).tasks;
    tasks = deleteTask(tasks, 1).tasks;
    const { task } = createTask(tasks, { title: 'c' });
    assert.equal(task.id, 3);
  });

  test('complete + reopen only touch the target task', () => {
    let tasks = [];
    tasks = createTask(tasks, { title: 'a' }).tasks;
    tasks = createTask(tasks, { title: 'b' }).tasks;
    const done = completeTask(tasks, 1);
    assert.equal(done.already, false);
    tasks = done.tasks;
    assert.equal(tasks.find((t) => t.id === 1).status, 'completed');
    assert.equal(tasks.find((t) => t.id === 2).status, 'pending');
    // completing again reports already:true without changes
    assert.equal(completeTask(tasks, 1).already, true);
    const undone = reopenTask(tasks, 1);
    assert.equal(undone.task.status, 'pending');
    assert.equal(reopenTask(undone.tasks, 1).already, true);
  });

  test('complete/reopen/delete throw for unknown IDs', () => {
    assert.throws(() => completeTask([], 42), /No task found with ID 42/);
    assert.throws(() => reopenTask([], 42), /No task found/);
    assert.throws(() => deleteTask([], 42), /No task found/);
  });

  test('updateTask keeps IDs stable and supports clearing due dates', () => {
    let tasks = createTask([], { title: 'a', due: '2026-11-15' }).tasks;
    let r = updateTask(tasks, 1, { title: 'b', priority: 'high' });
    assert.equal(r.task.id, 1);
    assert.equal(r.task.title, 'b');
    assert.equal(r.task.priority, 'high');
    assert.equal(r.task.due, '2026-11-15'); // untouched
    r = updateTask(r.tasks, 1, { due: null });
    assert.equal(r.task.due, null);
    assert.throws(() => updateTask(r.tasks, 1, { due: 'bogus' }), /YYYY-MM-DD/);
    assert.throws(() => updateTask(r.tasks, 1, { title: '' }), /empty/);
  });

  test('getNextId handles gaps and empty lists', () => {
    assert.equal(getNextId([]), 1);
    assert.equal(getNextId([{ id: 5 }, { id: 2 }]), 6);
  });
});

describe('filtering, sorting, searching, stats', () => {
  const seed = () => {
    let tasks = [];
    tasks = createTask(tasks, { title: 'Learn React', priority: 'high', due: '2026-11-15', tags: ['learning'] }).tasks;
    tasks = createTask(tasks, { title: 'Practice DSA', priority: 'low' }).tasks;
    tasks = createTask(tasks, { title: 'Build portfolio', priority: 'medium', due: '2020-01-01' }).tasks;
    tasks = completeTask(tasks, 2).tasks;
    return tasks;
  };

  test('filterTasks by status/priority/tag', () => {
    const tasks = seed();
    assert.equal(filterTasks(tasks, { status: 'completed' }).length, 1);
    assert.equal(filterTasks(tasks, { status: 'pending' }).length, 2);
    assert.equal(filterTasks(tasks, { priority: 'high' }).length, 1);
    assert.equal(filterTasks(tasks, { tag: 'LEARNING' }).length, 1);
    assert.equal(filterTasks(tasks, { tag: 'nope' }).length, 0);
  });

  test('sortTasks by due puts undated tasks last', () => {
    const tasks = seed();
    const sorted = sortTasks(tasks, 'due');
    assert.deepEqual(sorted.map((t) => t.id), [3, 1, 2]);
    assert.deepEqual(sortTasks(tasks, 'priority').map((t) => t.id), [1, 3, 2]);
  });

  test('searchTasks matches titles and tags case-insensitively', () => {
    const tasks = seed();
    assert.equal(searchTasks(tasks, 'react').length, 1);
    assert.equal(searchTasks(tasks, 'LEARNING').length, 1);
    assert.equal(searchTasks(tasks, 'zzz').length, 0);
    assert.deepEqual(searchTasks(tasks, '  '), []);
  });

  test('getStats avoids misleading numbers when empty', () => {
    assert.deepEqual(getStats([], '2026-10-10'), {
      total: 0, completed: 0, pending: 0, overdue: 0,
      dueToday: 0, completionRate: 0,
      byPriority: { high: 0, medium: 0, low: 0 },
    });
    const s = getStats(seed(), '2026-10-10');
    assert.equal(s.total, 3);
    assert.equal(s.completed, 1);
    assert.equal(s.pending, 2);
    assert.equal(s.overdue, 1); // Build portfolio due 2020-01-01
    assert.equal(s.completionRate, 33);
  });

  test('today + overdue helpers respect the reference date', () => {
    const tasks = seed();
    assert.equal(getTodayTasks(tasks, '2026-11-15').length, 1);
    assert.equal(getTodayTasks(tasks, '2030-01-01').length, 0);
    assert.equal(getOverdueTasks(tasks, '2026-10-10').length, 1);
    assert.equal(getOverdueTasks(tasks, '2019-01-01').length, 0);
  });

  test('clearCompleted removes only completed tasks', () => {
    const tasks = seed();
    const { tasks: next, removed } = clearCompleted(tasks);
    assert.equal(removed, 1);
    assert.ok(next.every((t) => t.status === 'pending'));
  });

  test('importTasks validates rows and reassigns colliding IDs', () => {
    const existing = createTask([], { title: 'Keep me' }).tasks;
    const { tasks, added, skipped } = importTasks(existing, [
      { title: 'Imported', priority: 'high', due: '2026-12-01', tags: ['x'] },
      { title: '  ' }, // invalid -> skipped
      null, // invalid -> skipped
      { id: 1, title: 'Different title' }, // id collision -> fresh id
      { id: 1, title: 'Keep me', due: null }, // exact duplicate -> skipped
      { title: 'Bad date', due: '2026-02-30' }, // invalid -> skipped
    ]);
    assert.equal(added, 2);
    assert.equal(skipped, 4);
    const ids = tasks.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length); // no duplicate IDs
    assert.throws(() => importTasks([], { not: 'an array' }), /JSON array/);
  });
});

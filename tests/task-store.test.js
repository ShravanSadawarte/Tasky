import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadTasks, saveTasks, getDataFile } from '../src/storage/task-store.js';

let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasky-test-'));
  process.env.TASKY_DATA_DIR = dir;
});

afterEach(() => {
  delete process.env.TASKY_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('task-store persistence', () => {
  test('starts empty when no data file exists', () => {
    assert.deepEqual(loadTasks(), []);
  });

  test('round-trips tasks through save/load', () => {
    const tasks = [{ id: 1, title: 'hi', status: 'pending', priority: 'low', due: null, tags: [] }];
    saveTasks(tasks);
    assert.ok(fs.existsSync(getDataFile()));
    assert.deepEqual(loadTasks(), tasks);
  });

  test('empty file loads as empty list', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getDataFile(), '', 'utf8');
    assert.deepEqual(loadTasks(), []);
  });

  test('malformed JSON is backed up, not thrown, and returns []', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tasks.json'), '{not json', 'utf8');
    assert.deepEqual(loadTasks(), []);
    const files = fs.readdirSync(dir);
    assert.ok(files.some((f) => f.includes('.corrupt-')), `expected backup file, got: ${files}`);
  });

  test('non-array JSON is treated as corrupt', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tasks.json'), '{"a":1}', 'utf8');
    assert.deepEqual(loadTasks(), []);
  });

  test('invalid records are skipped, valid ones preserved', () => {
    fs.mkdirSync(dir, { recursive: true });
    const good = { id: 1, title: 'good', status: 'pending', priority: 'medium', due: null, tags: [] };
    fs.writeFileSync(
      path.join(dir, 'tasks.json'),
      JSON.stringify([good, { id: -1, title: '' }, null, 'junk']),
      'utf8',
    );
    assert.deepEqual(loadTasks(), [good]);
  });

  test('no temp files leak after save', () => {
    saveTasks([{ id: 1, title: 'a', status: 'pending', priority: 'low', due: null, tags: [] }]);
    const files = fs.readdirSync(dir);
    assert.deepEqual(files, ['tasks.json']);
  });
});

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');
const CLI = path.join(ROOT, 'bin', 'tasky.js');

let dir;

function cli(args, extraEnv = {}) {
  const env = { ...process.env, TASKY_DATA_DIR: dir, NO_COLOR: '1', ...extraEnv };
  const r = spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout + r.stderr).trim() };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasky-cli-test-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('CLI end-to-end (isolated storage, non-interactive)', () => {
  test('--help and --version exit 0 with useful output', () => {
    const h = cli(['--help']);
    assert.equal(h.status, 0);
    assert.match(h.out, /tasky add "Learn React"/);
    const v = cli(['--version']);
    assert.equal(v.status, 0);
    assert.match(v.out.trim(), /^\d+\.\d+\.\d+/);
  });

  test('add -> list -> done -> undo -> delete --force lifecycle', () => {
    assert.equal(cli(['--plain', 'add', 'Learn React']).status, 0);
    assert.equal(cli(['--plain', 'add', 'Practice DSA', '--priority', 'high']).status, 0);

    const list = cli(['--plain', 'list']);
    assert.equal(list.status, 0);
    assert.match(list.out, /Learn React/);
    assert.match(list.out, /Practice DSA/);

    // data persists across independent executions (same dir, new process)
    const done = cli(['--plain', 'done', '1']);
    assert.equal(done.status, 0);
    assert.match(done.out, /completed/);

    const undo = cli(['--plain', 'undo', '1']);
    assert.equal(undo.status, 0);
    assert.match(undo.out, /reopened/);

    const del = cli(['--plain', 'delete', '2', '--force']);
    assert.equal(del.status, 0);
    const after = cli(['--plain', 'list']);
    assert.doesNotMatch(after.out, /Practice DSA/);
    assert.match(after.out, /Learn React/);
  });

  test('validation errors exit non-zero: bad date, bad id, missing args', () => {
    assert.notEqual(cli(['--plain', 'add', 'x', '--due', '2026-02-30']).status, 0);
    cli(['--plain', 'add', 'real task']);
    assert.notEqual(cli(['--plain', 'done', '999']).status, 0);
    assert.notEqual(cli(['--plain', 'done', 'abc']).status, 0);
    assert.notEqual(cli(['--plain', 'list', '--status', 'bogus']).status, 0);
    assert.notEqual(cli(['--plain', 'add', 'x', '--priority', 'urgent']).status, 0);
  });

  test('delete without --force refuses in non-interactive mode', () => {
    cli(['--plain', 'add', 'do not lose me']);
    const r = cli(['--plain', 'delete', '1']);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /--force/);
    // task still there
    assert.match(cli(['--plain', 'list']).out, /do not lose me/);
  });

  test('edit flags work non-interactively', () => {
    cli(['--plain', 'add', 'old title']);
    const r = cli(['--plain', 'edit', '1', '--title', 'new title', '--priority', 'high']);
    assert.equal(r.status, 0);
    const list = cli(['--plain', 'list']);
    assert.match(list.out, /new title/);
    assert.doesNotMatch(list.out, /old title/);
  });

  test('search, filters, sort and stats', () => {
    cli(['--plain', 'add', 'Learn React', '--tag', 'learning']);
    cli(['--plain', 'add', 'Practice DSA', '--priority', 'high']);
    cli(['--plain', 'done', '2']);
    assert.match(cli(['--plain', 'search', 'react']).out, /Learn React/);
    assert.match(cli(['--plain', 'list', '--status', 'completed']).out, /Practice DSA/);
    assert.match(cli(['--plain', 'list', '--priority', 'high']).out, /Practice DSA/);
    const stats = cli(['--plain', 'stats']);
    assert.equal(stats.status, 0);
    assert.match(stats.out, /Total: 2/);
    assert.match(stats.out, /Completed: 1/);
    assert.match(stats.out, /50%/);
  });

  test('empty list is graceful with next-step guidance', () => {
    const r = cli(['--plain', 'list']);
    assert.equal(r.status, 0);
    assert.match(r.out, /No tasks yet/);
  });

  test('unknown command suggests alternatives and exits non-zero', () => {
    const r = cli(['--plain', 'lis']);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /Did you mean/);
  });

  test('export -> clear-completed -> import round-trip', () => {
    cli(['--plain', 'add', 'keep']);
    cli(['--plain', 'add', 'finish me']);
    cli(['--plain', 'done', '2']);
    const file = path.join(dir, 'backup.json');
    assert.equal(cli(['--plain', 'export', file]).status, 0);
    assert.ok(fs.existsSync(file));
    assert.equal(cli(['--plain', 'clear-completed', '--force']).status, 0);
    assert.doesNotMatch(cli(['--plain', 'list']).out, /finish me/);
    const imp = cli(['--plain', 'import', file]);
    assert.equal(imp.status, 0);
    assert.match(imp.out, /Imported 1/); // 'keep' is a duplicate -> skipped
    const list = cli(['--plain', 'list']);
    assert.match(list.out, /keep/);
    assert.match(list.out, /finish me/);
  });

  test('import rejects missing files and invalid JSON', () => {
    assert.notEqual(cli(['--plain', 'import', path.join(dir, 'nope.json')]).status, 0);
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '{oops', 'utf8');
    assert.notEqual(cli(['--plain', 'import', bad]).status, 0);
  });

  test('non-interactive launch without command shows help (no hanging prompts)', () => {
    const r = cli([]);
    assert.equal(r.status, 0);
    assert.match(r.out, /Usage: tasky/);
  });
});

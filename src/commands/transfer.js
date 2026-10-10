import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { importTasks } from '../services/task-service.js';
import { loadTasks, saveTasks } from '../storage/task-store.js';
import { failure, success, warning } from '../ui/banner.js';

function spinnerEnabled(plain) {
  if (plain) return false;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY);
}

export function cmdExport(file, { plain = false } = {}) {
  if (!file) {
    failure('Please provide a file path.', { plain });
    console.log('  Example: tasky export ./tasks-backup.json');
    process.exitCode = 1;
    return;
  }
  const tasks = loadTasks();
  const target = path.resolve(file);
  const spin = spinnerEnabled(plain) ? ora(`Exporting ${tasks.length} task(s)...`).start() : null;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(tasks, null, 2) + '\n', 'utf8');
    if (spin) spin.succeed(`Exported ${tasks.length} task(s) to ${target}`);
    else success(`Exported ${tasks.length} task(s) to ${target}`, { plain });
  } catch (err) {
    if (spin) spin.fail('Export failed');
    failure(`Export failed: ${err.message}`, { plain });
    process.exitCode = 1;
  }
}

export function cmdImport(file, { plain = false } = {}) {
  if (!file) {
    failure('Please provide a file path.', { plain });
    console.log('  Example: tasky import ./tasks-backup.json');
    process.exitCode = 1;
    return;
  }
  const target = path.resolve(file);
  if (!fs.existsSync(target)) {
    failure(`Import file not found: ${target}`, { plain });
    process.exitCode = 1;
    return;
  }
  const spin = spinnerEnabled(plain) ? ora('Importing tasks...').start() : null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    if (spin) spin.fail('Import failed');
    failure(`Import file is not valid JSON: ${err.message}`, { plain });
    process.exitCode = 1;
    return;
  }
  try {
    const existing = loadTasks();
    const { tasks: next, added, skipped } = importTasks(existing, parsed);
    saveTasks(next);
    if (spin) spin.succeed(`Imported ${added} task(s), skipped ${skipped}.`);
    else success(`Imported ${added} task(s), skipped ${skipped}.`, { plain });
    if (skipped > 0) {
      warning(`${skipped} record(s) were skipped (duplicates or invalid).`, { plain });
    }
  } catch (err) {
    if (spin) spin.fail('Import failed');
    failure(`Import failed: ${err.message}`, { plain });
    if (err.hint) console.log(`  ${err.hint}`);
    process.exitCode = 1;
  }
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Per-user persistent storage for Tasky.
 *
 * Location (never the current working directory):
 *   - TASKY_DATA_DIR env var (used by tests / power users), or
 *   - Windows: %APPDATA%\\tasky-cli\\tasks.json
 *   - macOS/Linux: $XDG_CONFIG_HOME/tasky-cli/tasks.json
 *     (defaults to ~/.config/tasky-cli/tasks.json)
 *
 * Format: JSON array of task records, written atomically
 * (temp file + rename) to avoid corrupting user data.
 */

export function getDataDir() {
  const override = process.env.TASKY_DATA_DIR;
  if (override && override.trim()) return path.resolve(override.trim());
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(base, 'tasky-cli');
  }
  const base =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'tasky-cli');
}

export function getDataFile() {
  return path.join(getDataDir(), 'tasks.json');
}

export function ensureDataDir() {
  fs.mkdirSync(getDataDir(), { recursive: true });
}

/**
 * Load tasks from disk.
 * - Missing file  -> []
 * - Empty file    -> []
 * - Malformed JSON / wrong shape -> back up the corrupt file, return []
 * - Invalid records are skipped (valid ones preserved).
 *
 * Never throws for corrupt data; throws only for unrecoverable I/O errors.
 */
export function loadTasks() {
  const file = getDataFile();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    const e = new Error(`Cannot read task data: ${err.message}`);
    e.code = err.code;
    throw e;
  }
  if (!raw.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorruptFile(file);
    return [];
  }
  if (!Array.isArray(parsed)) {
    backupCorruptFile(file);
    return [];
  }
  // Keep valid records; drop garbage rather than crashing.
  return parsed.filter((rec) => isRecordValid(rec));
}

function isRecordValid(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  if (!Number.isInteger(rec.id) || rec.id <= 0) return false;
  if (typeof rec.title !== 'string' || !rec.title.trim()) return false;
  if (rec.title.length > 200) return false;
  if (rec.status !== 'pending' && rec.status !== 'completed') return false;
  if (rec.priority !== 'low' && rec.priority !== 'medium' && rec.priority !== 'high')
    return false;
  if (rec.due !== null && rec.due !== undefined) {
    if (typeof rec.due !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.due)) return false;
    const [y, m, d] = rec.due.split('-').map(Number);
    if (m < 1 || m > 12) return false;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < 1 || d > dim) return false;
  }
  if (rec.tags !== undefined && !Array.isArray(rec.tags)) return false;
  return true;
}

function backupCorruptFile(file) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = `${file}.corrupt-${stamp}.json`;
    fs.copyFileSync(file, backup);
  } catch {
    // Best effort; original data is left untouched if backup fails.
  }
}

/**
 * Save tasks atomically: write to a temp file in the same directory,
 * fsync, then rename over the target. Same-dir rename is atomic on
 * Windows/macOS/Linux and prevents half-written files.
 */
export function saveTasks(tasks) {
  ensureDataDir();
  const file = getDataFile();
  const dir = path.dirname(file);
  const tmp = path.join(
    dir,
    `.tasks.${process.pid}.${Date.now()}.tmp`,
  );
  const data = JSON.stringify(tasks, null, 2) + '\n';
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    try {
      const fd = fs.openSync(tmp, 'r');
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // fsync is best-effort on some platforms.
    }
    fs.renameSync(tmp, file);
  } catch (err) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      // ignore cleanup errors
    }
    const e = new Error(
      `Cannot save task data to ${file}: ${err.message}`,
    );
    e.code = err.code;
    throw e;
  }
}

import { ValidationError } from './errors.js';

export const PRIORITIES = ['low', 'medium', 'high'];
export const STATUSES = ['pending', 'completed'];

const DUE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Normalize + validate a task title. */
export function validateTitle(raw) {
  const title = String(raw ?? '').trim();
  if (!title) {
    throw new ValidationError(
      'Task title cannot be empty.',
      'Example: tasky add "Learn React"',
    );
  }
  if (title.length > 200) {
    throw new ValidationError('Task title is too long (max 200 characters).');
  }
  return title;
}

/** Normalize priority (case-insensitive), defaulting to medium. */
export function validatePriority(raw = 'medium') {
  const p = String(raw ?? 'medium').trim().toLowerCase();
  if (!PRIORITIES.includes(p)) {
    throw new ValidationError(
      `Invalid priority "${raw}". Choose one of: low, medium, high.`,
      'Example: tasky add "Write report" --priority high',
    );
  }
  return p;
}

/** Validate status filter. */
export function validateStatus(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!STATUSES.includes(s)) {
    throw new ValidationError(
      `Invalid status "${raw}". Choose one of: pending, completed.`,
      'Example: tasky list --status pending',
    );
  }
  return s;
}

/**
 * Validate a due date string in YYYY-MM-DD format.
 * Returns the normalized string, or null when input is null/undefined/''.
 * Rejects impossible dates like 2026-02-30.
 */
export function validateDue(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = DUE_RE.exec(s);
  if (!m) {
    throw new ValidationError(
      `Invalid due date "${raw}". Use YYYY-MM-DD format.`,
      'Example: tasky add "Ship v1" --due 2026-11-15',
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) {
    throw new ValidationError(`Invalid due date "${raw}". Month must be 01-12.`);
  }
  // Days in month (UTC to avoid DST issues).
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > dim) {
    throw new ValidationError(
      `Invalid due date "${raw}". ${year}-${String(month).padStart(2, '0')} has ${dim} days.`,
      'Example: tasky add "Ship v1" --due 2026-11-15',
    );
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Parse tags from commander-collected values (array and/or comma-separated). */
export function parseTags(raw) {
  if (raw === undefined || raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const entry of list) {
    for (const part of String(entry).split(',')) {
      const t = part.trim().replace(/^#+/, '');
      if (!t) continue;
      if (t.length > 30) {
        throw new ValidationError(`Tag "${t}" is too long (max 30 characters).`);
      }
      if (!/^[\p{L}\p{N}._-]+$/u.test(t)) {
        throw new ValidationError(
          `Invalid tag "${t}". Use letters, numbers, dot, underscore or dash.`,
          'Example: tasky add "Read book" --tag learning',
        );
      }
      if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
      if (out.length > 10) {
        throw new ValidationError('Too many tags (max 10 per task).');
      }
    }
  }
  return out;
}

/** Validate tags array loaded from storage/import. */
export function validateTagsArray(tags) {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) {
    throw new ValidationError('Tags must be an array of strings.');
  }
  return parseTags(tags);
}

/** Validate a numeric task ID from CLI input. */
export function validateId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(
      `Invalid task ID "${raw}". IDs are positive whole numbers.`,
      'Run "tasky list" to see available IDs.',
    );
  }
  return n;
}

/** Local YYYY-MM-DD for "today" comparisons. */
export function todayString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Check whether a stored record looks like a valid task. */
export function isValidRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
  if (!Number.isInteger(rec.id) || rec.id <= 0) return false;
  if (typeof rec.title !== 'string' || !rec.title.trim()) return false;
  if (rec.title.length > 200) return false;
  if (!STATUSES.includes(rec.status)) return false;
  if (!PRIORITIES.includes(rec.priority)) return false;
  if (rec.due !== null && rec.due !== undefined) {
    if (typeof rec.due !== 'string' || !DUE_RE.test(rec.due)) return false;
    try {
      validateDue(rec.due);
    } catch {
      return false;
    }
  }
  if (rec.tags !== undefined && !Array.isArray(rec.tags)) return false;
  return true;
}

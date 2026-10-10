# Tasky — Your tasks. Your flow.

A beautiful, fast, production-ready CLI task manager for your terminal.
No accounts, no servers, no network — your tasks live on your machine.

```
╭──────────────────────────────────────╮
│  T A S K Y                           │
│  Your tasks. Your flow.              │
╰──────────────────────────────────────╯

✓ Task created successfully

ID   STATUS       TASK               PRIORITY  DUE         TAGS
01   ○ Pending    Learn React        medium    -           -
02   ✓ Completed  Build portfolio    medium    -           -
03   ○ Pending    Practice DSA       high      -           -
```

## Features

- **Add tasks** with priority (`low` / `medium` / `high`), due dates (`YYYY-MM-DD`), and tags
- **List** with status / priority / tag filters and sorting (`due`, `priority`, `created`, `title`)
- **Search** across titles and tags
- **Complete / reopen** tasks with stable numeric IDs
- **Edit** interactively (guided prompts) or non-interactively with flags
- **Delete** with confirmation by default, `--force` for scripts
- **Stats** with totals, overdue count, due-today count, and a progress bar
- **Today / overdue** views, **clear-completed**, **export / import** (JSON with validation + duplicate handling)
- **Interactive menu** when you run `tasky` with no arguments in a terminal
- **Script-friendly**: `--plain` flag, `NO_COLOR` support, meaningful exit codes
- **Safe local storage**: per-user config dir, atomic writes, corrupt-file backup

## Prerequisites

- **Node.js 18+** (check with `node --version`)

## Local development

```powershell
git clone <your-repo-url> tasky
cd tasky
npm install
npm test
npm link
tasky --help
tasky add "Learn React"
tasky list
```

To remove the local development link later:

```powershell
npm unlink -g tasky-cli
```

## Install after publication

```powershell
npm install -g tasky-cli
tasky --help
```

## Usage

```powershell
tasky add "Learn React"
tasky add "Practice DSA" --priority high
tasky add "Build portfolio" --due 2026-11-15
tasky add "Study Node.js" --tag learning
tasky add "Release v1" --priority high --due 2026-12-01 --tag work,release

tasky list
tasky list --status pending
tasky list --status completed
tasky list --priority high
tasky list --tag learning
tasky list --sort due

tasky search "React"

tasky done 1
tasky undo 1

tasky edit 1                        # interactive guided edit
tasky edit 1 --title "New title" --priority high
tasky edit 1 --clear-due

tasky delete 1                      # asks for confirmation
tasky delete 1 --force              # scripts / no prompt

tasky stats
tasky today
tasky overdue
tasky clear-completed               # asks for confirmation
tasky clear-completed --force

tasky export ./tasks-backup.json
tasky import ./tasks-backup.json

tasky                               # interactive menu (TTY only)
tasky --help
tasky --version
tasky help
```

### Scripting

```powershell
tasky --plain list                  # no colors / simple tab-separated table
$env:NO_COLOR = "1"; tasky list     # disable colors via env
```

Every command exits `0` on success and non-zero on error, so it composes
well with `&&`, `||`, and CI pipelines.

## Storage & privacy

Tasks are stored as JSON on your own machine — nothing ever leaves it.

| OS | Location |
|----|----------|
| Windows | `%APPDATA%\tasky-cli\tasks.json` |
| macOS / Linux | `$XDG_CONFIG_HOME/tasky-cli/tasks.json` (default `~/.config/tasky-cli/tasks.json`) |

- The file is created automatically on first use.
- Writes are atomic (temp file + rename), so a crash can't half-write your data.
- A malformed file is backed up to `tasks.json.corrupt-<timestamp>.json` and Tasky starts fresh instead of crashing.
- `TASKY_DATA_DIR` env var overrides the location (used by tests and power users).
- Reset everything by deleting the file above.

Example record:

```json
[
  {
    "id": 1,
    "title": "Learn React",
    "status": "pending",
    "priority": "medium",
    "due": "2026-11-15",
    "tags": ["learning"],
    "createdAt": "2026-10-10T09:00:00.000Z",
    "updatedAt": "2026-10-10T09:00:00.000Z",
    "completedAt": null
  }
]
```

## Testing

```powershell
npm test
```

Tests use Node.js's built-in runner (`node:test` + `assert`) and hermetic
temporary directories via `TASKY_DATA_DIR` — they never touch your real tasks.
Coverage:

- Validation (titles, priorities, strict calendar dates, tags, IDs)
- CRUD + stable IDs (no reuse after delete, edits keep IDs)
- Filtering, sorting, searching, stats (incl. empty-store edge case)
- Storage (missing / empty / malformed / invalid-record handling, atomic writes)
- Full CLI end-to-end: every command, exit codes, persistence across processes,
  export/import round-trip, unknown-command suggestions

## Project structure

```
tasky/
├── bin/tasky.js               # executable entry point (shebang + launches src/cli.js)
├── src/
│   ├── cli.js                 # commander setup, help text, unknown-command suggestions
│   ├── commands/              # one module per command group (add, list, done, edit, misc, transfer)
│   ├── services/task-service.js  # pure business logic (no fs, no console)
│   ├── storage/task-store.js  # per-user JSON persistence, atomic writes
│   ├── ui/banner.js           # wordmark + colored success/warning/error helpers
│   ├── ui/formatter.js        # tables, detail view, stats block (+ --plain mode)
│   ├── ui/interactive-menu.js # guided menu for bare `tasky`
│   └── utils/                 # validation + typed errors
├── tests/                     # node:test suites (service, store, CLI e2e)
├── README.md / LICENSE / .gitignore / package.json
```

Business logic (`services/`) is intentionally decoupled from rendering (`ui/`)
and parsing (`cli.js` + `commands/`), so it can be unit-tested without spawning
processes.

## Publishing (maintainer)

> Never publish automatically — review, then publish by hand.

```powershell
# 1. Review what will be published
npm pack --dry-run

# 2. Bump the version (patch / minor / major)
npm version patch   # or: npm version minor / npm version major

# 3. Log in (first time only) and publish
npm login
npm publish

# Future releases: fix -> patch, new command/option -> minor, breaking change -> major.
```

Use `npm unpublish` only within 72h for emergencies; prefer publishing a new
patch version instead.

## Limitations

- Single-machine only — no sync between devices (by design).
- Task IDs are numeric and local to your data file (imported files get remapped on collision).
- Due dates are day-precision (`YYYY-MM-DD`), no times or time zones.
- Interactive prompts need a TTY; in pipes/CI use the flag-driven forms (`--force`, `--title`, …).

## Contributing

Issues and PRs are welcome:

1. Fork, create a branch, `npm install`, `npm test`.
2. Keep `services/` pure (no I/O) and add tests for new behavior.
3. Update this README's command reference.

## License

MIT — see [LICENSE](./LICENSE).

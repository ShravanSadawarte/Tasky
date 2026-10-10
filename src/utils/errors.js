export class TaskyError extends Error {
  constructor(message, { exitCode = 1, hint = null } = {}) {
    super(message);
    this.name = 'TaskyError';
    this.exitCode = exitCode;
    this.hint = hint;
  }
}

export class ValidationError extends TaskyError {
  constructor(message, hint = null) {
    super(message, { exitCode: 1, hint });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends TaskyError {
  constructor(message, hint = null) {
    super(message, { exitCode: 1, hint });
    this.name = 'NotFoundError';
  }
}

export class StorageError extends TaskyError {
  constructor(message, hint = null) {
    super(message, { exitCode: 1, hint });
    this.name = 'StorageError';
  }
}

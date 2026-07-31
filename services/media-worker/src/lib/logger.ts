type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, scope: string, message: string, meta?: unknown): void {
  const line = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };
  const target = level === 'error' ? console.error : console.log;
  target(JSON.stringify(line));
}

export const logger = {
  info: (scope: string, message: string, meta?: unknown) => emit('info', scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => emit('warn', scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => emit('error', scope, message, meta),
  debug: (scope: string, message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', scope, message, meta);
  },
};

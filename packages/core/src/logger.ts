// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppError } from "./errors";

/**
 * What core logs through. An app passes its own (structured JSON, a log
 * service); without one, messages go to the console.
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  debug: (message, meta) => console.debug(message, meta ?? ""),
  info: (message, meta) => console.info(message, meta ?? ""),
  warn: (message, meta) => console.warn(message, meta ?? ""),
  error: (message, meta) => console.error(message, meta ?? ""),
};

type LogLevel = "error" | "warn" | "info" | "debug";

export interface StructuredLoggerOptions {
  /**
   * Readable lines on the console and debug messages kept. Defaults to
   * `NODE_ENV === "development"`; otherwise one JSON object per line and no
   * debug messages.
   */
  development?: boolean;
}

/**
 * The logger a host app passes to core and uses itself (the web app and its
 * worker alike). A stack is written only when the caller passes one in
 * `meta.stack` (the error's own, see `logError`): one made here would point
 * at the logger, not at where the error came from.
 */
export function createLogger(options: StructuredLoggerOptions = {}): Logger {
  const development = options.development ?? process.env.NODE_ENV === "development";

  const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    if (development) {
      const method = level === "debug" ? "log" : level;
      console[method](`[${timestamp}] ${level.toUpperCase()}: ${message}`, meta ?? "");
      return;
    }
    const stack = level === "error" && typeof meta?.stack === "string" ? meta.stack : undefined;
    console.log(
      JSON.stringify({ level, message, context: meta, timestamp, ...(stack ? { stack } : {}) }),
    );
  };

  return {
    error: (message, meta) => write("error", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    info: (message, meta) => write("info", message, meta),
    debug: (message, meta) => {
      if (development) write("debug", message, meta);
    },
  };
}

/**
 * Logs a caught failure at the level it deserves. An `AppError` is expected
 * (a validation message, a missing record, a refused quota: the caller gets
 * it as a 4xx) and goes to `warn` with its code and no stack. Anything else
 * is a fault (database down, a bug) and goes to `error` with the error's own
 * stack, which `error.message` alone loses.
 */
export function logError(
  logger: Logger,
  message: string,
  error: unknown,
  meta: Record<string, unknown> = {},
): void {
  if (error instanceof AppError) {
    logger.warn(message, { ...meta, code: error.code, error: error.message });
    return;
  }
  logger.error(message, {
    ...meta,
    error: error instanceof Error ? error.message : String(error),
    ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
  });
}

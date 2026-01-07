interface LogContext {
  userId?: string | number;
  sessionId?: string;
  requestId?: string;
  projectId?: string | number;
  campaignId?: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface LogEntry {
  level: "error" | "warn" | "info" | "debug";
  message: string;
  context?: LogContext;
  timestamp: string;
  stack?: string;
}

export interface Logger {
  error: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

class DefaultLogger implements Logger {
  private formatLog(
    level: LogEntry["level"],
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      ...(level === "error" && context?.stack ? { stack: context.stack } : {}),
    };
  }

  private log(entry: LogEntry): void {
    if (process.env.NODE_ENV === "development") {
      const consoleMethod = entry.level === "debug" ? "log" : entry.level;
      console[consoleMethod](
        `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`,
        entry.context || ""
      );
      return;
    }

    console.log(JSON.stringify(entry));
  }

  error(message: string, context?: LogContext): void {
    const entry = this.formatLog("error", message, {
      ...context,
      ...(context?.stack ? {} : { stack: new Error().stack }),
    });
    this.log(entry);
  }

  warn(message: string, context?: LogContext): void {
    const entry = this.formatLog("warn", message, context);
    this.log(entry);
  }

  info(message: string, context?: LogContext): void {
    const entry = this.formatLog("info", message, context);
    this.log(entry);
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      const entry = this.formatLog("debug", message, context);
      this.log(entry);
    }
  }
}

export const logger = new DefaultLogger();

export function createChildLogger(baseContext: LogContext): Logger {
  return {
    error: (message: string, context?: LogContext) =>
      logger.error(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      logger.warn(message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      logger.info(message, { ...baseContext, ...context }),
    debug: (message: string, context?: LogContext) =>
      logger.debug(message, { ...baseContext, ...context }),
  };
}





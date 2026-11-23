import { inject, Injectable, InjectionToken } from '@angular/core';
import { environment } from '@env/environment';

import { LogLevel } from './log-level';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly context?: unknown;
  readonly timestamp: string;
}

/** Extension point for crash reporting or remote logging providers. */
export interface LogSink {
  write(entry: LogEntry): void;
}

export const LOG_SINKS = new InjectionToken<readonly LogSink[]>('LOG_SINKS', {
  factory: () => [],
});

/**
 * The only place in the app allowed to touch `console`. Everything else logs through here
 * so output can be filtered per environment and forwarded to sinks.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly sinks = inject(LOG_SINKS);
  private readonly minLevel = environment.minLogLevel;

  public debug(message: string, context?: unknown): void {
    this.log(LogLevel.Debug, message, context);
  }

  public info(message: string, context?: unknown): void {
    this.log(LogLevel.Info, message, context);
  }

  public warn(message: string, context?: unknown): void {
    this.log(LogLevel.Warn, message, context);
  }

  public error(message: string, context?: unknown): void {
    this.log(LogLevel.Error, message, context);
  }

  private log(level: LogLevel, message: string, context: unknown): void {
    if (level < this.minLevel) {
      return;
    }
    const entry: LogEntry = { level, message, context, timestamp: new Date().toISOString() };
    this.writeToConsole(entry);
    for (const sink of this.sinks) {
      try {
        sink.write(entry);
      } catch {
        // A failing sink must never break the app or recurse into the logger.
      }
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const args: unknown[] =
      entry.context === undefined ? [entry.message] : [entry.message, entry.context];
    switch (entry.level) {
      case LogLevel.Debug:
        console.debug(...args);
        break;
      case LogLevel.Info:
        console.info(...args);
        break;
      case LogLevel.Warn:
        console.warn(...args);
        break;
      case LogLevel.Error:
        console.error(...args);
        break;
    }
  }
}

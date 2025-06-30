import type { LogEvent, ErrorMatch, ErrorPattern } from '../../types/index.js';
import { getAllErrorPatterns } from '../../shared/error-patterns.js';

export function detectErrorsInLogs(
  logs: LogEvent[],
  customPatterns: ErrorPattern[] = []
): ErrorMatch[] {
  const patterns = getAllErrorPatterns(customPatterns);
  const errorMatches: ErrorMatch[] = [];

  console.log(`Running error detection on ${logs.length} log events using ${patterns.length} patterns`);

  for (const log of logs) {
    for (const pattern of patterns) {
      if (pattern.regex.test(log.message)) {
        // Extract some context around the match
        const context = extractContext(log.message, pattern.regex);
        
        errorMatches.push({
          pattern: pattern.name,
          message: log.message,
          timestamp: log.timestamp,
          logStreamName: log.logStreamName,
          context,
        });

        // Break after first match to avoid duplicate matches on the same log
        break;
      }
    }
  }

  console.log(`Found ${errorMatches.length} error matches`);
  return errorMatches;
}

function extractContext(message: string, regex: RegExp): string {
  const match = message.match(regex);
  if (!match) return message;

  const matchIndex = match.index || 0;
  const contextStart = Math.max(0, matchIndex - 50);
  const contextEnd = Math.min(message.length, matchIndex + match[0].length + 50);

  let context = message.substring(contextStart, contextEnd);
  
  // Add ellipsis if we truncated
  if (contextStart > 0) context = '...' + context;
  if (contextEnd < message.length) context = context + '...';

  return context;
}

export function groupErrorsByPattern(errors: ErrorMatch[]): Record<string, ErrorMatch[]> {
  return errors.reduce((groups, error) => {
    if (!groups[error.pattern]) {
      groups[error.pattern] = [];
    }
    groups[error.pattern].push(error);
    return groups;
  }, {} as Record<string, ErrorMatch[]>);
}

export function getErrorSummary(errors: ErrorMatch[]): {
  totalErrors: number;
  patternCounts: Record<string, number>;
  timeRange: { earliest: number; latest: number } | null;
} {
  if (errors.length === 0) {
    return {
      totalErrors: 0,
      patternCounts: {},
      timeRange: null,
    };
  }

  const patternCounts: Record<string, number> = {};
  let earliest = errors[0].timestamp;
  let latest = errors[0].timestamp;

  for (const error of errors) {
    patternCounts[error.pattern] = (patternCounts[error.pattern] || 0) + 1;
    earliest = Math.min(earliest, error.timestamp);
    latest = Math.max(latest, error.timestamp);
  }

  return {
    totalErrors: errors.length,
    patternCounts,
    timeRange: { earliest, latest },
  };
}
import type { ErrorPattern } from '../types/index.js';

export const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
  {
    name: 'Generic Error',
    regex: /\b(error|ERROR|Error)\b/i,
    description: 'Matches common error keywords',
  },
  {
    name: 'Exception',
    regex: /\b(exception|Exception|EXCEPTION)\b/i,
    description: 'Matches exception keywords',
  },
  {
    name: 'Failed',
    regex: /\b(failed|Failed|FAILED|failure|Failure|FAILURE)\b/i,
    description: 'Matches failure keywords',
  },
  {
    name: 'Timeout',
    regex: /\b(timeout|Timeout|TIMEOUT|timed out|TIMED OUT)\b/i,
    description: 'Matches timeout-related errors',
  },
  {
    name: 'Connection Error',
    regex: /\b(connection|Connection|CONNECTION)\s+(error|Error|ERROR|failed|Failed|FAILED|refused|Refused|REFUSED)\b/i,
    description: 'Matches connection-related errors',
  },
  {
    name: 'HTTP Error',
    regex: /\b(4\d{2}|5\d{2})\b|\b(bad request|unauthorized|forbidden|not found|internal server error|service unavailable)\b/i,
    description: 'Matches HTTP error status codes and messages',
  },
  {
    name: 'Database Error',
    regex: /\b(database|Database|DATABASE|sql|SQL|query|Query|QUERY)\s+(error|Error|ERROR|failed|Failed|FAILED)\b/i,
    description: 'Matches database-related errors',
  },
  {
    name: 'AWS Error',
    regex: /\b(aws|AWS|amazon|Amazon|AMAZON)\s+(error|Error|ERROR)\b|\b(AccessDenied|InvalidRequest|ThrottlingException|ServiceUnavailable)\b/i,
    description: 'Matches AWS service errors',
  },
];

export function createCustomErrorPattern(
  name: string,
  pattern: string,
  description: string
): ErrorPattern {
  try {
    return {
      name,
      regex: new RegExp(pattern, 'i'),
      description,
    };
  } catch (error) {
    throw new Error(
      `Invalid regex pattern "${pattern}": ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function getAllErrorPatterns(
  customPatterns: ErrorPattern[] = []
): ErrorPattern[] {
  return [...DEFAULT_ERROR_PATTERNS, ...customPatterns];
}
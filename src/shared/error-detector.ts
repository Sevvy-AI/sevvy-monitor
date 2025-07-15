import type { LogEvent, RawLogErrorDetectionResult } from "../types/index.js";

export const DEFAULT_ERROR_PATTERNS: RegExp[] = [
  /\b(error|ERROR|Error)\b/i,
  /\b(exception|Exception|EXCEPTION)\b/i,
  /\b(failed|Failed|FAILED|failure|Failure|FAILURE)\b/i,
  /\b(timeout|Timeout|TIMEOUT|timed out|TIMED OUT)\b/i,
  /\b(connection|Connection|CONNECTION)\s+(error|Error|ERROR|failed|Failed|FAILED|refused|Refused|REFUSED)\b/i,
  /\b(4\d{2}|5\d{2})\b|\b(bad request|unauthorized|forbidden|not found|internal server error|service unavailable)\b/i,
  /\b(database|Database|DATABASE|sql|SQL|query|Query|QUERY)\s+(error|Error|ERROR|failed|Failed|FAILED)\b/i,
  /\b(aws|AWS|amazon|Amazon|AMAZON)\s+(error|Error|ERROR)\b|\b(AccessDenied|InvalidRequest|ThrottlingException|ServiceUnavailable)\b/i,
];

export function getAllErrorPatterns(customPatterns: RegExp[] = []): RegExp[] {
  return [...DEFAULT_ERROR_PATTERNS, ...customPatterns];
}

export function detectErrorsInLogs(
  logs: LogEvent[],
  customPatterns: RegExp[] = []
): RawLogErrorDetectionResult {
  console.log(`Running error detection on ${logs.length} log events`);
  for (const log of logs) {
    const detection = detectErrorInMessage(log.message, customPatterns);
    if (detection.hasError) {
      return detection;
    }
  }
  return { hasError: false, matchedPattern: null, errorLines: [] };
}

export function detectErrorInMessage(
  message: string,
  customPatterns: RegExp[] = []
): RawLogErrorDetectionResult {
  const patterns = getAllErrorPatterns(customPatterns);
  const lines = message.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        const trailingLines = lines.slice(i + 1, i + 4);
        const errorLines = [line, ...trailingLines];
        return {
          hasError: true,
          matchedPattern: pattern,
          errorLines,
        };
      }
    }
  }

  return { hasError: false, matchedPattern: null, errorLines: [] };
}

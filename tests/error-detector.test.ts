import { describe, it, expect } from "vitest";
import {
  detectErrorsInLogs,
  detectErrorInMessage,
  DEFAULT_ERROR_PATTERNS,
  getAllErrorPatterns,
} from "../src/shared/error-detector.js";
import type { LogEvent } from "../src/types/index.js";

describe("Error Detector", () => {
  const sampleLogs: LogEvent[] = [
    {
      timestamp: 1640995200000,
      message: "INFO: Application started successfully",
    },
    {
      timestamp: 1640995260000,
      message: "ERROR: Database connection failed",
    },
    {
      timestamp: 1640995320000,
      message: "WARN: Low disk space",
    },
    {
      timestamp: 1640995380000,
      message: 'Exception in thread "main" java.lang.NullPointerException',
    },
    {
      timestamp: 1640995440000,
      message: "HTTP 404 - Resource not found",
    },
  ];

  describe("getAllErrorPatterns", () => {
    it("should return default patterns", () => {
      const patterns = getAllErrorPatterns();
      expect(patterns).toEqual(DEFAULT_ERROR_PATTERNS);
    });

    it("should merge default patterns with custom patterns", () => {
      const customPattern = /custom/i;
      const patterns = getAllErrorPatterns([customPattern]);
      expect(patterns).toEqual([...DEFAULT_ERROR_PATTERNS, customPattern]);
    });
  });

  describe("detectErrorsInLogs", () => {
    it("should detect errors using default patterns", () => {
      const result = detectErrorsInLogs(sampleLogs);
      expect(result.hasError).toBe(true);
      expect(result.errorLines).toContain("ERROR: Database connection failed");
      expect(result.matchedPattern).toBeTruthy();
    });

    it("should detect errors with custom patterns", () => {
      const customPattern = /WARN:/;
      const logsWithWarning: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message: "INFO: Application started successfully",
        },
        {
          timestamp: 1640995320000,
          message: "WARN: Low disk space",
        },
        {
          timestamp: 1640995380000,
          message: "DEBUG: Processing completed",
        },
      ];
      const result = detectErrorsInLogs(logsWithWarning, [customPattern]);
      expect(result.hasError).toBe(true);
      expect(result.errorLines).toContain("WARN: Low disk space");
      expect(result.matchedPattern).toBeTruthy();
    });

    it("should not match non-error messages", () => {
      const infoOnlyLogs: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message: "INFO: Everything is working fine",
        },
        {
          timestamp: 1640995260000,
          message: "DEBUG: Processing user request",
        },
      ];

      const result = detectErrorsInLogs(infoOnlyLogs);
      expect(result.hasError).toBe(false);
      expect(result.errorLines).toEqual([]);
      expect(result.matchedPattern).toBeNull();
    });

    it("should not detect API routes with 'error' in the path as errors", () => {
      const apiRouteLogs: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message:
            "Jul 15 22:59:22 ip-172-31-7-171 web[653215]: 2025-07-15 22:59:22,048 - application - INFO - Request: POST http://sevvy-test-dev.eba-crhpv3pw.us-east-1.elasticbeanstalk.com/error/division-zero - IP: 127.0.0.1",
        },
        {
          timestamp: 1640995260000,
          message: "INFO: Processing GET /api/error-logs endpoint",
        },
        {
          timestamp: 1640995320000,
          message: "DEBUG: Routing to /error/handler for user authentication",
        },
        {
          timestamp: 1640995380000,
          message: "Request completed: POST /v1/error-reporting/submit",
        },
      ];

      const result = detectErrorsInLogs(apiRouteLogs);
      expect(result.hasError).toBe(false);
      expect(result.errorLines).toEqual([]);
      expect(result.matchedPattern).toBeNull();
    });

    it("should not detect the specific Elastic Beanstalk log line as an error", () => {
      const specificLog: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message:
            "Jul 15 22:59:22 ip-172-31-7-171 web[653215]: 2025-07-15 22:59:22,048 - application - INFO - Request: POST http://sevvy-test-dev.eba-crhpv3pw.us-east-1.elasticbeanstalk.com/error/division-zero - IP: 127.0.0.1",
        },
      ];

      const result = detectErrorsInLogs(specificLog);
      expect(result.hasError).toBe(false);
      expect(result.errorLines).toEqual([]);
      expect(result.matchedPattern).toBeNull();
    });

    it("should still detect actual errors even when API routes are present", () => {
      const mixedLogs: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message: "INFO: Request: GET /api/error-logs",
        },
        {
          timestamp: 1640995260000,
          message: "ERROR: Database connection timeout",
        },
        {
          timestamp: 1640995320000,
          message: "DEBUG: Response sent for /error/handler",
        },
      ];

      const result = detectErrorsInLogs(mixedLogs);
      expect(result.hasError).toBe(true);
      expect(result.errorLines).toContain("ERROR: Database connection timeout");
      expect(result.matchedPattern).toBeTruthy();
    });
  });

  describe("detectErrorInMessage", () => {
    it("should detect errors in single message", () => {
      const message = "ERROR: Something went wrong";
      const result = detectErrorInMessage(message);
      expect(result.hasError).toBe(true);
      expect(result.errorLines).toContain("ERROR: Something went wrong");
    });

    it("should return trailing lines for context", () => {
      const message =
        "INFO: Starting process\nERROR: Failed to connect\nStack trace line 1\nStack trace line 2\nStack trace line 3\nEND";
      const result = detectErrorInMessage(message);
      expect(result.hasError).toBe(true);
      expect(result.errorLines).toEqual([
        "ERROR: Failed to connect",
        "Stack trace line 1",
        "Stack trace line 2",
        "Stack trace line 3",
      ]);
    });

    it("should not detect API routes as errors", () => {
      const message = "INFO: Request: POST /api/error-handler/submit";
      const result = detectErrorInMessage(message);
      expect(result.hasError).toBe(false);
      expect(result.errorLines).toEqual([]);
      expect(result.matchedPattern).toBeNull();
    });
  });
});

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

  describe("detectErrorsInLogs", () => {
    it("should detect errors using default patterns", () => {
      const hasErrors = detectErrorsInLogs(sampleLogs);
      expect(hasErrors).toBe(true);
    });

    it("should detect errors with custom patterns", () => {
      const customPattern = /WARN:/;
      const hasErrors = detectErrorsInLogs(sampleLogs, [customPattern]);
      expect(hasErrors).toBe(true);
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

      const hasErrors = detectErrorsInLogs(infoOnlyLogs);
      expect(hasErrors).toBe(false);
    });
  });

  describe("detectErrorInMessage", () => {
    it("should detect errors in a single message", () => {
      const result = detectErrorInMessage("ERROR: Database connection failed");
      expect(result.hasError).toBe(true);
    });

    it("should return false for non-error messages", () => {
      const result = detectErrorInMessage("INFO: Everything is working fine");
      expect(result.hasError).toBe(false);
    });
  });

  describe("DEFAULT_ERROR_PATTERNS", () => {
    it("should contain error patterns", () => {
      expect(DEFAULT_ERROR_PATTERNS.length).toBeGreaterThan(0);
      expect(Array.isArray(DEFAULT_ERROR_PATTERNS)).toBe(true);
    });
  });

  describe("getAllErrorPatterns", () => {
    it("should return default patterns when no custom patterns provided", () => {
      const patterns = getAllErrorPatterns();
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length);
    });

    it("should combine default and custom patterns", () => {
      const customPattern = /TEST_ERROR/;
      const patterns = getAllErrorPatterns([customPattern]);
      expect(patterns.length).toBe(DEFAULT_ERROR_PATTERNS.length + 1);
      expect(patterns).toContain(customPattern);
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  detectErrorsInLogs,
  groupErrorsByPattern,
  getErrorSummary,
} from "../src/integrations/cloudwatch/error-detector.js";
import { createCustomErrorPattern } from "../src/shared/error-patterns.js";
import type { LogEvent } from "../src/types/index.js";

describe("Error Detector", () => {
  const sampleLogs: LogEvent[] = [
    {
      timestamp: 1640995200000,
      message: "INFO: Application started successfully",
      logStreamName: "stream-1",
    },
    {
      timestamp: 1640995260000,
      message: "ERROR: Database connection failed",
      logStreamName: "stream-1",
    },
    {
      timestamp: 1640995320000,
      message: "WARN: Low disk space",
      logStreamName: "stream-2",
    },
    {
      timestamp: 1640995380000,
      message: 'Exception in thread "main" java.lang.NullPointerException',
      logStreamName: "stream-2",
    },
    {
      timestamp: 1640995440000,
      message: "HTTP 404 - Resource not found",
      logStreamName: "stream-1",
    },
  ];

  describe("detectErrorsInLogs", () => {
    it("should detect errors using default patterns", () => {
      const errors = detectErrorsInLogs(sampleLogs);

      expect(errors.length).toBe(3); // ERROR, Exception, HTTP 404
      expect(errors[0].message).toContain("Database connection failed");
      expect(errors[1].message).toContain("NullPointerException");
      expect(errors[2].message).toContain("404");
    });

    it("should include context around matches", () => {
      const errors = detectErrorsInLogs(sampleLogs);

      expect(errors[0].context).toContain("Database connection failed");
      expect(errors[0].pattern).toBe("Generic Error");
    });

    it("should detect errors with custom patterns", () => {
      const customPattern = createCustomErrorPattern(
        "Custom Warning",
        "WARN:",
        "Custom warning pattern"
      );

      const errors = detectErrorsInLogs(sampleLogs, [customPattern]);

      const customErrors = errors.filter(
        error => error.pattern === "Custom Warning"
      );
      expect(customErrors.length).toBe(1);
      expect(customErrors[0].message).toContain("Low disk space");
    });

    it("should not match non-error messages", () => {
      const infoOnlyLogs: LogEvent[] = [
        {
          timestamp: 1640995200000,
          message: "INFO: Everything is working fine",
          logStreamName: "stream-1",
        },
        {
          timestamp: 1640995260000,
          message: "DEBUG: Processing user request",
          logStreamName: "stream-1",
        },
      ];

      const errors = detectErrorsInLogs(infoOnlyLogs);
      expect(errors.length).toBe(0);
    });
  });

  describe("groupErrorsByPattern", () => {
    it("should group errors by pattern name", () => {
      const errors = detectErrorsInLogs(sampleLogs);
      const grouped = groupErrorsByPattern(errors);

      expect(grouped["Generic Error"]).toBeDefined();
      expect(grouped["Exception"]).toBeDefined();
      expect(grouped["HTTP Error"]).toBeDefined();

      expect(grouped["Generic Error"].length).toBe(1);
      expect(grouped["Exception"].length).toBe(1);
      expect(grouped["HTTP Error"].length).toBe(1);
    });
  });

  describe("getErrorSummary", () => {
    it("should return summary for errors", () => {
      const errors = detectErrorsInLogs(sampleLogs);
      const summary = getErrorSummary(errors);

      expect(summary.totalErrors).toBe(3);
      expect(summary.patternCounts["Generic Error"]).toBe(1);
      expect(summary.patternCounts["Exception"]).toBe(1);
      expect(summary.patternCounts["HTTP Error"]).toBe(1);
      expect(summary.timeRange).toBeDefined();
      expect(summary.timeRange!.earliest).toBe(1640995260000);
      expect(summary.timeRange!.latest).toBe(1640995440000);
    });

    it("should return empty summary for no errors", () => {
      const summary = getErrorSummary([]);

      expect(summary.totalErrors).toBe(0);
      expect(summary.patternCounts).toEqual({});
      expect(summary.timeRange).toBeNull();
    });
  });
});

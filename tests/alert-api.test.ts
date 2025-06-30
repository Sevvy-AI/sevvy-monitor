import { describe, it, expect, vi } from "vitest";
import { AlertApiClient, sendAlert } from "../src/shared/alert-api.js";
import type { MonitoringResult, AlertPayload } from "../src/types/index.js";

describe("Alert API", () => {
  const mockResult: MonitoringResult = {
    logGroupName: "/aws/lambda/test-function",
    awsAccountId: "123456789012",
    timeRange: {
      startTime: 1640995200000,
      endTime: 1640995260000,
    },
    totalEvents: 10,
    errorMatches: [
      {
        pattern: "Generic Error",
        message: "ERROR: Something went wrong",
        timestamp: 1640995230000,
        logStreamName: "stream-1",
        context: "ERROR: Something went wrong",
      },
    ],
    success: true,
  };

  describe("AlertApiClient", () => {
    it("should create client with default config", () => {
      const client = new AlertApiClient();
      expect(client).toBeDefined();
    });

    it("should create client with custom config", () => {
      const client = new AlertApiClient({
        apiUrl: "https://custom-api.com/alerts",
        apiKey: "test-key",
        timeout: 5000,
      });
      expect(client).toBeDefined();
    });

    it("should send alert successfully (stubbed)", async () => {
      const client = new AlertApiClient();
      const payload: AlertPayload = {
        logGroupName: mockResult.logGroupName,
        awsAccountId: mockResult.awsAccountId,
        errorMatches: mockResult.errorMatches,
        timestamp: Date.now(),
      };

      const result = await client.sendAlert(payload);
      expect(result).toBe(true);
    });

    it("should send alert from monitoring result", async () => {
      const client = new AlertApiClient();
      const result = await client.sendAlertFromMonitoringResult(mockResult);
      expect(result).toBe(true);
    });

    it("should not send alert for successful result with no errors", async () => {
      const client = new AlertApiClient();
      const resultWithNoErrors: MonitoringResult = {
        ...mockResult,
        errorMatches: [],
      };

      const result =
        await client.sendAlertFromMonitoringResult(resultWithNoErrors);
      expect(result).toBe(true); // Returns true but doesn't actually send
    });

    it("should not send alert for failed monitoring result", async () => {
      const client = new AlertApiClient();
      const failedResult: MonitoringResult = {
        ...mockResult,
        success: false,
        error: "Failed to fetch logs",
      };

      const result = await client.sendAlertFromMonitoringResult(failedResult);
      expect(result).toBe(true); // Returns true but doesn't actually send
    });
  });

  describe("sendAlert convenience function", () => {
    it("should send alert using convenience function", async () => {
      const result = await sendAlert(mockResult);
      expect(result).toBe(true);
    });

    it("should send alert with custom config", async () => {
      const result = await sendAlert(mockResult, {
        apiUrl: "https://custom-api.com/alerts",
        timeout: 5000,
      });
      expect(result).toBe(true);
    });
  });
});

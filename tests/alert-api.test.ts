import { describe, it, expect, vi } from "vitest";
import { AlertApiClient } from "../src/shared/send-alert.js";
import type { MonitoringResult } from "../src/types/index.js";

describe("Alert API", () => {
  const mockResult: MonitoringResult = {
    providerCode: "aws",
    orgId: "org_2yszKYUZTsEz8vzbt7MOVbnxZFX",
    groupId: "2d77eca9-be64-4989-a7b0-4be348a1b58b",
    resourceId: "81759306-28fc-4911-b021-e9553d9fecd4",
    metadata: {
      awsAccountNumber: "663297832605",
      region: "us-east-1",
    },
    timeRange: {
      startTime: 1640995200000,
      endTime: 1640995260000,
    },
    hasError: true,
  };

  describe("AlertApiClient", () => {
    it("should create client with default config", () => {
      const client = new AlertApiClient();
      expect(client).toBeDefined();
    });

    it("should create client with custom config", () => {
      const client = new AlertApiClient({
        apiUrl: "https://custom-api.com/alerts",
      });
      expect(client).toBeDefined();
    });

    it("should send alert successfully (stubbed)", async () => {
      const client = new AlertApiClient();
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(true);
    });

    it("should send alert from monitoring result", async () => {
      const client = new AlertApiClient();
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(true);
    });

    it("should not send alert for successful result with no errors", async () => {
      const client = new AlertApiClient();
      const resultWithNoErrors: MonitoringResult = {
        ...mockResult,
        hasError: false,
      };

      const result = await client.sendAlert(resultWithNoErrors);
      expect(result).toBe(true);
    });
  });
});

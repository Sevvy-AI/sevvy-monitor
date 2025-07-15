import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { AlertApiClient } from "../src/shared/send-alert.js";
import type { MonitoringResult } from "../src/types/index.js";
import { fetchWithTimeout } from "../src/shared/utils.js";

vi.mock("../src/shared/utils.js", () => ({
  fetchWithTimeout: vi.fn(),
}));

const mockedFetchWithTimeout = fetchWithTimeout as Mock;

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
    errorDetectionResult: {
      hasError: true,
      matchedPattern: /ERROR/i,
      errorLines: ["ERROR: Database connection failed"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    it("should send alert successfully", async () => {
      mockedFetchWithTimeout.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      const client = new AlertApiClient({ apiUrl: "http://test-api.com" });
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(true);
      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it("should return false if alert sending fails", async () => {
      mockedFetchWithTimeout.mockRejectedValue(new Error("Network error"));
      const client = new AlertApiClient({ apiUrl: "http://test-api.com" });
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(false);
      expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it("should not send alert for successful result with no errors", async () => {
      const client = new AlertApiClient({ apiUrl: "http://test-api.com" });
      const resultWithNoErrors: MonitoringResult = {
        ...mockResult,
        errorDetectionResult: {
          hasError: false,
          matchedPattern: null,
          errorLines: [],
        },
      };

      const result = await client.sendAlert(resultWithNoErrors);
      expect(result).toBe(true);
      expect(fetchWithTimeout).not.toHaveBeenCalled();
    });
  });
});

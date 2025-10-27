import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { SqsQueueClient } from "../src/shared/sqs-queue.js";
import type { LogAgentInput } from "../src/shared/types.js";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  SendMessageCommand: vi.fn(),
}));

describe("SQS Queue", () => {
  const mockResult: LogAgentInput = {
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
      matchedPattern: "ERROR",
      errorLines: ["ERROR: Database connection failed"],
    },
  };

  let mockSend: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    (SQSClient as unknown as Mock).mockImplementation(() => ({
      send: mockSend,
    }));
  });

  describe("SqsQueueClient", () => {
    it("should create client with default config", () => {
      const client = new SqsQueueClient();
      expect(client).toBeDefined();
    });

    it("should create client with custom config", () => {
      const client = new SqsQueueClient({
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
      });
      expect(client).toBeDefined();
    });

    it("should enqueue message successfully", async () => {
      mockSend.mockResolvedValue({
        MessageId: "test-message-id",
      });
      const client = new SqsQueueClient({
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
      });
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(SendMessageCommand).toHaveBeenCalledWith({
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
        MessageBody: expect.stringContaining("log_error"),
      });
    });

    it("should return false if message enqueuing fails", async () => {
      mockSend.mockRejectedValue(new Error("SQS error"));
      const client = new SqsQueueClient({
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
      });
      const result = await client.sendAlert(mockResult);
      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should not enqueue message for result with no errors", async () => {
      const client = new SqsQueueClient({
        queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789/test-queue",
      });
      const resultWithNoErrors: LogAgentInput = {
        ...mockResult,
        errorDetectionResult: {
          hasError: false,
          matchedPattern: null,
          errorLines: [],
        },
      };

      const result = await client.sendAlert(resultWithNoErrors);
      expect(result).toBe(true);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});

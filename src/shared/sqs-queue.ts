import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { LogAgentInput, QueueMessage, EVENT_TYPE } from "./types.js";

export interface SqsQueueConfig {
  queueUrl?: string;
}

function getAwsRegion(): string {
  return process.env.AWS_REGION || "us-east-1";
}

function createSQSClient(): SQSClient {
  return new SQSClient({
    region: getAwsRegion(),
  });
}

export class SqsQueueClient {
  private queueUrl: string;
  private sqsClient: SQSClient;

  constructor(config: SqsQueueConfig = {}) {
    this.queueUrl = config.queueUrl || process.env.SQS_QUEUE_URL || "";
    this.sqsClient = createSQSClient();
  }

  async sendAlert(payload: LogAgentInput): Promise<boolean> {
    if (!payload.errorDetectionResult.hasError) {
      console.log("No errors detected, not enqueuing message.");
      return true;
    }

    console.log("SqsQueueClient.sendAlert called with payload:", {
      providerCode: payload.providerCode,
      orgId: payload.orgId,
      groupId: payload.groupId,
      resourceId: payload.resourceId,
      metadata: payload.metadata,
      timeRange: payload.timeRange,
    });

    try {
      const queueMessage: QueueMessage = {
        eventType: EVENT_TYPE.LOG_ERROR,
        payload: payload,
      };

      console.log("Enqueuing message to:", this.queueUrl);
      console.log("Queue message:", JSON.stringify(queueMessage, null, 2));

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(queueMessage),
      });

      const response = await this.sqsClient.send(command);
      console.log(
        "Message enqueued successfully. MessageId:",
        response.MessageId
      );
      return true;
    } catch (error) {
      console.error("Failed to enqueue message:", error);
      return false;
    }
  }
}

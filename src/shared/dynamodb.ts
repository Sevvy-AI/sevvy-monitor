import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  GetItemCommandInput,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";

const TABLE_NAME = "ResourceMonitoring";

export class DynamoDBService {
  private client: DynamoDBClient;

  constructor(region: string = "us-east-1") {
    this.client = new DynamoDBClient({ region });
  }

  async getLastReadTime(orgId: string, resourceId: string): Promise<number> {
    const params: GetItemCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        orgId: { S: orgId },
        resourceId: { S: resourceId },
      },
    };

    try {
      const command = new GetItemCommand(params);
      const response = await this.client.send(command);

      if (response.Item && response.Item.LastReadTime) {
        const timestamp = parseInt(response.Item.LastReadTime.N || "0", 10);
        console.log(
          `Retrieved last read time for ${orgId}#${resourceId}: ${new Date(timestamp).toISOString()}`
        );
        return timestamp;
      }

      const initialTime = Date.now() - 60 * 1000;
      console.log(
        `First time monitoring ${orgId}#${resourceId} - creating initial entry with timestamp: ${new Date(initialTime).toISOString()}`
      );

      await this.createInitialEntry(orgId, resourceId, initialTime);
      return initialTime;
    } catch (error) {
      console.error(
        `Error retrieving last read time for ${orgId}#${resourceId}:`,
        error
      );
      const fallbackTime = Date.now() - 60 * 1000;
      console.log(
        `Using fallback time due to error: ${new Date(fallbackTime).toISOString()}`
      );
      return fallbackTime;
    }
  }

  private async createInitialEntry(
    orgId: string,
    resourceId: string,
    timestamp: number
  ): Promise<void> {
    const params: PutItemCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        orgId: { S: orgId },
        resourceId: { S: resourceId },
        LastReadTime: { N: timestamp.toString() },
        UpdatedAt: { N: Date.now().toString() },
      },
    };

    try {
      const command = new PutItemCommand(params);
      await this.client.send(command);
      console.log(`Created initial DynamoDB entry for ${orgId}#${resourceId}`);
    } catch (error) {
      console.error(
        `Error creating initial entry for ${orgId}#${resourceId}:`,
        error
      );
      throw new Error(
        `Failed to create initial entry: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async updateLastReadTime(
    orgId: string,
    resourceId: string,
    timestamp: number
  ): Promise<void> {
    const params: PutItemCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        orgId: { S: orgId },
        resourceId: { S: resourceId },
        LastReadTime: { N: timestamp.toString() },
        UpdatedAt: { N: Date.now().toString() },
      },
    };

    try {
      const command = new PutItemCommand(params);
      await this.client.send(command);
      console.log(
        `Updated last read time for ${orgId}#${resourceId}: ${new Date(timestamp).toISOString()}`
      );
    } catch (error) {
      console.error(
        `Error updating last read time for ${orgId}#${resourceId}:`,
        error
      );
      throw new Error(
        `Failed to update last read time: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const dynamoDBService = new DynamoDBService();

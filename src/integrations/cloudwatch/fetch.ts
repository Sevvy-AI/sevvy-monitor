import {
  FilterLogEventsCommand,
  FilterLogEventsCommandInput,
} from "@aws-sdk/client-cloudwatch-logs";
import { subMinutes } from "date-fns";
import type { LogEvent } from "../../types/index.js";
import {
  assumeRole,
  createAssumedRoleCloudWatchLogsClient,
  createCloudWatchLogsClient,
} from "./utils.js";
import { dynamoDBService } from "../../shared/dynamodb.js";

export interface LogFetchOptions {
  logGroupName: string;
  roleArn: string;
  externalId: string;
  startTime?: number;
  endTime?: number;
  region?: string;
  intervalMinutes?: number;
}

export async function fetchCloudWatchLogs(
  options: LogFetchOptions
): Promise<LogEvent[]> {
  const {
    logGroupName,
    startTime,
    endTime,
    roleArn,
    externalId,
    region = "us-east-1",
    intervalMinutes = 1,
  } = options;

  const now = Date.now();
  const fetchStartTime =
    startTime || subMinutes(now, intervalMinutes).getTime();
  const fetchEndTime = endTime || now;

  console.log(
    `Fetching logs from ${logGroupName} for time range: ${new Date(fetchStartTime).toISOString()} to ${new Date(fetchEndTime).toISOString()}`
  );

  let logsClient;
  if (roleArn) {
    const credentials = await assumeRole(roleArn, externalId);
    logsClient = createAssumedRoleCloudWatchLogsClient(credentials, region);
  } else {
    logsClient = createCloudWatchLogsClient(region);
  }

  const params: FilterLogEventsCommandInput = {
    logGroupName,
    startTime: fetchStartTime,
    endTime: fetchEndTime,
    limit: 1000,
  };

  const events: LogEvent[] = [];
  let nextToken: string | undefined;

  try {
    do {
      if (nextToken) {
        params.nextToken = nextToken;
      }

      const command = new FilterLogEventsCommand(params);
      const response = await logsClient.send(command);

      if (response.events) {
        const logEvents = response.events.map(event => ({
          timestamp: event.timestamp || 0,
          message: event.message || "",
        }));

        events.push(...logEvents);
      }

      nextToken = response.nextToken;
    } while (nextToken);

    console.log(`Fetched ${events.length} log events from ${logGroupName}`);
    return events;
  } catch (error) {
    console.error(`Error fetching logs from ${logGroupName}:`, error);
    throw new Error(
      `Failed to fetch CloudWatch logs: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function getLastReadTime(
  orgId: string,
  resourceId: string
): Promise<number> {
  try {
    return await dynamoDBService.getLastReadTime(orgId, resourceId);
  } catch (error) {
    console.error("Error getting last read time from DynamoDB:", error);
    return subMinutes(Date.now(), 1).getTime();
  }
}

export async function updateLastReadTime(
  orgId: string,
  resourceId: string,
  timestamp: number
): Promise<void> {
  try {
    await dynamoDBService.updateLastReadTime(orgId, resourceId, timestamp);
  } catch (error) {
    console.error("Error updating last read time in DynamoDB:", error);
    throw error;
  }
}

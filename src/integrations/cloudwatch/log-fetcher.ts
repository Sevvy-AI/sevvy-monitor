import {
  FilterLogEventsCommand,
  FilterLogEventsCommandInput,
} from '@aws-sdk/client-cloudwatch-logs';
import { subMinutes } from 'date-fns';
import type { LogEvent, AssumedCredentials } from '../../types/index.js';
import {
  assumeRole,
  createAssumedRoleCloudWatchLogsClient,
  createCloudWatchLogsClient,
} from '../../shared/aws-utils.js';

export interface LogFetchOptions {
  logGroupName: string;
  startTime?: number;
  endTime?: number;
  roleArn?: string;
  externalId?: string;
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
    region = 'us-east-1',
    intervalMinutes = 1,
  } = options;

  // Determine time range - default to last N minutes if not specified
  const now = Date.now();
  const fetchStartTime = startTime || subMinutes(now, intervalMinutes).getTime();
  const fetchEndTime = endTime || now;

  console.log(
    `Fetching logs from ${logGroupName} for time range: ${new Date(fetchStartTime).toISOString()} to ${new Date(fetchEndTime).toISOString()}`
  );

  // Create CloudWatch Logs client - with or without role assumption
  let logsClient;
  if (roleArn) {
    console.log(`Assuming role: ${roleArn}`);
    const credentials = await assumeRole(roleArn, externalId);
    logsClient = createAssumedRoleCloudWatchLogsClient(credentials, region);
  } else {
    logsClient = createCloudWatchLogsClient(region);
  }

  const params: FilterLogEventsCommandInput = {
    logGroupName,
    startTime: fetchStartTime,
    endTime: fetchEndTime,
    limit: 1000, // Max events per request
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
          message: event.message || '',
          logStreamName: event.logStreamName,
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
      `Failed to fetch CloudWatch logs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Stubbed function for tracking last read time - to be implemented later
export function getLastReadTime(
  logGroupName: string,
  awsAccountId: string
): number {
  // TODO: Implement persistent storage (DynamoDB, Parameter Store, etc.)
  // For now, return 1 minute ago as a simple time-based approach
  console.log(
    `[STUB] Getting last read time for ${logGroupName} in account ${awsAccountId}`
  );
  return subMinutes(Date.now(), 1).getTime();
}

export function updateLastReadTime(
  logGroupName: string,
  awsAccountId: string,
  timestamp: number
): void {
  // TODO: Implement persistent storage
  console.log(
    `[STUB] Updating last read time for ${logGroupName} in account ${awsAccountId} to ${new Date(timestamp).toISOString()}`
  );
}
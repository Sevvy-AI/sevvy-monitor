import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { dynamoDBService } from "../../shared/dynamodb.js";
import { subMinutes } from "date-fns";
import { LogEvent } from "@/shared/types.js";

const DATADOG_LOGS_PER_PAGE = 1000;

export interface DatadogCredentials {
  apiKey: string;
  appKey: string;
}

export interface DatadogFetchOptions {
  secretArn: string;
  datadogSite: string;
  logIndex: string;
  minuteTimestamp: number;
}

interface DatadogLogAttributes {
  timestamp: number;
  message: string;
  status?: string;
  service?: string;
  host?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface DatadogLogEntry {
  id: string;
  attributes: DatadogLogAttributes;
}

interface DatadogLogsResponse {
  data: DatadogLogEntry[];
  meta?: {
    page?: {
      after?: string;
    };
  };
}

const cachedCredentials: Map<string, DatadogCredentials> = new Map();

export async function getDatadogCredentials(
  secretArn: string
): Promise<DatadogCredentials> {
  if (cachedCredentials.has(secretArn)) {
    return cachedCredentials.get(secretArn)!;
  }

  const region = process.env.AWS_REGION || "us-east-1";
  const secretsClient = new SecretsManagerClient({ region });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    const secretData = JSON.parse(response.SecretString);

    if (!secretData.apiKey || !secretData.appKey) {
      throw new Error(
        "Invalid credentials format in secret. Expected keys: apiKey, appKey"
      );
    }

    const credentials: DatadogCredentials = {
      apiKey: secretData.apiKey,
      appKey: secretData.appKey,
    };

    cachedCredentials.set(secretArn, credentials);
    return credentials;
  } catch (error) {
    console.error(
      "Error retrieving Datadog credentials from Secrets Manager:",
      error
    );
    throw new Error(
      `Failed to retrieve Datadog credentials: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function fetchDatadogLogsForMinute(
  options: DatadogFetchOptions
): Promise<LogEvent[]> {
  const { secretArn, datadogSite, logIndex, minuteTimestamp } = options;

  console.log(
    `Fetching Datadog logs for minute: ${new Date(minuteTimestamp).toISOString()}`
  );

  try {
    const credentials = await getDatadogCredentials(secretArn);

    const startTime = minuteTimestamp;
    const endTime = minuteTimestamp + 60000;

    const allLogs: LogEvent[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(
        `Fetching page ${pageCount}${cursor ? ` with cursor` : " (first page)"}`
      );

      const queryParams: Record<string, string> = {
        "filter[from]": startTime.toString(),
        "filter[to]": endTime.toString(),
        "filter[query]": `index:${logIndex}`,
        "page[limit]": DATADOG_LOGS_PER_PAGE.toString(),
        sort: "timestamp",
      };

      if (cursor) {
        queryParams["page[cursor]"] = cursor;
      }

      const queryString = Object.entries(queryParams)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        )
        .join("&");

      const url = `${datadogSite}/api/v2/logs/events?${queryString}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "DD-API-KEY": credentials.apiKey,
          "DD-APPLICATION-KEY": credentials.appKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Datadog API error: ${response.status} ${response.statusText}`,
          errorText
        );

        if (response.status === 429) {
          console.warn("Rate limit reached, returning logs fetched so far");
          break;
        }

        throw new Error(
          `Datadog API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as DatadogLogsResponse;

      if (data.data && data.data.length > 0) {
        const logs = data.data.map(log => {
          const service = log.attributes.service || "unknown";
          const status = log.attributes.status || "info";
          const message = log.attributes.message || "";
          const formattedMessage = `[${service}] [${status}] ${message}`;

          return {
            timestamp: log.attributes.timestamp,
            message: formattedMessage,
          };
        });

        allLogs.push(...logs);
        console.log(`Fetched ${logs.length} logs from page ${pageCount}`);
      } else {
        console.log(`No logs in page ${pageCount}`);
      }

      cursor = data.meta?.page?.after;
    } while (cursor);

    if (allLogs.length === 0) {
      console.log(
        `No log events found for minute ${new Date(minuteTimestamp).toISOString()}`
      );
    } else {
      console.log(
        `Fetched ${allLogs.length} total log events for minute ${new Date(minuteTimestamp).toISOString()} across ${pageCount} page(s)`
      );
    }

    return allLogs;
  } catch (error) {
    console.error(
      `Error fetching logs from Datadog for minute ${new Date(minuteTimestamp).toISOString()}:`,
      error
    );
    throw new Error(
      `Failed to fetch Datadog logs: ${error instanceof Error ? error.message : "Unknown error"}`
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

import {
  ListObjectsV2Command,
  GetObjectCommand,
  ListObjectsV2CommandInput,
} from "@aws-sdk/client-s3";
import { gunzip } from "zlib";
import { promisify } from "util";
import { Readable } from "stream";
import { createS3Client, formatS3Path } from "./utils.js";
import { dynamoDBService } from "../../shared/dynamodb.js";
import { subMinutes } from "date-fns";
import { LogEvent } from "@/shared/types.js";

const gunzipAsync = promisify(gunzip);

export interface VercelFetchOptions {
  s3Bucket: string;
  s3Prefix?: string;
  orgId: string;
  projectName: string;
  minuteTimestamp: number;
  region?: string;
}

export interface VercelBatchFetchOptions {
  s3Bucket: string;
  s3Prefix?: string;
  orgId: string;
  projectName: string;
  minutesToRead: number[];
  region?: string;
}

interface VercelLogEntry {
  id: string;
  deploymentId: string;
  source: "build" | "edge" | "lambda" | "static" | "external" | "firewall";
  host: string;
  timestamp: number;
  projectId: string;
  level: "info" | "warning" | "error" | "fatal";
  message?: string;
  buildId?: string;
  entrypoint?: string;
  path?: string;
  type?: string;
  statusCode?: number;
  requestId?: string;
  environment?: "production" | "preview";
  projectName?: string;
  executionRegion?: string;
  proxy?: {
    timestamp: number;
    method: string;
    path: string;
    statusCode?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function parseNDJSON(content: string): Promise<LogEvent[]> {
  const lines = content.trim().split("\n");
  const logs: LogEvent[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const logEntry = JSON.parse(line) as VercelLogEntry;

      let message = logEntry.message || "";

      const parts: string[] = [];

      if (logEntry.source) {
        parts.push(`[${logEntry.source}]`);
      }

      if (logEntry.level) {
        parts.push(`[${logEntry.level}]`);
      }

      if (logEntry.projectName) {
        parts.push(`[${logEntry.projectName}]`);
      }

      if (logEntry.statusCode && logEntry.statusCode >= 400) {
        parts.push(`[${logEntry.statusCode}]`);
      }

      if (logEntry.entrypoint) {
        parts.push(`${logEntry.entrypoint}`);
      } else if (logEntry.path) {
        parts.push(`${logEntry.path}`);
      }

      const prefix = parts.length > 0 ? parts.join(" ") + " " : "";
      message = prefix + message;

      if (logEntry.proxy) {
        const proxyInfo = [
          logEntry.proxy.method,
          logEntry.proxy.path,
          logEntry.proxy.statusCode ? `(${logEntry.proxy.statusCode})` : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (proxyInfo) {
          message += ` | Request: ${proxyInfo}`;
        }
      }

      if (!message.trim()) {
        message = JSON.stringify(logEntry);
      }

      logs.push({
        timestamp: logEntry.timestamp,
        message,
      });
    } catch (error) {
      console.warn("Failed to parse Vercel NDJSON line:", line, error);
    }
  }

  return logs;
}

export async function fetchVercelLogsForMinute(
  options: VercelFetchOptions
): Promise<LogEvent[]> {
  const {
    s3Bucket,
    s3Prefix = "",
    orgId,
    projectName,
    minuteTimestamp,
    region = "us-east-1",
  } = options;

  const s3Client = createS3Client(region);
  const prefix = formatS3Path(s3Prefix, orgId, projectName, minuteTimestamp);

  console.log(
    `Fetching Vercel logs from S3: bucket=${s3Bucket}, prefix=${prefix}log.ndjson.gz`
  );

  const listParams: ListObjectsV2CommandInput = {
    Bucket: s3Bucket,
    Prefix: prefix,
    MaxKeys: 1000,
  };

  const allLogs: LogEvent[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      if (continuationToken) {
        listParams.ContinuationToken = continuationToken;
      }

      const listCommand = new ListObjectsV2Command(listParams);
      const listResponse = await s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        const minuteDate = new Date(minuteTimestamp);
        console.log(
          `No S3 objects found for minute ${minuteDate.toISOString()} ` +
            `(path: ${prefix})`
        );
        break;
      }

      const sortedObjects = listResponse.Contents.sort((a, b) =>
        (a.Key || "").localeCompare(b.Key || "")
      );

      for (const object of sortedObjects) {
        if (!object.Key) continue;

        if (!object.Key.endsWith("log.ndjson.gz")) {
          console.warn(`Skipping unexpected file: ${object.Key}`);
          continue;
        }

        console.log(`Processing S3 object: ${object.Key}`);

        try {
          const getCommand = new GetObjectCommand({
            Bucket: s3Bucket,
            Key: object.Key,
          });

          const getResponse = await s3Client.send(getCommand);

          if (!getResponse.Body) {
            console.warn(`Empty body for object: ${object.Key}`);
            continue;
          }

          const compressedBuffer = await streamToBuffer(
            getResponse.Body as Readable
          );
          const decompressedBuffer = await gunzipAsync(compressedBuffer);
          const content = decompressedBuffer.toString("utf-8");

          const logs = await parseNDJSON(content);
          allLogs.push(...logs);

          console.log(
            `Processed ${logs.length} log entries from ${object.Key}`
          );
        } catch (error) {
          console.error(`Error processing object ${object.Key}:`, error);
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);

    if (allLogs.length === 0) {
      console.log(
        `No log events found for minute ${new Date(minuteTimestamp).toISOString()} - ` +
          `logs may be delayed in S3`
      );
    } else {
      console.log(
        `Fetched ${allLogs.length} total log events for minute ${new Date(minuteTimestamp).toISOString()}`
      );
    }
    return allLogs;
  } catch (error) {
    console.error(`Error fetching logs from S3:`, error);
    throw new Error(
      `Failed to fetch Vercel logs from S3: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function fetchVercelLogsBatch(
  options: VercelBatchFetchOptions
): Promise<{ minute: number; logs: LogEvent[] }[]> {
  const results: { minute: number; logs: LogEvent[] }[] = [];

  for (const minuteTimestamp of options.minutesToRead) {
    console.log(
      `Processing minute: ${new Date(minuteTimestamp).toISOString()}`
    );

    try {
      const logs = await fetchVercelLogsForMinute({
        ...options,
        minuteTimestamp,
      });

      results.push({ minute: minuteTimestamp, logs });
    } catch (error) {
      console.error(
        `Error processing minute ${new Date(minuteTimestamp).toISOString()}:`,
        error
      );
      throw error;
    }
  }

  return results;
}

export async function getLastReadTime(
  orgId: string,
  resourceId: string
): Promise<number> {
  try {
    return await dynamoDBService.getLastReadTime(orgId, resourceId);
  } catch (error) {
    console.error("Error getting last read time from DynamoDB:", error);
    return subMinutes(Date.now(), 2).getTime();
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

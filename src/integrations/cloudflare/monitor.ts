import { detectErrorsInLogs } from "@/shared/error-detector.js";
import {
  fetchCloudflareLogsBatch,
  getLastReadTime,
  updateLastReadTime,
} from "./fetch.js";
import { getEligibleMinutes, minuteStart } from "./utils.js";
import {
  CloudflareMonitoringEvent,
  LogAgentInput,
  LogEvent,
} from "@/shared/types.js";

export interface CloudflareMonitorOptions {
  customErrorPatterns?: RegExp[];
  region?: string;
  maxMinutesPerRun?: number;
  safetyMinutes?: number;
}

export async function monitorCloudflareLogs(
  event: CloudflareMonitoringEvent,
  options: CloudflareMonitorOptions = {}
): Promise<LogAgentInput> {
  const {
    customErrorPatterns = [],
    region = "us-east-1",
    maxMinutesPerRun = parseInt(process.env.MAX_MINUTES_PER_RUN || "10", 10),
    safetyMinutes = parseInt(process.env.SAFETY_MINUTES || "1", 10),
  } = options;

  const { s3Bucket, s3Prefix, cloudflareAccountId, workerScriptName } = event;

  console.log(
    `Starting Cloudflare monitoring for worker ${workerScriptName} in account ${cloudflareAccountId}`
  );

  try {
    let lastReadTime = event.startTime;
    const currentTime = event.endTime || Date.now();

    if (!lastReadTime) {
      lastReadTime = await getLastReadTime(event.orgId, event.resourceId);
      console.log(
        `Using last read time: ${new Date(lastReadTime).toISOString()}`
      );
    }

    const minutesToRead = getEligibleMinutes(
      lastReadTime,
      currentTime,
      safetyMinutes,
      maxMinutesPerRun
    );

    if (minutesToRead.length === 0) {
      console.log("No eligible minutes to process");
      return {
        providerCode: "cloudflare",
        orgId: event.orgId,
        groupId: event.groupId,
        resourceId: event.resourceId,
        metadata: {
          cloudflareAccountId,
          workerScriptName,
          s3Bucket,
          s3Prefix: s3Prefix || "",
        },
        timeRange: {
          startTime: lastReadTime,
          endTime: currentTime,
        },
        errorDetectionResult: {
          hasError: false,
          matchedPattern: null,
          errorLines: [],
        },
      };
    }

    console.log(
      `Processing ${minutesToRead.length} minutes from ${new Date(minutesToRead[0]).toISOString()} to ${new Date(minutesToRead[minutesToRead.length - 1]).toISOString()}`
    );

    const allLogs: LogEvent[] = [];
    let lastSuccessfulMinute = lastReadTime;

    for (const minuteTimestamp of minutesToRead) {
      console.log(
        `Processing minute: ${new Date(minuteTimestamp).toISOString()}`
      );

      try {
        const batchResults = await fetchCloudflareLogsBatch({
          s3Bucket,
          s3Prefix,
          cloudflareAccountId,
          workerScriptName,
          minutesToRead: [minuteTimestamp],
          region,
        });

        if (batchResults.length > 0 && batchResults[0].logs) {
          const logs = batchResults[0].logs;
          allLogs.push(...logs);

          const errorDetectionResult = detectErrorsInLogs(
            logs,
            customErrorPatterns
          );

          if (errorDetectionResult.hasError) {
            console.log(
              `Error detected in minute ${new Date(minuteTimestamp).toISOString()}: ${errorDetectionResult.matchedPattern}`
            );
          }
        }

        lastSuccessfulMinute = minuteTimestamp + 60000;

        await updateLastReadTime(
          event.orgId,
          event.resourceId,
          lastSuccessfulMinute
        );
        console.log(
          `Advanced progress to: ${new Date(lastSuccessfulMinute).toISOString()}`
        );
      } catch (error) {
        console.error(
          `Failed to process minute ${new Date(minuteTimestamp).toISOString()}, stopping:`,
          error
        );
        break;
      }
    }

    const finalErrorDetectionResult = detectErrorsInLogs(
      allLogs,
      customErrorPatterns
    );

    console.log(
      `Monitoring completed: ${allLogs.length} events processed across ${minutesToRead.length} minutes, ${finalErrorDetectionResult.hasError ? "errors" : "no errors"} found`
    );

    const result: LogAgentInput = {
      providerCode: "cloudflare",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        cloudflareAccountId,
        workerScriptName,
        s3Bucket,
        s3Prefix: s3Prefix || "",
        minutesProcessed: minutesToRead.length.toString(),
      },
      timeRange: {
        startTime: minutesToRead.length > 0 ? minutesToRead[0] : lastReadTime,
        endTime: lastSuccessfulMinute,
      },
      errorDetectionResult: finalErrorDetectionResult,
    };

    return result;
  } catch (error) {
    console.error(
      `Error monitoring Cloudflare logs for ${workerScriptName}:`,
      error
    );

    return {
      providerCode: "cloudflare",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        cloudflareAccountId,
        workerScriptName,
        s3Bucket,
        s3Prefix: s3Prefix || "",
      },
      timeRange: {
        startTime: event.startTime || minuteStart(Date.now() - 120000),
        endTime: event.endTime || Date.now(),
      },
      errorDetectionResult: {
        hasError: false,
        matchedPattern: null,
        errorLines: [],
      },
    };
  }
}

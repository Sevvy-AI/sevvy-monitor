import { detectErrorsInLogs } from "@/shared/error-detector.js";
import {
  fetchCloudWatchLogs,
  getLastReadTime,
  updateLastReadTime,
} from "./fetch.js";
import { CloudwatchMonitoringEvent, LogAgentInput } from "@/shared/types.js";

export interface CloudWatchMonitorOptions {
  customErrorPatterns?: RegExp[];
  region?: string;
  intervalMinutes?: number;
}

export async function monitorCloudWatchLogs(
  event: CloudwatchMonitoringEvent,
  options: CloudWatchMonitorOptions = {}
): Promise<LogAgentInput> {
  const {
    customErrorPatterns = [],
    region = "us-east-1",
    intervalMinutes = 1,
  } = options;

  const { logGroupName, awsAccountNumber, roleArn, externalId } = event;

  console.log(
    `Starting CloudWatch monitoring for ${logGroupName} in account ${awsAccountNumber}`
  );

  try {
    let startTime = event.startTime;
    const endTime = event.endTime || Date.now();

    if (!startTime) {
      startTime = await getLastReadTime(event.orgId, event.resourceId);
      console.log(`Using last read time: ${new Date(startTime).toISOString()}`);
    }

    const logs = await fetchCloudWatchLogs({
      logGroupName,
      roleArn,
      externalId,
      startTime,
      endTime,
      region,
      intervalMinutes,
    });

    const errorDetectionResult = detectErrorsInLogs(logs, customErrorPatterns);

    const timestampToSave =
      logs.length > 0 ? Math.max(...logs.map(log => log.timestamp)) : endTime;
    await updateLastReadTime(event.orgId, event.resourceId, timestampToSave);

    console.log(
      `Monitoring completed: ${logs.length} events processed, ${errorDetectionResult.hasError ? "errors" : "no errors"} found`
    );

    const result: LogAgentInput = {
      providerCode: "aws",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        awsAccountNumber,
        logGroupName,
      },
      timeRange: {
        startTime,
        endTime,
      },
      errorDetectionResult,
    };

    return result;
  } catch (error) {
    console.error(
      `Error monitoring CloudWatch logs for ${logGroupName}:`,
      error
    );

    return {
      providerCode: "aws",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        awsAccountNumber,
        logGroupName,
      },
      timeRange: {
        startTime: event.startTime || Date.now() - intervalMinutes * 60 * 1000,
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

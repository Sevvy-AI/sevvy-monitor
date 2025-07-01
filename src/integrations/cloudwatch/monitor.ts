import { detectErrorsInLogs } from "@/shared/error-detector.js";
import type { MonitoringEvent, MonitoringResult } from "../../types/index.js";
import {
  fetchCloudWatchLogs,
  getLastReadTime,
  updateLastReadTime,
} from "./fetch.js";

export interface CloudWatchMonitorOptions {
  useLastReadTime?: boolean;
  customErrorPatterns?: RegExp[];
  region?: string;
  intervalMinutes?: number;
}

export async function monitorCloudWatchLogs(
  event: MonitoringEvent,
  options: CloudWatchMonitorOptions = {}
): Promise<MonitoringResult> {
  const {
    useLastReadTime = false,
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

    if (useLastReadTime && !startTime) {
      startTime = getLastReadTime(logGroupName, awsAccountNumber);
      console.log(`Using last read time: ${new Date(startTime).toISOString()}`);
    } else if (!startTime) {
      startTime = endTime - intervalMinutes * 60 * 1000;
      console.log(
        `Using interval-based time range: ${intervalMinutes} minutes`
      );
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

    const hasErrors = detectErrorsInLogs(logs, customErrorPatterns);

    // TODO: update last read time if using persistent tracking
    if (useLastReadTime && logs.length > 0) {
      const latestTimestamp = Math.max(...logs.map(log => log.timestamp));
      updateLastReadTime(logGroupName, awsAccountNumber, latestTimestamp);
    }

    console.log(
      `Monitoring completed: ${logs.length} events processed, ${hasErrors ? "errors" : "no errors"} found`
    );

    const result: MonitoringResult = {
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
      hasError: hasErrors,
    };

    return result;
  } catch (error) {
    console.error(
      `Error monitoring CloudWatch logs for ${logGroupName}:`,
      error
    );

    // TODO: update persistent storage with timestamp?

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
      hasError: false,
    };
  }
}

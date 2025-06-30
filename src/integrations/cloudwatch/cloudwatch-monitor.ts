import type { MonitoringEvent, MonitoringResult, ErrorPattern } from '../../types/index.js';
import { fetchCloudWatchLogs, getLastReadTime, updateLastReadTime } from './log-fetcher.js';
import { detectErrorsInLogs, getErrorSummary } from './error-detector.js';

export interface CloudWatchMonitorOptions {
  useLastReadTime?: boolean;
  customErrorPatterns?: ErrorPattern[];
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
    region = 'us-east-1',
    intervalMinutes = 1,
  } = options;

  const { logGroupName, awsAccountId, roleArn } = event;

  console.log(`Starting CloudWatch monitoring for ${logGroupName} in account ${awsAccountId}`);

  try {
    // Determine time range
    let startTime = event.startTime;
    let endTime = event.endTime || Date.now();

    if (useLastReadTime && !startTime) {
      startTime = getLastReadTime(logGroupName, awsAccountId);
      console.log(`Using last read time: ${new Date(startTime).toISOString()}`);
    } else if (!startTime) {
      // Default to interval-based approach
      startTime = endTime - (intervalMinutes * 60 * 1000);
      console.log(`Using interval-based time range: ${intervalMinutes} minutes`);
    }

    // Fetch logs from CloudWatch
    const logs = await fetchCloudWatchLogs({
      logGroupName,
      startTime,
      endTime,
      roleArn,
      region,
      intervalMinutes,
    });

    // Detect errors in the logs
    const errorMatches = detectErrorsInLogs(logs, customErrorPatterns);

    // Update last read time if using persistent tracking
    if (useLastReadTime && logs.length > 0) {
      const latestTimestamp = Math.max(...logs.map(log => log.timestamp));
      updateLastReadTime(logGroupName, awsAccountId, latestTimestamp);
    }

    // Generate summary
    const summary = getErrorSummary(errorMatches);
    
    console.log(`Monitoring completed: ${logs.length} events processed, ${errorMatches.length} errors found`);
    console.log('Error summary by pattern:', summary.patternCounts);

    const result: MonitoringResult = {
      logGroupName,
      awsAccountId,
      timeRange: {
        startTime,
        endTime,
      },
      totalEvents: logs.length,
      errorMatches,
      success: true,
    };

    return result;
  } catch (error) {
    console.error(`Error monitoring CloudWatch logs for ${logGroupName}:`, error);
    
    return {
      logGroupName,
      awsAccountId,
      timeRange: {
        startTime: event.startTime || Date.now() - (intervalMinutes * 60 * 1000),
        endTime: event.endTime || Date.now(),
      },
      totalEvents: 0,
      errorMatches: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function shouldTriggerAlert(result: MonitoringResult): boolean {
  // Simple logic: trigger alert if any errors are found
  return result.success && result.errorMatches.length > 0;
}
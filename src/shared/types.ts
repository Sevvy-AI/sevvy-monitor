export type ProviderCode = "aws" | "cloudflare" | "vercel" | "datadog";

export interface CloudwatchMonitoringEvent {
  logGroupName: string;
  awsAccountNumber: string;
  roleArn: string;
  externalId: string;
  orgId: string;
  groupId: string;
  resourceId: string;
  startTime?: number;
  endTime?: number;
}

export interface CloudflareMonitoringEvent {
  s3Bucket: string;
  s3Prefix?: string;
  cloudflareAccountId: string;
  workerScriptName: string;
  orgId: string;
  groupId: string;
  resourceId: string;
  startTime?: number;
  endTime?: number;
}

export interface VercelMonitoringEvent {
  projectName: string;
  orgId: string;
  groupId: string;
  resourceId: string;
  startTime?: number;
  endTime?: number;
}

export interface DatadogMonitoringEvent {
  secretArn: string;
  datadogSite: string;
  orgId: string;
  groupId: string;
  resourceId: string;
  startTime?: number;
  endTime?: number;
}

export type MonitoringEvent =
  | CloudwatchMonitoringEvent
  | CloudflareMonitoringEvent
  | VercelMonitoringEvent
  | DatadogMonitoringEvent;

export interface LogEvent {
  timestamp: number;
  message: string;
}

export interface RawLogErrorDetectionResult {
  hasError: boolean;
  matchedPattern: string | null;
  errorLines: string[];
}

export interface LogAgentInput {
  providerCode: ProviderCode;
  orgId: string;
  groupId: string;
  resourceId: string;
  metadata: Record<string, string>;
  timeRange: {
    startTime: number;
    endTime: number;
  };
  errorDetectionResult: RawLogErrorDetectionResult;
}

export interface AssumedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export interface QueueMessage {
  eventType: EventType;
  payload: LogAgentInput;
}

export const EVENT_TYPE = {
  LOG_ERROR: "log_error",
  EXECUTION_FAILURE: "execution_failure",
  DATA_ANOMALY: "data_anomaly",
} as const;

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

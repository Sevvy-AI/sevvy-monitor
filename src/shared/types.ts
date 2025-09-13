export type ProviderCode = "aws" | "cloudflare";

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

export type MonitoringEvent =
  | CloudwatchMonitoringEvent
  | CloudflareMonitoringEvent;

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

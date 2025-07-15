export type ProviderCode = "aws";

export interface MonitoringEvent {
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

export interface LogEvent {
  timestamp: number;
  message: string;
}

export interface RawLogErrorDetectionResult {
  hasError: boolean;
  matchedPattern: RegExp | null;
  errorLines: string[];
}

export interface MonitoringResult {
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

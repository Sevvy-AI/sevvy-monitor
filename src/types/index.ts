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
  hasError: boolean;
}

export interface AssumedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

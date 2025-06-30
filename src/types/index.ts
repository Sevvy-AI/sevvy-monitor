export type ProviderCode = "aws";

export interface MonitoringEvent {
  logGroupName: string;
  awsAccountId: string;
  roleArn: string;
  startTime?: number;
  endTime?: number;
}

export interface LogEvent {
  timestamp: number;
  message: string;
}

export interface MonitoringResult {
  providerCode: ProviderCode;
  resourceIdentifier: string;
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

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export interface MonitoringEvent {
  logGroupName: string;
  awsAccountId: string;
  roleArn: string;
  startTime?: number;
  endTime?: number;
  intervalMinutes?: number;
}

export interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName?: string;
}

export interface ErrorMatch {
  pattern: string;
  message: string;
  timestamp: number;
  logStreamName?: string;
  context?: string;
}

export interface MonitoringResult {
  logGroupName: string;
  awsAccountId: string;
  timeRange: {
    startTime: number;
    endTime: number;
  };
  totalEvents: number;
  errorMatches: ErrorMatch[];
  success: boolean;
  error?: string;
}

export interface AlertPayload {
  logGroupName: string;
  awsAccountId: string;
  errorMatches: ErrorMatch[];
  timestamp: number;
}

export interface AssumedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export type LambdaHandler = (
  event: APIGatewayProxyEvent | MonitoringEvent,
  context: Context
) => Promise<APIGatewayProxyResult | MonitoringResult>;

export interface ErrorPattern {
  name: string;
  regex: RegExp;
  description: string;
}
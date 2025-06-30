import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import type { AssumedCredentials } from '../types/index.js';

export async function assumeRole(
  roleArn: string,
  externalId?: string
): Promise<AssumedCredentials> {
  const stsClient = new STSClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `sevvy-monitor-${Date.now()}`,
    ExternalId: externalId,
    DurationSeconds: 3600, // 1 hour
  });

  try {
    const response = await stsClient.send(command);

    if (!response.Credentials) {
      throw new Error('Failed to assume role: No credentials returned');
    }

    const { AccessKeyId, SecretAccessKey, SessionToken } = response.Credentials;

    if (!AccessKeyId || !SecretAccessKey || !SessionToken) {
      throw new Error('Failed to assume role: Invalid credentials returned');
    }

    return {
      accessKeyId: AccessKeyId,
      secretAccessKey: SecretAccessKey,
      sessionToken: SessionToken,
    };
  } catch (error) {
    console.error('Error assuming role:', error);
    throw new Error(
      `Failed to assume role ${roleArn}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function createAssumedRoleCloudWatchLogsClient(
  credentials: AssumedCredentials,
  region = 'us-east-1'
): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
  });
}

export function createCloudWatchLogsClient(
  region = 'us-east-1'
): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region,
  });
}
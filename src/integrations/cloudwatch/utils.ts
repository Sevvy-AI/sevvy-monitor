import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import type { AssumedCredentials, MonitoringEvent } from "../../types/index.js";

interface AwsCredentials {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
}

let cachedCredentials: AwsCredentials | null = null;

async function getAwsCredentialsFromSecretsManager(): Promise<AwsCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const secretName =
    process.env.AWS_CREDENTIALS_SECRET_NAME || "sevvy-monitor/aws-credentials";
  const region = process.env.AWS_REGION || "us-east-1";

  const secretsClient = new SecretsManagerClient({ region });

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    const credentials = JSON.parse(response.SecretString) as AwsCredentials;

    if (!credentials.AWS_ACCESS_KEY_ID || !credentials.AWS_SECRET_ACCESS_KEY) {
      throw new Error("Invalid credentials format in secret");
    }

    cachedCredentials = credentials;
    return credentials;
  } catch (error) {
    console.error("Error retrieving credentials from Secrets Manager:", error);
    throw new Error(
      `Failed to retrieve AWS credentials from Secrets Manager: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function assumeRole(
  roleArn: string,
  externalId: string
): Promise<AssumedCredentials> {
  console.log("Retrieving AWS credentials from Secrets Manager");
  const credentials = await getAwsCredentialsFromSecretsManager();
  const accessKeyId = credentials.AWS_ACCESS_KEY_ID;
  const secretAccessKey = credentials.AWS_SECRET_ACCESS_KEY;

  const stsClient = new STSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: `sevvy-monitor-${Date.now()}`,
    ExternalId: externalId,
    DurationSeconds: 3600,
  });

  try {
    const response = await stsClient.send(command);

    if (!response.Credentials) {
      throw new Error("Failed to assume role: No credentials returned");
    }

    const { AccessKeyId, SecretAccessKey, SessionToken } = response.Credentials;

    if (!AccessKeyId || !SecretAccessKey || !SessionToken) {
      throw new Error("Failed to assume role: Invalid credentials returned");
    }

    return {
      accessKeyId: AccessKeyId,
      secretAccessKey: SecretAccessKey,
      sessionToken: SessionToken,
    };
  } catch (error) {
    console.error("Error assuming role:", error);
    throw new Error(
      `Failed to assume role ${roleArn}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export function createAssumedRoleCloudWatchLogsClient(
  credentials: AssumedCredentials,
  region = "us-east-1"
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

export function validateMonitoringEvent(event: MonitoringEvent): string | null {
  if (!event.logGroupName) {
    return "logGroupName is required";
  }

  if (!event.awsAccountNumber) {
    return "awsAccountNumber is required";
  }

  if (!event.roleArn) {
    return "roleArn is required";
  }

  if (!event.orgId) {
    return "orgId is required";
  }

  if (!event.groupId) {
    return "groupId is required";
  }

  if (!event.resourceId) {
    return "resourceId is required";
  }

  const roleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
  if (!roleArnPattern.test(event.roleArn)) {
    return "roleArn must be a valid IAM role ARN";
  }

  if (!/^\d{12}$/.test(event.awsAccountNumber)) {
    return "awsAccountNumber must be a 12-digit AWS account ID";
  }

  return null;
}

export function createCloudWatchLogsClient(
  region = "us-east-1"
): CloudWatchLogsClient {
  return new CloudWatchLogsClient({
    region,
  });
}

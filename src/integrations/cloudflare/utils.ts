import { CloudflareMonitoringEvent } from "@/shared/types";
import { S3Client } from "@aws-sdk/client-s3";

export function validateCloudflareMonitoringEvent(
  event: CloudflareMonitoringEvent
): string | null {
  if (!event.s3Bucket) {
    return "s3Bucket is required for Cloudflare monitoring";
  }

  if (!event.cloudflareAccountId) {
    return "cloudflareAccountId is required for Cloudflare monitoring";
  }

  if (!event.workerScriptName) {
    return "workerScriptName is required for Cloudflare monitoring";
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

  return null;
}

export function createS3Client(region = "us-east-1"): S3Client {
  return new S3Client({ region });
}

export function minuteStart(timestampMs: number): number {
  return timestampMs - (timestampMs % 60000);
}

export function formatS3Path(
  prefix: string,
  cloudflareAccountId: string,
  workerScriptName: string,
  minuteTimestamp: number
): string {
  const date = new Date(minuteTimestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  const basePrefix = prefix ? `${prefix.replace(/\/$/, "")}/` : "";

  return `${basePrefix}${cloudflareAccountId}/${workerScriptName}/${year}/${month}/${day}/${hour}/${minute}/`;
}

export function getEligibleMinutes(
  lastReadTime: number,
  currentTime: number,
  safetyMinutes: number = 1,
  maxMinutesPerRun: number = 10
): number[] {
  const startMinute = minuteStart(lastReadTime);
  const eligibleEnd = minuteStart(currentTime) - safetyMinutes * 60000;

  const minutes: number[] = [];
  let currentMinute = startMinute;

  while (currentMinute < eligibleEnd && minutes.length < maxMinutesPerRun) {
    minutes.push(currentMinute);
    currentMinute += 60000;
  }

  return minutes;
}

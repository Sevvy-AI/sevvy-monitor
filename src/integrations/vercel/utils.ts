import { VercelMonitoringEvent } from "@/shared/types";
import { S3Client } from "@aws-sdk/client-s3";

export function validateVercelMonitoringEvent(
  event: VercelMonitoringEvent
): string | null {
  if (!event.projectName || event.projectName.trim() === "") {
    return "projectName is required and must be non-empty for Vercel monitoring";
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
  orgId: string,
  projectName: string,
  minuteTimestamp: number
): string {
  const date = new Date(minuteTimestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");

  const basePrefix = prefix ? `${prefix.replace(/\/$/, "")}/` : "";

  return `${basePrefix}${orgId}/${projectName}/${year}/${month}/${day}/${hour}/${minute}/`;
}

export function getEligibleMinutes(
  lastReadTime: number,
  currentTime: number,
  safetyMinutes: number = 1,
  maxMinutesPerRun: number = 120
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

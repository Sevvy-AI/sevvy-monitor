import { DatadogMonitoringEvent } from "@/shared/types";

export function validateDatadogMonitoringEvent(
  event: DatadogMonitoringEvent
): string | null {
  if (!event.secretArn || event.secretArn.trim() === "") {
    return "secretArn is required and must be non-empty for Datadog monitoring";
  }

  if (!event.datadogSite || event.datadogSite.trim() === "") {
    return "datadogSite is required and must be non-empty for Datadog monitoring";
  }

  try {
    new URL(event.datadogSite);
  } catch {
    return "datadogSite must be a valid URL";
  }

  if (!event.logIndex || event.logIndex.trim() === "") {
    return "logIndex is required and must be non-empty for Datadog monitoring";
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

export function minuteStart(timestampMs: number): number {
  return timestampMs - (timestampMs % 60000);
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

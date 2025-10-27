import { detectErrorsInLogs } from "@/shared/error-detector.js";
import {
  fetchVercelLogsBatch,
  getLastReadTime,
  updateLastReadTime,
} from "./fetch.js";
import { getEligibleMinutes, minuteStart } from "./utils.js";
import {
  VercelMonitoringEvent,
  LogAgentInput,
  LogEvent,
} from "@/shared/types.js";

const VERCEL_S3_PREFIX = "vercel-logs";

export interface VercelMonitorOptions {
  customErrorPatterns?: RegExp[];
  region?: string;
  maxMinutesOfLogsPerRun?: number;
  safetyMinutes?: number;
}

export async function monitorVercelLogs(
  event: VercelMonitoringEvent,
  options: VercelMonitorOptions = {}
): Promise<LogAgentInput> {
  const {
    customErrorPatterns = [],
    region = "us-east-1",
    maxMinutesOfLogsPerRun = parseInt(
      process.env.MAX_MINUTES_PER_RUN || "120",
      10
    ),
    safetyMinutes = parseInt(process.env.SAFETY_MINUTES || "1", 10),
  } = options;

  const s3Bucket = process.env.VERCEL_LOGS_S3_BUCKET;
  const s3Prefix = VERCEL_S3_PREFIX;

  if (!s3Bucket) {
    throw new Error("VERCEL_LOGS_S3_BUCKET environment variable is required");
  }

  const { orgId, projectName } = event;

  console.log(
    `Starting Vercel monitoring for project ${projectName} in org ${orgId}`
  );
  console.log(`Using S3: s3://${s3Bucket}/${s3Prefix}/`);

  try {
    let lastReadTime = event.startTime;
    const currentTime = event.endTime || Date.now();

    if (!lastReadTime) {
      lastReadTime = await getLastReadTime(event.orgId, event.resourceId);
      console.log(
        `Using last read time: ${new Date(lastReadTime).toISOString()}`
      );
    }

    const minutesToRead = getEligibleMinutes(
      lastReadTime,
      currentTime,
      safetyMinutes,
      maxMinutesOfLogsPerRun
    );

    if (minutesToRead.length === 0) {
      console.log("No eligible minutes to process");
      return {
        providerCode: "vercel",
        orgId: event.orgId,
        groupId: event.groupId,
        resourceId: event.resourceId,
        metadata: {
          projectName,
          s3Bucket,
          s3Prefix,
        },
        timeRange: {
          startTime: lastReadTime,
          endTime: currentTime,
        },
        errorDetectionResult: {
          hasError: false,
          matchedPattern: null,
          errorLines: [],
        },
      };
    }

    console.log(
      `Processing ${minutesToRead.length} minute(s) starting from ${new Date(minutesToRead[0]).toISOString()}` +
        (minutesToRead.length > 1
          ? ` to ${new Date(minutesToRead[minutesToRead.length - 1]).toISOString()}`
          : "")
    );

    const allLogs: LogEvent[] = [];
    let lastSuccessfulMinute = lastReadTime;
    let earliestErrorTimestamp: number | undefined;
    let latestErrorTimestamp: number | undefined;

    for (const minuteTimestamp of minutesToRead) {
      console.log(
        `Processing minute: ${new Date(minuteTimestamp).toISOString()}`
      );

      try {
        const batchResults = await fetchVercelLogsBatch({
          s3Bucket,
          s3Prefix,
          orgId,
          projectName,
          minutesToRead: [minuteTimestamp],
          region,
        });

        const hasLogs =
          batchResults.length > 0 &&
          batchResults[0].logs &&
          batchResults[0].logs.length > 0;

        if (hasLogs) {
          const logs = batchResults[0].logs;
          allLogs.push(...logs);

          console.log(
            `Found ${logs.length} log events for minute ${new Date(minuteTimestamp).toISOString()}`
          );

          const errorDetectionResult = detectErrorsInLogs(
            logs,
            customErrorPatterns
          );

          if (errorDetectionResult.hasError) {
            console.log(
              `Error detected in minute ${new Date(minuteTimestamp).toISOString()}: ${errorDetectionResult.matchedPattern}`
            );
            if (
              "errorTimestamp" in errorDetectionResult &&
              errorDetectionResult.errorTimestamp
            ) {
              if (
                !earliestErrorTimestamp ||
                errorDetectionResult.errorTimestamp < earliestErrorTimestamp
              ) {
                earliestErrorTimestamp = errorDetectionResult.errorTimestamp;
              }
              if (
                !latestErrorTimestamp ||
                errorDetectionResult.errorTimestamp > latestErrorTimestamp
              ) {
                latestErrorTimestamp = errorDetectionResult.errorTimestamp;
              }
            }
          }

          lastSuccessfulMinute = minuteTimestamp + 60000;
          await updateLastReadTime(
            event.orgId,
            event.resourceId,
            lastSuccessfulMinute
          );
          console.log(
            `Advanced progress to: ${new Date(lastSuccessfulMinute).toISOString()}`
          );
        } else {
          const timeSinceMinute = currentTime - minuteTimestamp;
          const tenMinutesInMs = 10 * 60 * 1000;

          if (timeSinceMinute > tenMinutesInMs) {
            console.log(
              `No logs found for minute ${new Date(minuteTimestamp).toISOString()}, ` +
                `checking for next available logs (we're ${Math.floor(timeSinceMinute / 60000)} minutes past this timestamp)`
            );

            const searchTimestamp = minuteTimestamp + 60000;
            let foundLogs = false;

            const searchCandidates = [searchTimestamp];

            if (currentTime - searchTimestamp > tenMinutesInMs) {
              for (
                let offset = tenMinutesInMs;
                searchTimestamp + offset < currentTime - safetyMinutes * 60000;
                offset += tenMinutesInMs
              ) {
                searchCandidates.push(searchTimestamp + offset);
              }
            }

            for (const candidateTimestamp of searchCandidates) {
              console.log(
                `Searching for logs at ${new Date(candidateTimestamp).toISOString()}`
              );

              try {
                const searchResults = await fetchVercelLogsBatch({
                  s3Bucket,
                  s3Prefix,
                  orgId,
                  projectName,
                  minutesToRead: [candidateTimestamp],
                  region,
                });

                if (
                  searchResults.length > 0 &&
                  searchResults[0].logs &&
                  searchResults[0].logs.length > 0
                ) {
                  console.log(
                    `Found logs at ${new Date(candidateTimestamp).toISOString()}, ` +
                      `now backfilling from ${new Date(minuteTimestamp + 60000).toISOString()} to process any skipped minutes`
                  );

                  const backfillStart = minuteTimestamp + 60000;
                  const backfillEnd = candidateTimestamp;
                  const backfillMinutes: number[] = [];

                  for (
                    let backfillMinute = backfillStart;
                    backfillMinute <= backfillEnd;
                    backfillMinute += 60000
                  ) {
                    backfillMinutes.push(backfillMinute);
                  }

                  console.log(
                    `Backfilling ${backfillMinutes.length} minute(s) from ${new Date(backfillStart).toISOString()} to ${new Date(backfillEnd).toISOString()}`
                  );

                  for (const backfillMinute of backfillMinutes) {
                    try {
                      const backfillResults = await fetchVercelLogsBatch({
                        s3Bucket,
                        s3Prefix,
                        orgId,
                        projectName,
                        minutesToRead: [backfillMinute],
                        region,
                      });

                      if (
                        backfillResults.length > 0 &&
                        backfillResults[0].logs &&
                        backfillResults[0].logs.length > 0
                      ) {
                        const logs = backfillResults[0].logs;
                        allLogs.push(...logs);

                        console.log(
                          `Backfilled ${logs.length} log events for minute ${new Date(backfillMinute).toISOString()}`
                        );

                        const errorDetectionResult = detectErrorsInLogs(
                          logs,
                          customErrorPatterns
                        );

                        if (errorDetectionResult.hasError) {
                          console.log(
                            `Error detected during backfill in minute ${new Date(backfillMinute).toISOString()}: ${errorDetectionResult.matchedPattern}`
                          );
                          if (
                            "errorTimestamp" in errorDetectionResult &&
                            errorDetectionResult.errorTimestamp
                          ) {
                            if (
                              !earliestErrorTimestamp ||
                              errorDetectionResult.errorTimestamp <
                                earliestErrorTimestamp
                            ) {
                              earliestErrorTimestamp =
                                errorDetectionResult.errorTimestamp;
                            }
                            if (
                              !latestErrorTimestamp ||
                              errorDetectionResult.errorTimestamp >
                                latestErrorTimestamp
                            ) {
                              latestErrorTimestamp =
                                errorDetectionResult.errorTimestamp;
                            }
                          }
                        }
                      } else {
                        console.log(
                          `No logs found during backfill for minute ${new Date(backfillMinute).toISOString()}`
                        );
                      }
                    } catch (backfillError) {
                      console.error(
                        `Error during backfill for minute ${new Date(backfillMinute).toISOString()}:`,
                        backfillError
                      );
                    }
                  }

                  lastSuccessfulMinute = candidateTimestamp;
                  await updateLastReadTime(
                    event.orgId,
                    event.resourceId,
                    lastSuccessfulMinute
                  );
                  console.log(
                    `After backfill, advanced progress to: ${new Date(lastSuccessfulMinute).toISOString()}`
                  );
                  foundLogs = true;
                  break;
                }
              } catch (searchError) {
                console.error(
                  `Error searching for logs at ${new Date(candidateTimestamp).toISOString()}:`,
                  searchError
                );
              }
            }

            if (!foundLogs) {
              console.log(
                `No logs found in any search candidates, will retry on next invocation`
              );
            }
            break;
          } else {
            console.log(
              `No logs found for minute ${new Date(minuteTimestamp).toISOString()}, ` +
                `not advancing lastReadTime - will retry on next invocation ` +
                `(only ${Math.floor(timeSinceMinute / 60000)} minutes old)`
            );
            break;
          }
        }
      } catch (error) {
        console.error(
          `Failed to process minute ${new Date(minuteTimestamp).toISOString()}, stopping:`,
          error
        );
        break;
      }
    }

    const finalErrorDetectionResult = detectErrorsInLogs(
      allLogs,
      customErrorPatterns
    );

    console.log(
      `Monitoring completed: ${allLogs.length} events processed across ${minutesToRead.length} minutes, ${finalErrorDetectionResult.hasError ? "alerts" : "no alerts"} needed`
    );

    let timeRangeStart: number;
    let timeRangeEnd: number;

    if (
      finalErrorDetectionResult.hasError &&
      earliestErrorTimestamp &&
      latestErrorTimestamp
    ) {
      timeRangeStart = earliestErrorTimestamp - 60000;
      timeRangeEnd = latestErrorTimestamp + 60000;
      console.log(
        `Using error-based time range: ${new Date(timeRangeStart).toISOString()} to ${new Date(timeRangeEnd).toISOString()}`
      );
    } else {
      timeRangeStart =
        minutesToRead.length > 0 ? minutesToRead[0] : lastReadTime;
      timeRangeEnd = lastSuccessfulMinute;
    }

    const result: LogAgentInput = {
      providerCode: "vercel",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        projectName,
        s3Bucket,
        s3Prefix: s3Prefix || "",
        minutesProcessed: minutesToRead.length.toString(),
      },
      timeRange: {
        startTime: timeRangeStart,
        endTime: timeRangeEnd,
      },
      errorDetectionResult: finalErrorDetectionResult,
    };

    return result;
  } catch (error) {
    console.error(
      `Error monitoring Vercel logs for ${event.projectName}:`,
      error
    );

    const s3Bucket = process.env.VERCEL_LOGS_S3_BUCKET || "unknown";
    const s3Prefix = VERCEL_S3_PREFIX;

    return {
      providerCode: "vercel",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        projectName: event.projectName,
        s3Bucket,
        s3Prefix,
      },
      timeRange: {
        startTime: event.startTime || minuteStart(Date.now() - 120000),
        endTime: event.endTime || Date.now(),
      },
      errorDetectionResult: {
        hasError: false,
        matchedPattern: null,
        errorLines: [],
      },
    };
  }
}

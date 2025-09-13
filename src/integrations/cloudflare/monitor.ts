import { detectErrorsInLogs } from "@/shared/error-detector.js";
import {
  fetchCloudflareLogsBatch,
  getLastReadTime,
  updateLastReadTime,
} from "./fetch.js";
import { getEligibleMinutes, minuteStart } from "./utils.js";
import {
  CloudflareMonitoringEvent,
  LogAgentInput,
  LogEvent,
} from "@/shared/types.js";

export interface CloudflareMonitorOptions {
  customErrorPatterns?: RegExp[];
  region?: string;
  maxMinutesOfLogsPerRun?: number;
  safetyMinutes?: number;
}

export async function monitorCloudflareLogs(
  event: CloudflareMonitoringEvent,
  options: CloudflareMonitorOptions = {}
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

  const { s3Bucket, s3Prefix, cloudflareAccountId, workerScriptName } = event;

  console.log(
    `Starting Cloudflare monitoring for worker ${workerScriptName} in account ${cloudflareAccountId}`
  );

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
        providerCode: "cloudflare",
        orgId: event.orgId,
        groupId: event.groupId,
        resourceId: event.resourceId,
        metadata: {
          cloudflareAccountId,
          workerScriptName,
          s3Bucket,
          s3Prefix: s3Prefix || "",
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

    for (const minuteTimestamp of minutesToRead) {
      console.log(
        `Processing minute: ${new Date(minuteTimestamp).toISOString()}`
      );

      try {
        const batchResults = await fetchCloudflareLogsBatch({
          s3Bucket,
          s3Prefix,
          cloudflareAccountId,
          workerScriptName,
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
                const searchResults = await fetchCloudflareLogsBatch({
                  s3Bucket,
                  s3Prefix,
                  cloudflareAccountId,
                  workerScriptName,
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
                      const backfillResults = await fetchCloudflareLogsBatch({
                        s3Bucket,
                        s3Prefix,
                        cloudflareAccountId,
                        workerScriptName,
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
                      // Continue with next minute even if one fails
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
      `Monitoring completed: ${allLogs.length} events processed across ${minutesToRead.length} minutes, ${finalErrorDetectionResult.hasError ? "errors" : "no errors"} found`
    );

    const result: LogAgentInput = {
      providerCode: "cloudflare",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        cloudflareAccountId,
        workerScriptName,
        s3Bucket,
        s3Prefix: s3Prefix || "",
        minutesProcessed: minutesToRead.length.toString(),
      },
      timeRange: {
        startTime: minutesToRead.length > 0 ? minutesToRead[0] : lastReadTime,
        endTime: lastSuccessfulMinute,
      },
      errorDetectionResult: finalErrorDetectionResult,
    };

    return result;
  } catch (error) {
    console.error(
      `Error monitoring Cloudflare logs for ${workerScriptName}:`,
      error
    );

    return {
      providerCode: "cloudflare",
      orgId: event.orgId,
      groupId: event.groupId,
      resourceId: event.resourceId,
      metadata: {
        cloudflareAccountId,
        workerScriptName,
        s3Bucket,
        s3Prefix: s3Prefix || "",
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

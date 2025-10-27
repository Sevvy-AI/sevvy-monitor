import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { monitorVercelLogs } from "../integrations/vercel/monitor.js";
import { SqsQueueClient } from "@/shared/sqs-queue.js";
import { validateVercelMonitoringEvent } from "@/integrations/vercel/utils.js";
import { VercelMonitoringEvent, LogAgentInput } from "@/shared/types.js";

export const handler = async (
  event: APIGatewayProxyEvent | VercelMonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | LogAgentInput> => {
  console.log("Vercel Lambda handler started");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    let monitoringEvent: VercelMonitoringEvent;

    if ("httpMethod" in event) {
      if (!event.body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Missing request body",
            message: "Request body must contain monitoring parameters",
          }),
        };
      }

      try {
        monitoringEvent = JSON.parse(event.body);
      } catch (parseError) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Invalid JSON in request body",
            message:
              parseError instanceof Error
                ? parseError.message
                : "Unknown parsing error",
          }),
        };
      }
    } else {
      monitoringEvent = event as VercelMonitoringEvent;
    }

    const validationError = validateVercelMonitoringEvent(monitoringEvent);
    if (validationError) {
      const errorResponse = {
        error: "Invalid monitoring parameters",
        message: validationError,
      };

      if ("httpMethod" in event) {
        return {
          statusCode: 400,
          body: JSON.stringify(errorResponse),
        };
      } else {
        const s3Bucket = process.env.VERCEL_LOGS_S3_BUCKET || "unknown";
        const s3Prefix = "vercel-logs";

        return {
          providerCode: "vercel",
          orgId: monitoringEvent.orgId,
          groupId: monitoringEvent.groupId,
          resourceId: monitoringEvent.resourceId,
          metadata: {
            projectName: monitoringEvent.projectName,
            s3Bucket,
            s3Prefix,
          },
          timeRange: {
            startTime: Date.now() - 60000,
            endTime: Date.now(),
          },
          errorDetectionResult: {
            hasError: false,
            matchedPattern: null,
            errorLines: [],
          },
        };
      }
    }

    console.log(
      `Starting monitoring for Vercel project: ${monitoringEvent.projectName} in org: ${monitoringEvent.orgId}`
    );
    const result = await monitorVercelLogs(monitoringEvent, {
      region: process.env.AWS_REGION || "us-east-1",
    });

    if (result.errorDetectionResult.hasError) {
      console.log(
        "Alert needed! Enqueuing message for Vercel project: " +
          monitoringEvent.projectName
      );
      const queueClient = new SqsQueueClient();
      const messageSent = await queueClient.sendAlert(result);
      if (!messageSent) {
        console.warn("Failed to enqueue message, but continuing with response");
      }
    } else {
      console.log("No alert needed");
    }

    if ("httpMethod" in event) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(result, null, 2),
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error("Unexpected error in Vercel handler:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorResponse = {
      error: "Internal server error",
      message: errorMessage,
    };

    if ("httpMethod" in event) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorResponse),
      };
    } else {
      const s3Bucket = process.env.VERCEL_LOGS_S3_BUCKET || "unknown";
      const s3Prefix = "vercel-logs";

      return {
        providerCode: "vercel",
        orgId: "unknown",
        groupId: "unknown",
        resourceId: "unknown",
        metadata: {
          projectName: "unknown",
          s3Bucket,
          s3Prefix,
        },
        timeRange: {
          startTime: Date.now() - 60000,
          endTime: Date.now(),
        },
        errorDetectionResult: {
          hasError: false,
          matchedPattern: null,
          errorLines: [],
        },
      };
    }
  }
};

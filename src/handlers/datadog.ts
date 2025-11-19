import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { monitorDatadogLogs } from "../integrations/datadog/monitor.js";
import { SqsQueueClient } from "@/shared/sqs-queue.js";
import { validateDatadogMonitoringEvent } from "@/integrations/datadog/utils.js";
import { DatadogMonitoringEvent, LogAgentInput } from "@/shared/types.js";

export const handler = async (
  event: APIGatewayProxyEvent | DatadogMonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | LogAgentInput> => {
  console.log("Datadog Lambda handler started");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    let monitoringEvent: DatadogMonitoringEvent;

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
      monitoringEvent = event as DatadogMonitoringEvent;
    }

    const validationError = validateDatadogMonitoringEvent(monitoringEvent);
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
        return {
          providerCode: "datadog",
          orgId: monitoringEvent.orgId,
          groupId: monitoringEvent.groupId,
          resourceId: monitoringEvent.resourceId,
          metadata: {
            datadogSite: monitoringEvent.datadogSite || "unknown",
            secretArn: monitoringEvent.secretArn || "unknown",
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
      `Starting monitoring for Datadog org: ${monitoringEvent.orgId}, resource: ${monitoringEvent.resourceId}`
    );
    const result = await monitorDatadogLogs(monitoringEvent, {
      region: process.env.AWS_REGION || "us-east-1",
    });

    if (result.errorDetectionResult.hasError) {
      console.log(
        "Alert needed! Enqueuing message for Datadog resource: " +
          monitoringEvent.resourceId
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
    console.error("Unexpected error in Datadog handler:", error);

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
      return {
        providerCode: "datadog",
        orgId: "unknown",
        groupId: "unknown",
        resourceId: "unknown",
        metadata: {
          datadogSite: "unknown",
          secretArn: "unknown",
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

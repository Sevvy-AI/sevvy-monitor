import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { monitorCloudWatchLogs } from "../integrations/cloudwatch/monitor.js";
import { SqsQueueClient } from "@/shared/sqs-queue.js";
import { validateMonitoringEvent } from "@/integrations/cloudwatch/utils.js";
import { CloudwatchMonitoringEvent, LogAgentInput } from "@/shared/types.js";

export const handler = async (
  event: APIGatewayProxyEvent | CloudwatchMonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | LogAgentInput> => {
  console.log("CloudWatch Lambda handler started");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    let monitoringEvent: CloudwatchMonitoringEvent;

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
      monitoringEvent = event as CloudwatchMonitoringEvent;
    }

    const validationError = validateMonitoringEvent(monitoringEvent);
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
          providerCode: "aws",
          orgId: monitoringEvent.orgId,
          groupId: monitoringEvent.groupId,
          resourceId: monitoringEvent.resourceId,
          metadata: {
            awsAccountNumber: monitoringEvent.awsAccountNumber,
            logGroupName: monitoringEvent.logGroupName,
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
      `Starting error detection for AWS account: ${monitoringEvent.awsAccountNumber} and log group: ${monitoringEvent.logGroupName}`
    );
    const result = await monitorCloudWatchLogs(monitoringEvent, {
      region: process.env.AWS_REGION || "us-east-1",
      intervalMinutes: 1,
    });

    if (result.errorDetectionResult.hasError) {
      console.log(
        "Error found! Enqueuing message for AWS account: " +
          monitoringEvent.awsAccountNumber +
          " and log group: " +
          monitoringEvent.logGroupName
      );
      const queueClient = new SqsQueueClient();
      const messageSent = await queueClient.sendAlert(result);
      if (!messageSent) {
        console.warn("Failed to enqueue message, but continuing with response");
      }
    } else {
      console.log("No alert needed - no errors found");
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
    console.error("Unexpected error in CloudWatch handler:", error);

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
        providerCode: "aws",
        orgId: "unknown",
        groupId: "unknown",
        resourceId: "unknown",
        metadata: {
          awsAccountNumber: "unknown",
          logGroupName: "unknown",
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

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import type { MonitoringEvent, MonitoringResult } from "../types/index.js";
import { monitorCloudWatchLogs } from "../integrations/cloudwatch/monitor.js";
import { AlertApiClient } from "@/shared/send-alert.js";
import { validateMonitoringEvent } from "@/integrations/cloudwatch/utils.js";

export const handler = async (
  event: APIGatewayProxyEvent | MonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | MonitoringResult> => {
  console.log("CloudWatch Lambda handler started");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    let monitoringEvent: MonitoringEvent;

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
      monitoringEvent = event as MonitoringEvent;
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
          orgId: monitoringEvent.orgId || "unknown",
          groupId: monitoringEvent.groupId || "unknown",
          resourceId: monitoringEvent.resourceId || "unknown",
          metadata: {
            awsAccountNumber: monitoringEvent.awsAccountNumber || "unknown",
            logGroupName: monitoringEvent.logGroupName || "unknown",
          },
          timeRange: {
            startTime: Date.now() - 60000,
            endTime: Date.now(),
          },
          hasError: false,
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

    if (result.hasError) {
      console.log(
        "Error found! Sending alert for AWS account: " +
          monitoringEvent.awsAccountNumber +
          " and log group: " +
          monitoringEvent.logGroupName
      );
      const alertClient = new AlertApiClient();
      const alertSent = await alertClient.sendAlert(result);
      if (!alertSent) {
        console.warn("Failed to send alert, but continuing with response");
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
        hasError: false,
      };
    }
  }
};

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { monitorCloudflareLogs } from "../integrations/cloudflare/monitor.js";
import { AlertApiClient } from "@/shared/send-alert.js";
import { validateCloudflareMonitoringEvent } from "@/integrations/cloudflare/utils.js";
import { CloudflareMonitoringEvent, LogAgentInput } from "@/shared/types.js";

export const handler = async (
  event: APIGatewayProxyEvent | CloudflareMonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | LogAgentInput> => {
  console.log("Cloudflare Lambda handler started");
  console.log("Event:", JSON.stringify(event, null, 2));
  console.log("Context:", JSON.stringify(context, null, 2));

  try {
    let monitoringEvent: CloudflareMonitoringEvent;

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
      monitoringEvent = event as CloudflareMonitoringEvent;
    }

    const validationError = validateCloudflareMonitoringEvent(monitoringEvent);
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
          providerCode: "cloudflare",
          orgId: monitoringEvent.orgId,
          groupId: monitoringEvent.groupId,
          resourceId: monitoringEvent.resourceId,
          metadata: {
            cloudflareAccountId: monitoringEvent.cloudflareAccountId,
            workerScriptName: monitoringEvent.workerScriptName,
            s3Bucket: monitoringEvent.s3Bucket,
            s3Prefix: monitoringEvent.s3Prefix || "",
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
      `Starting error detection for Cloudflare account: ${monitoringEvent.cloudflareAccountId} and worker: ${monitoringEvent.workerScriptName}`
    );
    const result = await monitorCloudflareLogs(monitoringEvent, {
      region: process.env.AWS_REGION || "us-east-1",
    });

    if (result.errorDetectionResult.hasError) {
      console.log(
        "Error found! Sending alert for Cloudflare account: " +
          monitoringEvent.cloudflareAccountId +
          " and worker: " +
          monitoringEvent.workerScriptName
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
    console.error("Unexpected error in Cloudflare handler:", error);

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
        providerCode: "cloudflare",
        orgId: "unknown",
        groupId: "unknown",
        resourceId: "unknown",
        metadata: {
          cloudflareAccountId: "unknown",
          workerScriptName: "unknown",
          s3Bucket: "unknown",
          s3Prefix: "",
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

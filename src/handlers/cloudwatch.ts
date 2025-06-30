import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { MonitoringEvent, MonitoringResult } from '../types/index.js';
import { monitorCloudWatchLogs, shouldTriggerAlert } from '../integrations/cloudwatch/cloudwatch-monitor.js';
import { sendAlert } from '../shared/alert-api.js';

export const handler = async (
  event: APIGatewayProxyEvent | MonitoringEvent,
  context: Context
): Promise<APIGatewayProxyResult | MonitoringResult> => {
  console.log('CloudWatch Lambda handler started');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    // Parse the monitoring event
    let monitoringEvent: MonitoringEvent;

    if ('httpMethod' in event) {
      // API Gateway event - parse from body
      if (!event.body) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Missing request body',
            message: 'Request body must contain monitoring parameters',
          }),
        };
      }

      try {
        monitoringEvent = JSON.parse(event.body);
      } catch (parseError) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Invalid JSON in request body',
            message: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          }),
        };
      }
    } else {
      // Direct Lambda invocation
      monitoringEvent = event as MonitoringEvent;
    }

    // Validate required parameters
    const validationError = validateMonitoringEvent(monitoringEvent);
    if (validationError) {
      const errorResponse = {
        error: 'Invalid monitoring parameters',
        message: validationError,
      };

      if ('httpMethod' in event) {
        return {
          statusCode: 400,
          body: JSON.stringify(errorResponse),
        };
      } else {
        return {
          logGroupName: monitoringEvent.logGroupName || 'unknown',
          awsAccountId: monitoringEvent.awsAccountId || 'unknown',
          timeRange: {
            startTime: Date.now() - 60000,
            endTime: Date.now(),
          },
          totalEvents: 0,
          errorMatches: [],
          success: false,
          error: validationError,
        };
      }
    }

    // Run the CloudWatch monitoring
    console.log(`Starting monitoring for log group: ${monitoringEvent.logGroupName}`);
    const result = await monitorCloudWatchLogs(monitoringEvent, {
      useLastReadTime: false, // Stubbed for now
      region: process.env.AWS_REGION || 'us-east-1',
      intervalMinutes: monitoringEvent.intervalMinutes || 1,
    });

    // Send alert if errors were found
    if (shouldTriggerAlert(result)) {
      console.log(`Sending alert for ${result.errorMatches.length} errors found`);
      const alertSent = await sendAlert(result);
      if (!alertSent) {
        console.warn('Failed to send alert, but continuing with response');
      }
    } else {
      console.log('No alert needed - no errors found');
    }

    // Return appropriate response format
    if ('httpMethod' in event) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result, null, 2),
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error('Unexpected error in CloudWatch handler:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse = {
      error: 'Internal server error',
      message: errorMessage,
    };

    if ('httpMethod' in event) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorResponse),
      };
    } else {
      return {
        logGroupName: 'unknown',
        awsAccountId: 'unknown',
        timeRange: {
          startTime: Date.now() - 60000,
          endTime: Date.now(),
        },
        totalEvents: 0,
        errorMatches: [],
        success: false,
        error: errorMessage,
      };
    }
  }
};

function validateMonitoringEvent(event: MonitoringEvent): string | null {
  if (!event.logGroupName) {
    return 'logGroupName is required';
  }

  if (!event.awsAccountId) {
    return 'awsAccountId is required';
  }

  if (!event.roleArn) {
    return 'roleArn is required';
  }

  // Validate role ARN format
  const roleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
  if (!roleArnPattern.test(event.roleArn)) {
    return 'roleArn must be a valid IAM role ARN';
  }

  // Validate AWS account ID format
  if (!/^\d{12}$/.test(event.awsAccountId)) {
    return 'awsAccountId must be a 12-digit AWS account ID';
  }

  // Validate time range if provided
  if (event.startTime && event.endTime && event.startTime >= event.endTime) {
    return 'startTime must be before endTime';
  }

  if (event.intervalMinutes && (event.intervalMinutes < 1 || event.intervalMinutes > 60)) {
    return 'intervalMinutes must be between 1 and 60';
  }

  return null;
}
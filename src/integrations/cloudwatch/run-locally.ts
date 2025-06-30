import { handler } from "../../handlers/cloudwatch.js";
import type { MonitoringEvent } from "../../types/index.js";

async function main() {
  const event: MonitoringEvent = {
    logGroupName: "/aws/lambda/your-function-name",
    awsAccountId: "123456789012",
    roleArn: "arn:aws:iam::123456789012:role/YourMonitoringRole",
  };

  console.log("Starting CloudWatch monitoring with event:");
  console.log(JSON.stringify(event, null, 2));
  console.log("---");

  try {
    const result = await handler(event, {} as any);
    console.log("Monitoring completed successfully:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Monitoring failed:", error);
  }
}

main().catch(console.error);

import "dotenv/config";
import { handler } from "../../handlers/cloudwatch.js";
import type { MonitoringEvent } from "../../types/index.js";

async function main() {
  const event: MonitoringEvent = {
    logGroupName: "/aws/elasticbeanstalk/sevvy-test-dev/var/log/web.stdout.log",
    awsAccountNumber: "663297832605",
    roleArn: "arn:aws:iam::663297832605:role/SevvyMonitoring",
    externalId: "sevvy-663297832605",
    orgId: "org_2zpuLVftGeLYWyQ3DcCZJjK0lpg",
    groupId: "b5ba91fa-c330-4716-bf0d-65a95e95b870",
    resourceId: "44fffd75-115e-44a4-9072-b7c035c84ad3",
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

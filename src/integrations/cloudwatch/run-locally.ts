import "dotenv/config";
import { handler } from "../../handlers/cloudwatch.js";
import type { MonitoringEvent } from "../../types/index.js";

async function main() {
  const event: MonitoringEvent = {
    logGroupName: "/aws/elasticbeanstalk/sevvy-test-dev/var/log/web.stdout.log",
    awsAccountNumber: "663297832605",
    roleArn: "arn:aws:iam::663297832605:role/SevvyMonitoring",
    externalId: "sevvy-663297832605",
    orgId: "org_2yszKYUZTsEz8vzbt7MOVbnxZFX",
    groupId: "2d77eca9-be64-4989-a7b0-4be348a1b58b",
    resourceId: "81759306-28fc-4911-b021-e9553d9fecd4",
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

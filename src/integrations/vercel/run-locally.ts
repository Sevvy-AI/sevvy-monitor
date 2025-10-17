import "dotenv/config";
import { handler } from "../../handlers/vercel.js";
import { VercelMonitoringEvent } from "@/shared/types.js";

async function main() {
  const event: VercelMonitoringEvent = {
    orgId: "org_32vrOPxMxbwRxr6L01C2MvkNEby",
    projectName: "sevvy-web",
    groupId: "b5ba91fa-c330-4716-bf0d-65a95e95b870",
    resourceId: "44fffd75-115e-44a4-9072-b7c035c84ad3",
  };

  console.log("Starting Vercel monitoring with event:");
  console.log(JSON.stringify(event, null, 2));
  console.log("---");
  console.log(`S3 Bucket: ${process.env.VERCEL_LOGS_S3_BUCKET} (from env)`);
  console.log(`S3 Prefix: vercel-logs (hardcoded)`);
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

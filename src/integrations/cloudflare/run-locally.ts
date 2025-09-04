import "dotenv/config";
import { handler } from "../../handlers/cloudflare.js";
import { CloudflareMonitoringEvent } from "@/shared/types.js";

async function main() {
  const event: CloudflareMonitoringEvent = {
    s3Bucket: "example-cloudflare-logpush",
    s3Prefix: "workers/logs",
    cloudflareAccountId: "example-account-id",
    workerScriptName: "example-worker",
    orgId: "org_2zpuLVftGeLYWyQ3DcCZJjK0lpg",
    groupId: "b5ba91fa-c330-4716-bf0d-65a95e95b870",
    resourceId: "44fffd75-115e-44a4-9072-b7c035c84ad3",
  };

  console.log("Starting Cloudflare monitoring with event:");
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

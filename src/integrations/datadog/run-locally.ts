import { config } from "dotenv";
import { monitorDatadogLogs } from "./monitor.js";

config();

const testEvent = {
  secretArn:
    "arn:aws:secretsmanager:us-east-1:454953019043:secret:sevvy/datadog/org_32vrOPxMxbwRxr6L01C2MvkNEby/bfa999b5-bfa9-73fb-965d-882c214635e8-uv8lPU",
  datadogSite: "https://api.datadoghq.com",
  orgId: "org_32vrOPxMxbwRxr6L01C2MvkNEby",
  groupId: "b1b4638d-b1b4-755e-95ed-3a694cea3921",
  resourceId: "c4ab99b5-c4ab-700f-b8ca-12572ea95cc6",
};

async function runLocally() {
  console.log("Starting local Datadog monitoring test...");
  console.log("Test Event:", JSON.stringify(testEvent, null, 2));
  console.log("");

  try {
    const result = await monitorDatadogLogs(testEvent);
    console.log("\n=== Result ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("\n=== Error ===");
    console.error(error);
    process.exit(1);
  }
}

runLocally().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

import type { MonitoringResult } from "../types/index.js";
import { fetchWithTimeout } from "./utils.js";

export interface AlertApiConfig {
  apiUrl?: string;
}

export class AlertApiClient {
  private apiUrl: string;
  private timeout: number;

  constructor(config: AlertApiConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.SEVVY_SERVER_BASE_URL || "";
    this.timeout = 10000;
  }

  async sendAlert(payload: MonitoringResult): Promise<boolean> {
    if (!payload.errorDetectionResult.hasError) {
      console.log("No errors detected, not sending alert.");
      return true;
    }

    console.log("AlertApiClient.sendAlert called with payload:", {
      providerCode: payload.providerCode,
      orgId: payload.orgId,
      groupId: payload.groupId,
      resourceId: payload.resourceId,
      metadata: payload.metadata,
      timeRange: payload.timeRange,
    });

    try {
      const apiUrl = `${this.apiUrl}/api/handleError`;
      console.log("Sending alert to:", apiUrl);

      const alertPayload: MonitoringResult = {
        providerCode: payload.providerCode,
        orgId: payload.orgId,
        groupId: payload.groupId,
        resourceId: payload.resourceId,
        metadata: payload.metadata,
        timeRange: payload.timeRange,
        errorDetectionResult: payload.errorDetectionResult,
      };

      const response = await fetchWithTimeout(
        apiUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(alertPayload),
        },
        this.timeout
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}, statusText: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("Alert sent successfully:", result);
      return true;
    } catch (error) {
      console.error("Failed to send alert:", error);
      return false;
    }
  }
}

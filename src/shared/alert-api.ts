import type { AlertPayload, MonitoringResult } from '../types/index.js';

export interface AlertApiConfig {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export class AlertApiClient {
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: AlertApiConfig = {}) {
    this.apiUrl = config.apiUrl || process.env.ALERT_API_URL || 'https://api.example.com/alerts';
    this.apiKey = config.apiKey || process.env.ALERT_API_KEY;
    this.timeout = config.timeout || 10000; // 10 seconds
  }

  async sendAlert(payload: AlertPayload): Promise<boolean> {
    console.log('[STUB] AlertApiClient.sendAlert called with payload:', {
      logGroupName: payload.logGroupName,
      awsAccountId: payload.awsAccountId,
      errorCount: payload.errorMatches.length,
      timestamp: new Date(payload.timestamp).toISOString(),
    });

    // TODO: Implement actual API call
    // For now, just log and return success
    try {
      console.log('[STUB] Would send alert to:', this.apiUrl);
      console.log('[STUB] Alert payload:', JSON.stringify(payload, null, 2));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[STUB] Alert sent successfully');
      return true;
    } catch (error) {
      console.error('[STUB] Failed to send alert:', error);
      return false;
    }
  }

  async sendAlertFromMonitoringResult(result: MonitoringResult): Promise<boolean> {
    if (!result.success || result.errorMatches.length === 0) {
      console.log('[STUB] No alert needed - no errors found or monitoring failed');
      return true;
    }

    const payload: AlertPayload = {
      logGroupName: result.logGroupName,
      awsAccountId: result.awsAccountId,
      errorMatches: result.errorMatches,
      timestamp: Date.now(),
    };

    return this.sendAlert(payload);
  }
}

// Convenience function for sending alerts
export async function sendAlert(
  result: MonitoringResult,
  config?: AlertApiConfig
): Promise<boolean> {
  const client = new AlertApiClient(config);
  return client.sendAlertFromMonitoringResult(result);
}
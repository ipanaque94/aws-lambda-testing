import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import { CONFIG } from "./TestConfig";

const logsClient = new CloudWatchLogsClient({ region: CONFIG.AWS_REGION });
const cwClient = new CloudWatchClient({ region: CONFIG.AWS_REGION });

export class CloudWatchHelper {
  /**
   * Obtener logs filtrados
   */
  static async getFilteredLogs(
    filterPattern: string,
    startTimeMinutes = 5,
  ): Promise<any[]> {
    const result = await logsClient.send(
      new FilterLogEventsCommand({
        logGroupName: CONFIG.LOG_GROUP,
        filterPattern,
        startTime: Date.now() - startTimeMinutes * 60 * 1000,
      }),
    );
    return result.events || [];
  }

  /**
   * Obtener métricas de Lambda
   */
  static async getLambdaMetrics(
    metricName: "Invocations" | "Errors" | "Duration",
    startTimeMinutes = 5,
  ): Promise<any> {
    return await cwClient.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/Lambda",
        MetricName: metricName,
        Dimensions: [{ Name: "FunctionName", Value: CONFIG.LAMBDA_FUNCTION }],
        StartTime: new Date(Date.now() - startTimeMinutes * 60 * 1000),
        EndTime: new Date(),
        Period: 60,
        Statistics: ["Sum"],
      }),
    );
  }

  /**
   * Esperar a que aparezcan logs
   */
  static async waitForLogs(delayMs = 3000): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

import * as dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  AWS_REGION: "us-east-1",
  DYNAMODB_TABLE: "city",
  LAMBDA_FUNCTION: "Clima",
  LOG_GROUP: "/aws/lambda/Clima",

  // SQS
  SQS_QUEUE_URL: process.env.SQS_URL!,
  SQS_RESULTS_URL: process.env.SQS_RESULTADO_URL!,
  SQS_DLQ_URL: process.env.SQS_DLQ_URL!,

  // API Gateway (NUEVO)
  API_GATEWAY_URL: process.env.API_GATEWAY_URL!,

  // Polling
  POLLING_INTERVAL: 2000, // ms entre intentos
  MAX_ATTEMPTS: 15, // máximo de intentos para polling
  MAX_POLL_ATTEMPTS: 15,
  POLL_INTERVAL_MS: 2000,
  SQS_WAIT_TIME_SECONDS: 5,
  SQS_MAX_MESSAGES: 10,
};
if (!CONFIG.API_GATEWAY_URL) {
  console.warn("⚠️ API_GATEWAY_URL no está configurada en .env");
}

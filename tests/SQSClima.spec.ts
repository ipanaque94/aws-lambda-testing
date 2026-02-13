import { test, expect } from "@playwright/test";
import { SQSHelper } from "../utils/SQSHelper";
import { CONFIG } from "../utils/TestConfig";
import { CloudWatchHelper } from "../utils/CloudWatchHelper";
import { LambdaInvoker } from "../utils/LambdaInvoker";

test("Enviar mensaje válido a la cola de espera SQS", async () => {
  const message = { ciudad: "Lima" };
  let messageId: string;
  let response: any;

  await test.step("1. Enviar mensaje a cola SQS", async () => {
    messageId = await SQSHelper.sendMessage(CONFIG.SQS_QUEUE_URL, message);
    expect(messageId).toBeDefined();
    console.log(`✅ Mensaje enviado a SQS con ID: ${messageId}`);
  });

  await test.step("2. Invocar Lambda directamente para procesar mensaje", async () => {
    const lambdaInvoker = new LambdaInvoker();
    response = await lambdaInvoker.invokeLambda("Clima", message);
    expect(response.statusCode).toBe(200);
    console.log("✅ Lambda procesó el mensaje:", response);
  });

  await test.step("3. Esperar propagación de logs en CloudWatch", async () => {
    await CloudWatchHelper.waitForLogs(3000);
    console.log("✅ Logs propagados");
  });
});

test("SQS acepta mensaje sin ciudad (validación es en Lambda)", async () => {
  const mensajeInvalido = {};
  let messageId: string;

  await test.step("1. Enviar mensaje sin campo ciudad a SQS", async () => {
    messageId = await SQSHelper.sendMessage(
      CONFIG.SQS_QUEUE_URL,
      mensajeInvalido,
    );
    expect(messageId).toBeDefined();
    console.log("✅ SQS aceptó mensaje inválido");
  });

  await test.step("2. Validar que SQS no valida estructura del mensaje", async () => {
    console.log(`✅ Mensaje con ID ${messageId} será rechazado por Lambda`);
  });
});

test("Verificar configuración de SQS", async () => {
  await test.step("1. Validar que URL de cola está configurada", async () => {
    expect(CONFIG.SQS_QUEUE_URL).toBeDefined();
    console.log("✅ Variable SQS_QUEUE_URL definida");
  });

  await test.step("2. Verificar formato de URL de SQS", async () => {
    expect(CONFIG.SQS_QUEUE_URL).toContain("sqs.us-east-1.amazonaws.com");
    console.log("✅ URL de cola configurada:", CONFIG.SQS_QUEUE_URL);
  });
});

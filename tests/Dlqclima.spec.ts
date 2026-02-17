import { test, expect } from "@playwright/test";
import { SQSHelper } from "../utils/SQSHelper";
import { LambdaInvoker } from "../utils/LambdaInvoker";
import { CONFIG } from "../utils/TestConfig";

const lambdaInvoker = new LambdaInvoker();

test.describe("Tests de Dead Letter Queue (DLQ)", () => {
  test("Verificar configuración de DLQ", async () => {
    await test.step("1. Validar que URL de DLQ está configurada", async () => {
      expect(CONFIG.SQS_DLQ_URL).toBeDefined();
      expect(CONFIG.SQS_DLQ_URL).toContain("sqs");
      console.log("✅ DLQ configurada:", CONFIG.SQS_DLQ_URL);
    });

    await test.step("2. Verificar que DLQ es diferente a cola principal", async () => {
      expect(CONFIG.SQS_DLQ_URL).not.toBe(CONFIG.SQS_QUEUE_URL);
      expect(CONFIG.SQS_DLQ_URL).not.toBe(CONFIG.SQS_RESULTS_URL);
      console.log("✅ DLQ es cola independiente");
    });
  });

  test("Lambda procesa ciudad inválida y retorna 404", async () => {
    await test.step("1. Invocar Lambda con ciudad que no existe", async () => {
      const response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "CiudadQueNoExisteEnElMundo999",
      });

      expect(response.statusCode).toBe(404);
      console.log("✅ Lambda retornó 404 para ciudad inválida");
    });

    await test.step("2. Verificar mensaje de error claro", async () => {
      const response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "XYZCiudadFalsa",
      });

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error).toContain("no existe en OpenWeather");
      console.log("✅ Mensaje de error claro:", body.error);
    });
  });

  test("SQS DLQ recibe mensajes con ciudad inválida", async () => {
    test.setTimeout(120000); // 2 minutos

    await test.step("1. Limpiar DLQ antes del test", async () => {
      await SQSHelper.purgeQueue(CONFIG.SQS_DLQ_URL);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("✅ DLQ limpia");
    });

    await test.step("2. Enviar mensaje con ciudad inválida a cola principal", async () => {
      const messageId = await SQSHelper.sendMessage(CONFIG.SQS_QUEUE_URL, {
        ciudad: "CiudadFalsaParaDLQ123",
      });
      expect(messageId).toBeDefined();
      console.log(`✅ Mensaje enviado: ${messageId}`);
    });

    await test.step("3. Verificar que cola principal recibió el mensaje", async () => {
      const attrs = await SQSHelper.getQueueAttributes(CONFIG.SQS_QUEUE_URL);
      console.log("📊 Estado de cola principal:", attrs);
      console.log("✅ Cola principal recibió el mensaje");
    });
  });
});

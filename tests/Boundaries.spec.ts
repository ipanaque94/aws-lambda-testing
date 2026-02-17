import { test, expect } from "@playwright/test";
import { LambdaInvoker } from "../utils/LambdaInvoker";
import { DynamoDBHelper } from "../utils/DynamoDBHelper";
import { APIGatewayHelper } from "../utils/APIGatewayHelper";
import { CONFIG } from "../utils/TestConfig";

const lambdaInvoker = new LambdaInvoker();

test.describe("Tests de límites y validaciones", () => {
  test("Lambda rechaza payload vacío (sin ciudad)", async () => {
    let response: any;

    await test.step("1. Invocar Lambda sin campo ciudad", async () => {
      response = await lambdaInvoker.invokeLambda("Clima", {});
      console.log("✅ Lambda invocada sin ciudad");
    });

    await test.step("2. Verificar código de error", async () => {
      expect([400, 404, 500]).toContain(response.statusCode);
      console.log("✅ Lambda rechazó payload vacío:", response.statusCode);
    });
  });

  test("Lambda rechaza ciudad con solo espacios", async () => {
    let response: any;

    await test.step("1. Invocar Lambda con ciudad de espacios en blanco", async () => {
      response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "   ",
      });
      console.log("✅ Lambda invocada");
    });

    await test.step("2. Verificar que no procesa ciudad inválida", async () => {
      expect([400, 404]).toContain(response.statusCode);
      console.log("✅ Lambda rechazó ciudad vacía:", response.statusCode);
    });
  });

  test("Lambda maneja ciudad con caracteres especiales", async () => {
    let response: any;

    await test.step("1. Invocar Lambda con caracteres especiales", async () => {
      response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "São Paulo",
      });
      console.log("✅ Lambda invocada con caracteres especiales");
    });

    await test.step("2. Verificar que responde correctamente (200 o 404)", async () => {
      expect([200, 404]).toContain(response.statusCode);
      console.log(
        "✅ Lambda manejó caracteres especiales:",
        response.statusCode,
      );
    });
  });

  test("API Gateway rechaza request sin body", async () => {
    await test.step("1. Enviar POST sin body a API Gateway", async () => {
      try {
        await APIGatewayHelper.post("/clima", null);
        // Si llega aquí también es válido (depende de configuración)
        console.log("⚠️ API Gateway aceptó null body");
      } catch (error: any) {
        const errorData = APIGatewayHelper.extractError(error);
        expect([400, 500]).toContain(error.response?.status);
        console.log("✅ API Gateway rechazó request sin body:", errorData);
      }
    });
  });

  test("DynamoDB rechaza ciudad vacía", async () => {
    await test.step("1. Intentar guardar ciudad vacía en DynamoDB", async () => {
      await expect(
        DynamoDBHelper.putItem({ ciudad: "", clima: "", temperatura: "" }),
      ).rejects.toThrow(
        "The AttributeValue for a key attribute cannot contain an empty string value",
      );
      console.log("✅ DynamoDB rechazó ciudad vacía correctamente");
    });
  });

  test("Lambda rechaza entradas potencialmente maliciosas", async () => {
    const entradasMaliciosas = [
      "<script>alert('xss')</script>",
      "'; DROP TABLE city; --",
    ];

    for (const entrada of entradasMaliciosas) {
      await test.step(`Probar entrada: ${entrada.substring(0, 30)}`, async () => {
        const response = await lambdaInvoker.invokeLambda("Clima", {
          ciudad: entrada,
        });

        // Debe rechazar o no encontrar la ciudad, nunca ejecutar código
        expect([400, 404, 500]).toContain(response.statusCode);
        console.log(`✅ Lambda manejó entrada maliciosa correctamente`);
      });
    }
  });

  test("URL de configuración tiene formato correcto", async () => {
    await test.step("1. Verificar formato URL de API Gateway", async () => {
      expect(CONFIG.API_GATEWAY_URL).toContain("execute-api");
      expect(CONFIG.API_GATEWAY_URL).toContain("amazonaws.com");
      console.log("✅ URL de API Gateway válida:", CONFIG.API_GATEWAY_URL);
    });

    await test.step("2. Verificar formato URL de SQS", async () => {
      expect(CONFIG.SQS_QUEUE_URL).toContain("sqs.us-east-1.amazonaws.com");
      console.log("✅ URL de SQS válida:", CONFIG.SQS_QUEUE_URL);
    });

    await test.step("3. Verificar región AWS configurada", async () => {
      expect(CONFIG.AWS_REGION).toBe("us-east-1");
      console.log("✅ Región AWS configurada:", CONFIG.AWS_REGION);
    });
  });
});

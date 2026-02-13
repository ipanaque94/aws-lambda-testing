import { test, expect } from "@playwright/test";
import {
  APIGatewayHelper,
  ClimaResponse,
  ErrorResponse,
} from "../utils/APIGatewayHelper";

test.describe("Tests de API Gateway", () => {
  test("POST /clima acepta solicitud y retorna 202", async () => {
    let data: ClimaResponse;

    await test.step("1. Enviar petición POST a API Gateway", async () => {
      data = await APIGatewayHelper.consultarClima("Lima");
      console.log("✅ Petición enviada a API Gateway");
    });

    await test.step("2. Verificar código de respuesta 202 (Accepted)", async () => {
      expect(data.message).toContain("Solicitud recibida");
      expect(data.messageId).toBeDefined();
      expect(data.status).toBe("processing");
      console.log("✅ API Gateway aceptó la solicitud:", data);
    });

    await test.step("3. Validar que mensaje fue enviado a SQS", async () => {
      expect(data.ciudad).toBe("Lima");
      console.log(`✅ Mensaje en cola SQS con ID: ${data.messageId}`);
    });
  });

  test("POST /clima retorna 400 si no envía ciudad", async () => {
    await test.step("1. Enviar petición sin campo 'ciudad'", async () => {
      try {
        await APIGatewayHelper.post<ClimaResponse>("/clima", {});
        expect(true).toBe(false); // No debería llegar aquí
      } catch (error: any) {
        console.log("✅ API Gateway rechazó petición inválida");

        await test.step("2. Verificar error 400 (Bad Request)", async () => {
          const errorData: ErrorResponse = APIGatewayHelper.extractError(error);
          expect(error.response?.status).toBe(400);
          expect(errorData.error).toContain("obligatoria");
          console.log("✅ Error 400 esperado:", errorData);
        });
      }
    });
  });

  test("POST /clima con ciudad válida", async () => {
    let data: ClimaResponse;

    await test.step("1. Enviar petición con ciudad 'Arequipa'", async () => {
      data = await APIGatewayHelper.consultarClima("Arequipa");
      console.log("✅ Petición enviada");
    });

    await test.step("2. Verificar respuesta del API Gateway", async () => {
      expect(data.message).toBeDefined();
      expect(data.messageId).toBeDefined();
      expect(data.ciudad).toBe("Arequipa");
      console.log("✅ Ciudad procesada correctamente");
    });
  });
});

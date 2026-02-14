import { test, expect } from "@playwright/test";
import { LambdaClimaHelper } from "../utils/LambdaClimaHelper";
import { SQSHelper } from "../utils/SQSHelper";
import { CONFIG } from "../utils/TestConfig";

const helper = new LambdaClimaHelper();

// BLOQUE 1: Tests Unitarios (Mock)
test.describe("Tests unitarios con mock", () => {
  const ciudadesMock = [
    { ciudad: "Lima", clima: "Soleado", temperatura: "28°C" },
    { ciudad: "Madrid", clima: "Nublado", temperatura: "15°C" },
    { ciudad: "Rio de Janeiro", clima: "Lluvioso", temperatura: "30°C" },
  ];

  for (const mockData of ciudadesMock) {
    test(`Lambda retorna datos mock para ${mockData.ciudad}`, async () => {
      let response: any;

      await test.step("1. Invocar Lambda con datos de prueba (mock)", async () => {
        response = await helper.invocarClimaMock(mockData.ciudad);
        expect(response.statusCode).toBe(200);
      });

      await test.step("2. Verificar que los datos coincidan con los esperados", async () => {
        const result = JSON.parse(response.body);
        expect(result.ciudad).toBe(mockData.ciudad);
        expect(result.clima).toBe(mockData.clima);
        expect(result.temperatura).toBe(mockData.temperatura);
        console.log(`✅ Datos mock correctos para ${mockData.ciudad}`);
      });
    });
  }
});

// BLOQUE 2: Tests de Integración (SQS + DynamoDB)
test.describe.serial("Tests de integración con SQS y DynamoDB", () => {
  const ciudadesReales = ["Chiclayo", "Tarapoto", "Huancavelica"];

  test.beforeAll(async () => {
    await test.step("Preparación: Limpiar colas SQS y DynamoDB", async () => {
      await SQSHelper.purgeQueue(CONFIG.SQS_QUEUE_URL);
      await SQSHelper.purgeQueue(CONFIG.SQS_RESULTS_URL);
      await helper.limpiarCiudades(ciudadesReales);
      await new Promise((res) => setTimeout(res, 2000));
      console.log("✅ Ambiente preparado para tests");
    });
  });

  for (const ciudad of ciudadesReales) {
    test(`Procesar ciudad válida: ${ciudad}`, async () => {
      test.setTimeout(60000);

      let messageId: string;
      let mensajeResultado: any;
      let dbItem: any;

      await test.step(`1. Enviar mensaje a cola SQS para ${ciudad}`, async () => {
        const resultado = await helper.procesarCiudadCompleto(ciudad);
        messageId = resultado.messageId;
        mensajeResultado = resultado.mensajeResultado;
        dbItem = resultado.dbItem;

        expect(messageId).toBeDefined();
        console.log(`✅ Mensaje enviado a SQS con ID: ${messageId}`);
      });

      await test.step("2. Verificar mensaje en cola de resultados", async () => {
        expect(mensajeResultado.ciudad?.toLowerCase()).toBe(
          ciudad.toLowerCase(),
        );
        expect(typeof mensajeResultado.clima).toBe("string");
        expect(mensajeResultado.temperatura).toContain("°C");
        console.log("✅ Mensaje procesado:", mensajeResultado);
      });

      await test.step("3. Verificar datos guardados en DynamoDB", async () => {
        expect(dbItem).toBeDefined();
        expect(dbItem.ciudad).toBe(ciudad);
        expect(typeof dbItem.clima).toBe("string");
        expect(dbItem.temperatura).toContain("°C");
        console.log("✅ Datos en DynamoDB:", dbItem);
      });
    });
  }
});

// BLOQUE 3: Tests de Invocación Directa
test.describe("Tests de invocación directa de Lambda", () => {
  test("Invocación directa retorna 200 para ciudad válida", async () => {
    const ciudad = "Lima";
    let response: any;

    await test.step("1. Limpiar datos previos de DynamoDB", async () => {
      await helper.limpiarCiudad(ciudad);
      console.log(`✅ DynamoDB limpio para ${ciudad}`);
    });

    await test.step("2. Invocar Lambda directamente", async () => {
      response = await helper.invocarClima(ciudad);
      expect(response.statusCode).toBe(200);
      console.log("✅ Lambda respondió con código 200");
    });

    await test.step("3. Validar datos del clima recibidos", async () => {
      const result = JSON.parse(response.body);
      expect(result.ciudad).toBe(ciudad);
      expect(typeof result.clima).toBe("string");
      expect(result.temperatura).toContain("°C");
      console.log("✅ Datos del clima:", result);
    });
  });

  test("Invocación directa retorna 404 para ciudad inválida", async () => {
    let response: any;

    await test.step("1. Invocar Lambda con ciudad que no existe", async () => {
      response = await helper.invocarClima("CiudadQueNoExiste123");
      console.log("✅ Lambda invocada con ciudad inválida");
    });

    await test.step("2. Verificar que devuelve error 404", async () => {
      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.body);
      expect(result.error).toContain("no existe en OpenWeather");
      console.log("✅ Error 404 esperado:", result.error);
    });
  });
});

// BLOQUE 4: Tests de manejo de errores
test.describe("Tests de manejo de errores", () => {
  test("Ciudad inválida retorna 404 en invocación directa", async () => {
    let response: any;

    await test.step("1. Invocar Lambda con ciudad que OpenWeather no reconoce", async () => {
      response = await helper.invocarClima("Moscú");
      console.log("✅ Lambda invocada");
    });

    await test.step("2. Validar código de error 404", async () => {
      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.body);
      expect(result.error).toContain("no existe en OpenWeather");
      console.log("✅ Error 404 confirmado:", result.error);
    });
  });
});

// BLOQUE 5: Tests de Concurrencia
test("Procesamiento concurrente de 10 ciudades válidas", async () => {
  const ciudades = [
    "Lima",
    "Arequipa",
    "Cusco",
    "Trujillo",
    "Chiclayo",
    "Piura",
    "Iquitos",
    "Tacna",
    "Puno",
    "Ayacucho",
  ];
  let resultados: any[];

  await test.step("1. Limpiar DynamoDB para todas las ciudades", async () => {
    await helper.limpiarCiudades(ciudades);
    console.log("✅ DynamoDB limpio para todas las ciudades");
  });

  await test.step("2. Invocar Lambda para 10 ciudades en paralelo", async () => {
    resultados = await helper.procesarCiudadesParalelo(ciudades);
    console.log("✅ Todas las invocaciones completadas");
  });

  await test.step("3. Verificar que todas retornaron código 200", async () => {
    resultados.forEach((res, i) => {
      expect(res.statusCode).toBe(200);
      console.log(`✅ ${ciudades[i]}: OK`);
    });
  });
});

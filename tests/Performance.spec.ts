import { test, expect } from "@playwright/test";
import { LambdaInvoker } from "../utils/LambdaInvoker";
import { APIGatewayHelper } from "../utils/APIGatewayHelper";

const lambdaInvoker = new LambdaInvoker();

test.describe("Tests de Performance y Tiempo de Respuesta", () => {
  test("Lambda responde en menos de 5 segundos", async () => {
    let duracion: number;
    let response: any;

    await test.step("1. Invocar Lambda y medir tiempo", async () => {
      const inicio = Date.now();
      response = await lambdaInvoker.invokeLambda("Clima", { ciudad: "Lima" });
      duracion = Date.now() - inicio;
      console.log(`⏱️ Lambda respondió en ${duracion}ms`);
    });

    await test.step("2. Verificar respuesta exitosa", async () => {
      expect(response.statusCode).toBe(200);
      console.log("✅ Lambda respondió con código 200");
    });

    await test.step("3. Verificar tiempo de respuesta aceptable", async () => {
      expect(duracion).toBeLessThan(5000); // Menos de 5 segundos
      console.log(`✅ Tiempo de respuesta OK: ${duracion}ms (límite: 5000ms)`);
    });
  });

  test("Lambda responde en menos de 5 segundos para ciudad inválida", async () => {
    let duracion: number;
    let response: any;

    await test.step("1. Invocar Lambda con ciudad inválida y medir tiempo", async () => {
      const inicio = Date.now();
      response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "CiudadFalsa999",
      });
      duracion = Date.now() - inicio;
      console.log(`⏱️ Lambda respondió en ${duracion}ms`);
    });

    await test.step("2. Verificar código de error correcto", async () => {
      expect(response.statusCode).toBe(404);
      console.log("✅ Lambda retornó 404 correctamente");
    });

    await test.step("3. Verificar tiempo de respuesta aceptable para errores", async () => {
      expect(duracion).toBeLessThan(5000);
      console.log(`✅ Error devuelto rápidamente: ${duracion}ms`);
    });
  });

  test("API Gateway responde en menos de 5 segundos", async () => {
    let duracion: number;
    let data: any;

    await test.step("1. Enviar petición a API Gateway y medir tiempo", async () => {
      const inicio = Date.now();
      data = await APIGatewayHelper.consultarClima("Lima");
      duracion = Date.now() - inicio;
      console.log(`⏱️ API Gateway respondió en ${duracion}ms`);
    });

    await test.step("2. Verificar respuesta correcta", async () => {
      expect(data.message).toContain("Solicitud recibida");
      console.log("✅ API Gateway procesó la solicitud");
    });

    await test.step("3. Verificar tiempo de respuesta aceptable", async () => {
      expect(duracion).toBeLessThan(5000);
      console.log(`✅ API Gateway respondió en tiempo: ${duracion}ms`);
    });
  });

  test("Sistema procesa 5 ciudades en menos de 30 segundos", async () => {
    test.setTimeout(60000);

    const ciudades = ["Lima", "Arequipa", "Cusco", "Trujillo", "Piura"];
    let duracionTotal: number;
    let resultados: any[];

    await test.step("1. Invocar Lambda para 5 ciudades en paralelo", async () => {
      const inicio = Date.now();

      resultados = await Promise.all(
        ciudades.map((ciudad) =>
          lambdaInvoker.invokeLambda("Clima", { ciudad }),
        ),
      );

      duracionTotal = Date.now() - inicio;
      console.log(`⏱️ 5 ciudades procesadas en ${duracionTotal}ms`);
    });

    await test.step("2. Verificar que todas respondieron correctamente", async () => {
      const exitosas = resultados.filter((r) => r.statusCode === 200);
      expect(exitosas.length).toBe(ciudades.length);
      console.log(`✅ ${exitosas.length}/5 ciudades procesadas exitosamente`);
    });

    await test.step("3. Verificar tiempo total aceptable", async () => {
      expect(duracionTotal).toBeLessThan(30000); // Menos de 30 segundos
      console.log(`✅ Tiempo total OK: ${duracionTotal}ms (límite: 30000ms)`);
    });
  });
});

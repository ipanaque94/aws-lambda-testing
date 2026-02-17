import { test, expect } from "@playwright/test";
import { LambdaInvoker } from "../utils/LambdaInvoker";

const lambdaInvoker = new LambdaInvoker();

test.describe("Tests de Timeout", () => {
  test("Lambda tiene timeout configurado correctamente", async () => {
    test.setTimeout(90000);
    let duracion: number;
    let response: any;

    await test.step("1. Invocar Lambda y registrar tiempo de inicio", async () => {
      const inicio = Date.now();
      response = await lambdaInvoker.invokeLambda("Clima", { ciudad: "Lima" });
      duracion = Date.now() - inicio;
      console.log(`⏱️ Lambda respondió en ${duracion}ms`);
    });

    await test.step("2. Verificar respuesta exitosa", async () => {
      expect(response.statusCode).toBe(200);
      console.log("✅ Lambda respondió exitosamente");
    });

    await test.step("3. Verificar que respondió antes del timeout (30s)", async () => {
      // Lambda tiene timeout de 30 segundos configurado en AWS
      expect(duracion).toBeLessThan(30000);
      console.log(
        `✅ Lambda respondió en ${duracion}ms (timeout configurado: 30s)`,
      );
    });
  });

  test("Lambda maneja timeouts de servicios externos gracefully", async () => {
    test.setTimeout(60000);
    let duracion: number;
    let response: any;

    await test.step("1. Invocar Lambda con ciudad lejana geográficamente", async () => {
      const inicio = Date.now();
      response = await lambdaInvoker.invokeLambda("Clima", {
        ciudad: "Sydney",
      });
      duracion = Date.now() - inicio;
      console.log(`⏱️ Lambda respondió en ${duracion}ms`);
    });

    await test.step("2. Verificar que responde (sin colgarse)", async () => {
      expect([200, 404, 500]).toContain(response.statusCode);
      console.log(`✅ Lambda respondió correctamente: ${response.statusCode}`);
    });

    await test.step("3. Verificar tiempo razonable", async () => {
      expect(duracion).toBeLessThan(15000); // 15 segundos máximo
      console.log(`✅ Respondió sin timeout en ${duracion}ms`);
    });
  });

  test("Lambda procesa múltiples requests sin degradación de tiempo", async () => {
    test.setTimeout(120000);

    const tiempos: number[] = [];
    const ciudades = ["Lima", "Arequipa", "Cusco"];

    await test.step("1. Ejecutar 3 invocaciones secuenciales", async () => {
      for (const ciudad of ciudades) {
        const inicio = Date.now();
        await lambdaInvoker.invokeLambda("Clima", { ciudad });
        const duracion = Date.now() - inicio;
        tiempos.push(duracion);
        console.log(`⏱️ ${ciudad}: ${duracion}ms`);
      }
    });

    await test.step("2. Verificar que ninguna invocación excedió 10 segundos", async () => {
      tiempos.forEach((t, i) => {
        expect(t).toBeLessThan(10000);
        console.log(`✅ ${ciudades[i]}: ${t}ms (límite: 10000ms)`);
      });
    });

    await test.step("3. Calcular tiempo promedio", async () => {
      const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
      console.log(`📊 Tiempo promedio: ${promedio.toFixed(0)}ms`);
      expect(promedio).toBeLessThan(8000);
    });
  });
});

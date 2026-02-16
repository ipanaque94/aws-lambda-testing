import { test, expect } from "@playwright/test";
import { LambdaInvoker } from "../utils/LambdaInvoker";
import { CloudWatchHelper } from "../utils/CloudWatchHelper";

test("CloudWatch muestra logs para ciudad válida", async () => {
  const ciudad = "lima";
  let events: any[];

  await test.step("1. Invocar Lambda para generar logs", async () => {
    const lambdaInvoker = new LambdaInvoker();
    await lambdaInvoker.invokeLambda("Clima", { ciudad });
    console.log("✅ Lambda invocada");
  });

  await test.step("2. Esperar propagación de logs en CloudWatch", async () => {
    await CloudWatchHelper.waitForLogs(10000);
    console.log("✅ Esperando 10 segundos...");
  });

  await test.step("3. Buscar logs en CloudWatch", async () => {
    events = await CloudWatchHelper.getFilteredLogs(`"${ciudad}"`);
    console.log(`📜 Total de eventos encontrados: ${events.length}`);
  });

  await test.step("4. Validar que existen logs de la ciudad", async () => {
    const filteredEvents = events.filter((e) => e.message?.includes(ciudad));
    expect(filteredEvents.length).toBeGreaterThan(0);
    console.log(
      "✅ Logs encontrados:",
      filteredEvents.map((e) => e.message),
    );
  });
});

test("CloudWatch muestra métricas de invocaciones en los últimos 30 minutos", async () => {
  let response: any;

  await test.step("1. Consultar métricas de invocaciones en CloudWatch", async () => {
    response = await CloudWatchHelper.getLambdaMetrics("Invocations", 30);
    console.log("✅ Métricas obtenidas");
  });

  await test.step("2. Validar que existen métricas registradas", async () => {
    expect(response.Datapoints?.length).toBeGreaterThan(0);
    console.log("📊 Métricas de invocación:", response.Datapoints);
  });
});

test("CloudWatch muestra métricas de errores en los últimos 30 minutos", async () => {
  let response: any;

  await test.step("1. Consultar métricas de errores en CloudWatch", async () => {
    response = await CloudWatchHelper.getLambdaMetrics("Errors", 30);
    console.log("✅ Métricas de errores obtenidas");
  });

  await test.step("2. Calcular total de errores", async () => {
    const totalErrores =
      response.Datapoints?.reduce(
        (acc: number, dp: any) => acc + (dp.Sum ?? 0),
        0,
      ) ?? 0;
    console.log(`📊 Total de errores: ${totalErrores}`);
    expect(totalErrores).toBe(0);
  });
});

test("Verificación de log de éxito en CloudWatch al guardar en DynamoDB", async () => {
  const ciudad = "Chiclayo";
  let logs: any[];

  await test.step("1. Invocar Lambda para procesar ciudad", async () => {
    const lambdaInvoker = new LambdaInvoker();
    await lambdaInvoker.invokeLambda("Clima", { ciudad });
    console.log("✅ Lambda invocada");
  });

  await test.step("2. Esperar propagación de logs", async () => {
    await CloudWatchHelper.waitForLogs(10000);
    console.log("✅ Esperando logs...");
  });

  await test.step("3. Obtener todos los logs recientes", async () => {
    logs = await CloudWatchHelper.getFilteredLogs("", 30);
    console.log("📜 Total de logs:", logs.length);
  });

  await test.step("4. Buscar logs de guardado en DynamoDB", async () => {
    const eventos = logs.filter(
      (e) =>
        e.message?.includes("Datos guardados en DynamoDB") &&
        e.message?.includes(ciudad),
    );
    expect(eventos.length).toBeGreaterThan(0);
    console.log(
      "✅ Logs de éxito encontrados:",
      eventos.map((e) => e.message),
    );
  });
});

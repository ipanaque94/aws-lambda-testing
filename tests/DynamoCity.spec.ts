import { test, expect } from "@playwright/test";
import { DynamoDBHelper } from "../utils/DynamoDBHelper";
import { LambdaInvoker } from "../utils/LambdaInvoker";

test("✅ Verificación de escritura directa en DynamoDB", async () => {
  const ciudad = "Plutonio";
  const clima = "Extremo";
  const temperatura = "1000°C";
  let data: any;

  await test.step("1. Escribir registro directamente en DynamoDB", async () => {
    await DynamoDBHelper.putItem({ ciudad, clima, temperatura });
    console.log(`✅ Ciudad '${ciudad}' escrita en DynamoDB`);
  });

  await test.step("2. Leer el registro desde DynamoDB", async () => {
    data = await DynamoDBHelper.getItem(ciudad);
    expect(data).toBeDefined();
    console.log("✅ Registro leído correctamente");
  });

  await test.step("3. Validar datos guardados", async () => {
    expect(data.ciudad).toBe(ciudad);
    expect(data.clima).toBe(clima);
    expect(data.temperatura).toBe(temperatura);
    expect(data.fecha).toBeDefined();
    console.log("✅ Todos los campos validados");
  });
});

test("Test con ciudad vacía en DynamoDB", async () => {
  await test.step("1. Intentar guardar registro con ciudad vacía", async () => {
    await expect(
      DynamoDBHelper.putItem({ ciudad: "", clima: "", temperatura: "" }),
    ).rejects.toThrow(
      "The AttributeValue for a key attribute cannot contain an empty string value",
    );
    console.log("✅ DynamoDB rechazó correctamente ciudad vacía");
  });
});

test("Simulación de concurrencia - 10 ciudades INVOCAR LAMBDA", async () => {
  test.setTimeout(120000);

  const ciudades = [
    "Jaén",
    "Bagua Grande",
    "Chiclayo",
    "Piura",
    "Trujillo",
    "Sullana",
    "San Ignacio",
    "Puno",
    "Cuzco",
    "Tacna",
  ];
  let resultados: any[];

  await test.step("1. Limpiar DynamoDB", async () => {
    await Promise.all(ciudades.map((c) => DynamoDBHelper.deleteItem(c)));
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("✅ DynamoDB limpio para todas las ciudades");
  });

  await test.step("2. Invocar Lambda para 10 ciudades", async () => {
    const lambdaInvoker = new LambdaInvoker();
    const promesas = ciudades.map((ciudad) =>
      lambdaInvoker.invokeLambda("Clima", { ciudad }),
    );
    resultados = await Promise.all(promesas);
    console.log("✅ Todas las invocaciones completadas");
  });

  await test.step("3. Esperar propagación (15 segundos)", async () => {
    await new Promise((resolve) => setTimeout(resolve, 15000)); // ✅ 15 segundos
    console.log("✅ Esperando propagación...");
  });

  await test.step("4. Verificar en DynamoDB con reintentos", async () => {
    for (const ciudad of ciudades) {
      let result = null;

      // ✅ 10 reintentos de 2 segundos cada uno
      for (let i = 0; i < 10; i++) {
        result = await DynamoDBHelper.getItem(ciudad);
        if (result) break;

        if (i < 9) {
          console.log(`⏳ ${ciudad}: Intento ${i + 1}/10`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      expect(result).toBeDefined();
      expect(result.ciudad).toBe(ciudad);
      console.log(`✅ ${ciudad}: OK`);
    }
  });
});

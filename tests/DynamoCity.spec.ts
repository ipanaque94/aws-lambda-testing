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

  await test.step("1. Invocar Lambda para 10 ciudades", async () => {
    const lambdaInvoker = new LambdaInvoker();
    const promesas = ciudades.map((ciudad) =>
      lambdaInvoker.invokeLambda("Clima", { ciudad }),
    );
    await Promise.all(promesas);
    console.log("✅ Lambdas invocadas");
  });

  await test.step("2. Esperar procesamiento", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  await test.step("3. Verificar en DynamoDB", async () => {
    for (const ciudad of ciudades) {
      const result = await DynamoDBHelper.getItem(ciudad);
      expect(result).toBeDefined();
      console.log(`✅ ${ciudad}: Verificado`);
    }
  });
});

import { LambdaInvoker } from "./LambdaInvoker";
import { SQSHelper } from "./SQSHelper";
import { DynamoDBHelper } from "./DynamoDBHelper";
import { CONFIG } from "./TestConfig";

export class LambdaClimaHelper {
  private lambdaInvoker: LambdaInvoker;

  constructor() {
    this.lambdaInvoker = new LambdaInvoker();
  }

  async invocarClimaMock(ciudad: string): Promise<any> {
    return this.lambdaInvoker.invokeLambda("Clima", {
      ciudad,
      mock: true,
    });
  }

  async invocarClima(ciudad: string): Promise<any> {
    return this.lambdaInvoker.invokeLambda("Clima", { ciudad });
  }

  async procesarCiudadCompleto(ciudad: string): Promise<{
    messageId: string;
    mensajeResultado: any;
    dbItem: any;
  }> {
    // 1. Enviar a SQS
    const messageId = await SQSHelper.sendMessage(CONFIG.SQS_QUEUE_URL, {
      ciudad,
    });

    // 2. Invocar Lambda directamente
    await this.lambdaInvoker.invokeLambda("Clima", { ciudad });

    // 3. Esperar mensaje específico (ya viene parseado)
    const mensajeResultado = await SQSHelper.waitForMessage(
      CONFIG.SQS_RESULTS_URL,
      (msg) => msg.ciudad?.toLowerCase() === ciudad.toLowerCase(),
      10,
    );

    // 4. Obtener de DynamoDB con reintentos
    let dbItem = null;
    for (let i = 0; i < 5; i++) {
      dbItem = await DynamoDBHelper.getItem(ciudad);
      if (dbItem) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return {
      messageId,
      mensajeResultado, // ✅ YA NO HAY JSON.parse()
      dbItem,
    };
  }

  async limpiarCiudad(ciudad: string): Promise<void> {
    try {
      await DynamoDBHelper.deleteItem(ciudad);
    } catch (error) {
      // Ignorar
    }
  }

  async limpiarCiudades(ciudades: string[]): Promise<void> {
    await Promise.all(ciudades.map((c) => this.limpiarCiudad(c)));
  }

  async procesarCiudadesParalelo(ciudades: string[]): Promise<any[]> {
    const promesas = ciudades.map((ciudad) =>
      this.lambdaInvoker.invokeLambda("Clima", { ciudad }),
    );
    return await Promise.all(promesas);
  }
}

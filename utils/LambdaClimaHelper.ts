import { LambdaInvoker } from "./LambdaInvoker";
import { DynamoDBHelper } from "./DynamoDBHelper";
import { SQSHelper } from "./SQSHelper";
import { CONFIG } from "./TestConfig";

export class LambdaClimaHelper {
  private lambdaInvoker: LambdaInvoker;

  constructor() {
    this.lambdaInvoker = new LambdaInvoker();
  }

  /**
   * Invocar Lambda con ciudad (modo real)
   */
  async invocarClima(ciudad: string): Promise<any> {
    return await this.lambdaInvoker.invokeLambda(CONFIG.LAMBDA_FUNCTION, {
      ciudad,
    });
  }

  /**
   * Invocar Lambda con datos mock
   */
  async invocarClimaMock(ciudad: string): Promise<any> {
    return await this.lambdaInvoker.invokeLambda(CONFIG.LAMBDA_FUNCTION, {
      ciudad,
      mock: true,
    });
  }

  /**
   * Procesar ciudad a través de SQS + Lambda + DynamoDB
   */
  async procesarCiudadCompleto(ciudad: string): Promise<{
    messageId: string;
    mensajeResultado: any;
    dbItem: any;
  }> {
    // 1. Enviar a SQS
    const messageId = await SQSHelper.sendMessage(CONFIG.SQS_QUEUE_URL, {
      ciudad,
    });

    // 2. Esperar en cola de resultados
    const mensajeResultado = await SQSHelper.waitForMessage(
      CONFIG.SQS_RESULTS_URL,
      (msg) => msg.ciudad.toLowerCase() === ciudad.toLowerCase(),
    );

    // 3. Verificar en DynamoDB
    const dbItem = await DynamoDBHelper.getItem(ciudad);

    return { messageId, mensajeResultado, dbItem };
  }

  /**
   * Limpiar ciudad de DynamoDB
   */
  async limpiarCiudad(ciudad: string): Promise<void> {
    await DynamoDBHelper.deleteItem(ciudad);
  }

  /**
   * Limpiar múltiples ciudades
   */
  async limpiarCiudades(ciudades: string[]): Promise<void> {
    await Promise.all(ciudades.map((c) => this.limpiarCiudad(c)));
  }

  /**
   * Validar respuesta exitosa de Lambda
   */
  validarRespuestaExitosa(response: any, ciudad: string): void {
    if (response.statusCode !== 200) {
      throw new Error(
        `Lambda falló para ${ciudad}: ${JSON.stringify(response)}`,
      );
    }

    const result = JSON.parse(response.body);
    if (result.ciudad !== ciudad) {
      throw new Error(`Ciudad esperada: ${ciudad}, recibida: ${result.ciudad}`);
    }

    if (!result.temperatura || !result.temperatura.includes("°C")) {
      throw new Error("Temperatura inválida");
    }
  }

  /**
   * Validar respuesta de error de Lambda
   */
  validarRespuestaError(response: any, expectedStatus: number): void {
    if (response.statusCode !== expectedStatus) {
      throw new Error(
        `StatusCode esperado: ${expectedStatus}, recibido: ${response.statusCode}`,
      );
    }

    const result = JSON.parse(response.body);
    if (!result.error) {
      throw new Error("Respuesta de error no contiene campo 'error'");
    }
  }

  /**
   * Procesar múltiples ciudades en paralelo
   */
  async procesarCiudadesParalelo(ciudades: string[]): Promise<any[]> {
    const promesas = ciudades.map((ciudad) => this.invocarClima(ciudad));
    return await Promise.all(promesas);
  }
}

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
} from "@aws-sdk/client-sqs";
import { CONFIG } from "./TestConfig";

const sqsClient = new SQSClient({ region: CONFIG.AWS_REGION });

export class SQSHelper {
  /**
   * Enviar mensaje a cola
   */
  static async sendMessage(
    queueUrl: string,
    messageBody: any,
  ): Promise<string> {
    const result = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(messageBody),
      }),
    );
    return result.MessageId!;
  }

  /**
   * Esperar mensaje en cola con polling
   */
  static async waitForMessage(
    queueUrl: string,
    predicado: (mensaje: any) => boolean,
    maxIntentos = CONFIG.MAX_POLL_ATTEMPTS,
  ): Promise<any> {
    for (let intento = 1; intento <= maxIntentos; intento++) {
      const result = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: CONFIG.SQS_MAX_MESSAGES,
          WaitTimeSeconds: CONFIG.SQS_WAIT_TIME_SECONDS,
        }),
      );

      if (result.Messages) {
        for (const msg of result.Messages) {
          const body = JSON.parse(msg.Body!);
          if (predicado(body)) {
            // Eliminar mensaje después de procesarlo
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: msg.ReceiptHandle!,
              }),
            );
            return body;
          }
        }
      }

      console.log(
        `⏳ Intento ${intento}/${maxIntentos}: mensaje no encontrado`,
      );
      await new Promise((res) => setTimeout(res, CONFIG.POLL_INTERVAL_MS));
    }

    throw new Error(`Mensaje no encontrado después de ${maxIntentos} intentos`);
  }

  /**
   * Limpiar cola
   */
  static async purgeQueue(queueUrl: string): Promise<void> {
    try {
      await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
      await new Promise((res) => setTimeout(res, 2000));
    } catch (error) {
      console.log("⚠️ No se pudo limpiar la cola");
    }
  }
}

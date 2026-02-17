import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { CONFIG } from "./TestConfig";

const sqsClient = new SQSClient({ region: CONFIG.AWS_REGION });

export class SQSHelper {
  // Enviar mensaje a SQS
  static async sendMessage(queueUrl: string, body: object): Promise<string> {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
    });

    const result = await sqsClient.send(command);
    return result.MessageId!;
  }

  // Recibir un solo mensaje
  static async receiveMessage(queueUrl: string): Promise<any> {
    const result = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 10,
      }),
    );

    if (!result.Messages || result.Messages.length === 0) return null;

    const message = result.Messages[0];
    const body = JSON.parse(message.Body || "{}");

    // Eliminar mensaje después de recibir
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle!,
      }),
    );

    return body;
  }

  // Esperar mensaje con condición (polling inteligente)
  static async waitForMessage(
    queueUrl: string,
    condition: (msg: any) => boolean,
    maxAttempts: number = CONFIG.MAX_ATTEMPTS,
  ): Promise<any> {
    for (let i = 1; i <= maxAttempts; i++) {
      const result = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 5,
        }),
      );

      if (result.Messages && result.Messages.length > 0) {
        for (const message of result.Messages) {
          const body = JSON.parse(message.Body || "{}");

          if (condition(body)) {
            // Eliminar mensaje encontrado
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: message.ReceiptHandle!,
              }),
            );
            return body;
          }
        }
      }

      console.log(`⏳ Intento ${i}/${maxAttempts}: mensaje no encontrado`);
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.POLLING_INTERVAL),
      );
    }

    throw new Error(
      `❌ Mensaje no encontrado después de ${maxAttempts} intentos`,
    );
  }

  // Limpiar cola
  static async purgeQueue(queueUrl: string): Promise<void> {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));
    // Esperar 1 segundo después de purge (AWS requiere tiempo)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Obtener atributos de la cola (número de mensajes, etc.)
  static async getQueueAttributes(queueUrl: string): Promise<any> {
    const result = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: [
          "ApproximateNumberOfMessages",
          "ApproximateNumberOfMessagesNotVisible",
          "QueueArn",
        ],
      }),
    );
    return result.Attributes;
  }
}

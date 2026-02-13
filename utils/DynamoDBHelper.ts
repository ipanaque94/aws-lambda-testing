import * as AWS from "aws-sdk";
import { CONFIG } from "./TestConfig";

AWS.config.update({ region: CONFIG.AWS_REGION });
const dynamoDB = new AWS.DynamoDB.DocumentClient();

export class DynamoDBHelper {
  /**
   * Obtener un item de DynamoDB
   */
  static async getItem(ciudad: string): Promise<any> {
    const result = await dynamoDB
      .get({
        TableName: CONFIG.DYNAMODB_TABLE,
        Key: { ciudad },
      })
      .promise();
    return result.Item;
  }

  /**
   * Guardar un item en DynamoDB
   */
  static async putItem(item: {
    ciudad: string;
    clima: string;
    temperatura: string;
  }): Promise<void> {
    await dynamoDB
      .put({
        TableName: CONFIG.DYNAMODB_TABLE,
        Item: {
          ...item,
          fecha: new Date().toISOString(),
        },
      })
      .promise();
  }

  /**
   * Eliminar un item de DynamoDB
   */
  static async deleteItem(ciudad: string): Promise<void> {
    try {
      await dynamoDB
        .delete({
          TableName: CONFIG.DYNAMODB_TABLE,
          Key: { ciudad },
        })
        .promise();
    } catch (error) {
      // Ignorar si no existe
    }
  }

  /**
   * Verificar configuración de la tabla
   */
  static async getTableInfo(): Promise<AWS.DynamoDB.DescribeTableOutput> {
    const dynamoDBClient = new AWS.DynamoDB();
    return await dynamoDBClient
      .describeTable({ TableName: CONFIG.DYNAMODB_TABLE })
      .promise();
  }
}

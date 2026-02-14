import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const dynamoDB = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "city";

export class DynamoDBHelper {
  static async putItem(item: {
    ciudad: string;
    clima: string;
    temperatura: string;
  }): Promise<void> {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        ...item,
        fecha: new Date().toISOString(),
      },
    };

    await dynamoDB.send(new PutCommand(params));
  }

  static async getItem(ciudad: string): Promise<any> {
    const params = {
      TableName: TABLE_NAME,
      Key: { ciudad },
    };

    const result = await dynamoDB.send(new GetCommand(params));
    return result.Item;
  }

  static async deleteItem(ciudad: string): Promise<void> {
    const params = {
      TableName: TABLE_NAME,
      Key: { ciudad },
    };

    await dynamoDB.send(new DeleteCommand(params));
  }

  static async getTableInfo(): Promise<any> {
    const command = new DescribeTableCommand({ TableName: TABLE_NAME });
    return await client.send(command);
  }
}

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { config } from "dotenv";
config();

export class LambdaInvoker {
  private lambdaClient: LambdaClient;
  constructor() {
    this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
  }

  async invokeLambda(functionName: string, payloadObj: object): Promise<any> {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payloadObj)),
      InvocationType: "RequestResponse",
    });
    try {
      const response = await this.lambdaClient.send(command);
      return JSON.parse(Buffer.from(response.Payload as Uint8Array).toString());
    } catch (error) {
      console.error("Error al invocar el Lambda:", error);
      throw error;
    }
  }
}

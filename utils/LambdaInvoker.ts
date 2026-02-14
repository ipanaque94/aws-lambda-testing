import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export class LambdaInvoker {
  private lambdaClient: LambdaClient;

  constructor() {
    this.lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async invokeLambda(functionName: string, payload: any): Promise<any> {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
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

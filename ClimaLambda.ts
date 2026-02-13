import { LambdaClient, InvokeCommand, Lambda } from "@aws-sdk/client-lambda";
import { config } from "dotenv";
config();

const lamdba = new LambdaClient({ region: process.env.AWS_REGION });

async function invokeLambda() {
  const functionName = "Clima";
  const payload = JSON.stringify({ ciudad: "value" });

  const command = new InvokeCommand({
    FunctionName: functionName,
    Payload: Buffer.from(payload),
    InvocationType: "RequestResponse",
  });
  try {
    const response = await lamdba.send(command);
    const responsePayload = Buffer.from(response.Payload!).toString();
    console.log("Respuest del Lambda:", responsePayload);

    if (response.FunctionError) {
      console.error(
        "Error en la ejecucion del Lambda:",
        response.FunctionError,
      );
    } else {
      console.log("Lambda ejecutado correctamente.");
    }
  } catch (error) {
    console.error("Error al invocar el Lambda:", error);
  }
}
invokeLambda();

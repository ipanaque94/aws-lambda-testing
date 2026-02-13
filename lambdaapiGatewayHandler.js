const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: "us-east-1" });

exports.handler = async (event) => {
  console.log("🌐 Evento completo:", JSON.stringify(event, null, 2));

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  try {
    // ✅ Parsear body - puede venir como string o como objeto
    let body;
    if (typeof event.body === "string") {
      body = JSON.parse(event.body);
    } else {
      body = event.body || {};
    }

    console.log("📩 Body parseado:", JSON.stringify(body));

    const ciudad = body.ciudad;

    if (!ciudad) {
      console.log("❌ Ciudad no encontrada en body");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "La ciudad es obligatoria",
          message: 'Debes enviar { "ciudad": "NombreCiudad" }',
          receivedBody: body,
          receivedEvent: event,
        }),
      };
    }

    const result = await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify({ ciudad }),
      }),
    );

    console.log(`✅ Mensaje enviado con ID: ${result.MessageId}`);

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({
        message: "Solicitud recibida y en proceso",
        messageId: result.MessageId,
        ciudad: ciudad,
        status: "processing",
      }),
    };
  } catch (error) {
    console.error("❌ Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Error interno del servidor",
        details: error.message,
      }),
    };
  }
};

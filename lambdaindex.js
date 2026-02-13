const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const sqs = new SQSClient({ region: "us-east-1" });
const client = new DynamoDBClient();
const dynamoDB = DynamoDBDocumentClient.from(client);
const tableName = "city";

exports.handler = async (event) => {
  // Modo mock
  if (event.mock) {
    let clima = "Soleado";
    let temperatura = "28°C";

    if (event.ciudad === "Madrid") {
      clima = "Nublado";
      temperatura = "15°C";
    } else if (event.ciudad === "Rio de Janeiro") {
      clima = "Lluvioso";
      temperatura = "30°C";
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ciudad: event.ciudad, clima, temperatura }),
    };
  }

  // Modo con OpenWeather
  for (const record of event.Records || [event]) {
    try {
      const body = record.body ? JSON.parse(record.body) : record;
      if (!body.ciudad) {
        throw new Error("La ciudad es obligatoria");
      }
      const ciudad = body.ciudad;
      const apikey = process.env.OPENWEATHER_API_KEY;
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ciudad)}&appid=${apikey}&units=metric&lang=es`;

      const response = await fetch(url);
      const data = await response.json();

      console.log("📩Mensaje recibido:", body);
      console.log("⛅Respuesta de OpenWeather:", data);

      // ✅ Verificar si es un 404 (ciudad no encontrada)
      if (data.cod === "404" || data.cod === 404) {
        console.error(
          `❌ La ciudad "${ciudad}" no existe o error en OpenWeather`,
        );

        // Enviar a DLQ SOLO si la variable existe
        if (process.env.SQS_DLQ_URL) {
          try {
            await sqs.send(
              new SendMessageCommand({
                QueueUrl: process.env.SQS_DLQ_URL,
                MessageBody: JSON.stringify(body),
              }),
            );
          } catch (dlqError) {
            console.error("⚠️ No se pudo enviar a DLQ:", dlqError.message);
          }
        }

        // Si es invocación directa, devolver 404
        if (!record.body) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              error: `La ciudad "${ciudad}" no existe en OpenWeather`,
            }),
          };
        }
        continue;
      }

      // ✅ Validar respuesta incompleta
      if (!response.ok || !data.main || !data.weather) {
        console.error("❌ Respuesta inesperada de OpenWeather");

        if (process.env.SQS_DLQ_URL) {
          try {
            await sqs.send(
              new SendMessageCommand({
                QueueUrl: process.env.SQS_DLQ_URL,
                MessageBody: JSON.stringify(body),
              }),
            );
          } catch (dlqError) {
            console.error("⚠️ No se pudo enviar a DLQ:", dlqError.message);
          }
        }

        if (!record.body) {
          return {
            statusCode: 502,
            body: JSON.stringify({
              error: "Respuesta inesperada en OpenWeather",
            }),
          };
        }
        continue;
      }

      const clima = data.weather[0].description;
      const temperatura = `${data.main.temp}°C`;

      const messageBody = JSON.stringify({
        ciudad,
        clima,
        temperatura,
        fecha: new Date().toISOString(),
      });
      const sqsResponse = await sqs.send(
        new SendMessageCommand({
          QueueUrl: process.env.SQS_RESULTADOS_URL,
          MessageBody: messageBody,
        }),
      );
      console.log(
        `✅Mensaje enviado a resultados con ID: ${sqsResponse.MessageId}`,
      );

      await dynamoDB.send(
        new PutCommand({
          TableName: "city",
          Item: { ciudad, clima, temperatura, fecha: new Date().toISOString() },
        }),
      );
      console.log("✅Datos guardados en DynamoDB:", ciudad);

      // Si es invocación directa, devolver 200
      if (!record.body) {
        return {
          statusCode: 200,
          body: messageBody,
        };
      }
    } catch (error) {
      console.error("❌ Error en Lambda:", error);

      // Enviar a DLQ si es SQS
      if (record.body && process.env.SQS_DLQ_URL) {
        try {
          await sqs.send(
            new SendMessageCommand({
              QueueUrl: process.env.SQS_DLQ_URL,
              MessageBody: record.body,
            }),
          );
        } catch (dlqError) {
          console.error("⚠️ No se pudo enviar a DLQ:", dlqError.message);
        }
      }

      // Si es invocación directa, distinguir el tipo de error
      if (!record.body) {
        const mensaje = error?.message || "";

        if (mensaje.includes("La ciudad es obligatoria")) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "La ciudad es obligatoria" }),
          };
        }

        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Error interno en Lambda" }),
        };
      }
    }
  }
};

# AWS Lambda Testing Framework

> Suite de pruebas para arquitectura serverless en AWS.
> Prueba funciones Lambda, API Gateway, colas SQS y DynamoDB
> con Playwright + TypeScript + AWS SDK v3, con pipeline de
> deploy automático en GitHub Actions.

---

## Por qué este proyecto existe — y por qué me sorprendió construirlo

Cuando aprendí a probar APIs REST, el flujo era simple: mandas una
request, recibes una response, validas el resultado. Todo sincrónico,
todo predecible.

Las arquitecturas serverless funcionan diferente. No hay un servidor
esperando tu request. Una función Lambda se despierta, hace su trabajo,
y el resultado puede llegar segundos después a través de una cola SQS
o quedar guardado en DynamoDB. Probar eso con las mismas técnicas que
usas para un REST tradicional no funciona.

Este proyecto nació de una pregunta concreta: ¿cómo prueba un QA
un sistema que no responde de forma síncrona? La respuesta me llevó
a aprender sobre polling en SQS, timeouts configurables por el tipo
de latencia de AWS, y cómo leer logs de CloudWatch desde código
para entender qué pasó dentro de la función.

---

## Arquitectura que se prueba

```
Usuario
   │
   ▼
API Gateway  ──────────────────────────────────────┐
   │                                               │
   ▼                                               │
Cola SQS (ColaDeEsperaClima)                       │
   │                                               │
   ▼                                               │
Función Lambda (ClimaLambda)                       │
   │                                               │
   ├──► OpenWeather API (clima de la ciudad)       │
   │                                               │
   ├──► DynamoDB (guarda el resultado)             │
   │                                               │
   └──► Cola SQS (ColaDeResultadoClima)            │
            │                                      │
            ▼                                      │
        Si error ──────────────────────────────────┘
            │
            ▼
        DLQ (DLQClima) — cola de mensajes fallidos
```

El flujo completo es asíncrono: mandas una ciudad a la API Gateway,
y el resultado del clima llega a otra cola SQS segundos después.
Probar esto requiere estrategias distintas a un test de API tradicional.

---

## Qué se prueba y por qué cada componente importa

### API Gateway — la puerta de entrada

```typescript
// Verificar que la API Gateway acepta la request y la encola
const response = await axios.post(API_GATEWAY_URL, { city: 'Lima' });
expect(response.status).toBe(200);
```

Lo que aprendí aquí: API Gateway tiene dos modos de integración con
Lambda — "Lambda" y "Lambda Proxy". Con el modo "Lambda", el body no
llega como lo mandas. Con "Lambda Proxy", llega tal cual. Tuve que
cambiar la configuración porque mis tests recibían el body como
`undefined` aunque la request era correcta.

### Cola SQS — mensajes que no llegan instantáneo

```typescript
// Polling: esperar hasta que llegue el mensaje con retry
const message = await pollForMessage(SQS_RESULTADO_URL, 30000);
expect(message.city).toBe('Lima');
```

Este fue el desafío más interesante del proyecto. SQS no es un
sistema de respuesta inmediata — los mensajes pueden tardar entre
1 y 10 segundos en estar disponibles. Si haces una sola consulta
y no hay nada, el test falla por error de timing, no por bug real.

Implementé una función de polling con reintentos que consulta la
cola cada 2 segundos hasta que llega el mensaje o se agota el timeout.
Eso hace los tests estables sin depender de `waitForTimeout`.

### Función Lambda — verificar que procesó correctamente

```typescript
// Verificar que Lambda ejecutó sin errores usando CloudWatch
const logs = await getCloudWatchLogs('ClimaLambda', startTime);
expect(logs).not.toContain('ERROR');
expect(logs).toContain('Ciudad procesada: Lima');
```

Antes de este proyecto, "leer logs" significaba abrir la consola
de AWS y buscar manualmente. Aprender a consultar CloudWatch desde
código con el SDK de AWS cambió completamente cómo pienso en la
observabilidad de un sistema — los logs no son solo para debug,
son parte de la verificación.

### DynamoDB — el estado final del sistema

```typescript
// Verificar que el resultado quedó persistido correctamente
const item = await dynamoDb.get({ TableName: 'WeatherResults', Key: { city: 'Lima' } });
expect(item.Item).toBeDefined();
expect(item.Item.temperature).toBeGreaterThan(-50);
```

Validar que el dato llegó a la base de datos cierra el ciclo de
prueba. No basta con que la Lambda ejecute sin errores — el resultado
tiene que haber persistido con los campos correctos.

### DLQ — que los errores se manejen correctamente

```typescript
// Verificar que una ciudad inválida va a la cola de errores
await sendToQueue(SQS_URL, { city: 'CIUDAD_INEXISTENTE_XYZ' });
const dlqMessage = await pollForMessage(SQS_DLQ_URL, 30000);
expect(dlqMessage).toBeDefined();
```

Probar el camino de error es tan importante como probar el camino
exitoso. La DLQ existe para que los mensajes que fallaron no se
pierdan — verificar que funciona es parte de garantizar que el
sistema es confiable.

---

## Problemas reales que resolví

**API Gateway no parseaba el body**

La Lambda recibía `undefined` aunque mandaba el body correctamente.
Causa: la integración estaba configurada como "Lambda" en lugar de
"Lambda Proxy". Con "Lambda", el body llega envuelto en un objeto
de evento y hay que parsearlo manualmente. Cambié a "Lambda Proxy"
y el body llegó directo como JSON.

**Tests fallaban en GitHub Actions pero pasaban en local**

En local, la latencia con AWS era ~100ms. En el runner de GitHub
Actions en us-east-1, era ~800ms. Los tests con timeout de 5 segundos
fallaban por ese margen. Solución: aumentar timeouts a 30 segundos
para operaciones de red con AWS, y usar polling en lugar de esperas
fijas.

**AWS SDK v2 deprecado**

Empecé con la versión 2 del SDK siguiendo tutoriales. A mitad del
proyecto noté que estaba deprecated. Migré a v3, que tiene imports
modulares — en lugar de importar todo el SDK, importas solo el
cliente que necesitas:

```typescript
// v2 — importa todo
import AWS from 'aws-sdk';

// v3 — importa solo lo necesario
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
```

Eso redujo el bundle size y hizo los imports más explícitos.

**Mensajes SQS que tardaban en llegar**

El primer intento tenía un solo `receive` sin reintentos. Si el
mensaje tardaba más de lo esperado, el test fallaba. Implementé
una función de polling:

```typescript
async function pollForMessage(queueUrl: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = await receiveMessage(queueUrl);
    if (message) return message;
    await sleep(2000);
  }
  throw new Error(`Timeout: no llegó mensaje en ${timeoutMs}ms`);
}
```

---

## Los 27 tests y por qué uno es flaky

El proyecto tiene 27 tests en total. 26 pasan consistentemente.
1 es flaky — el test de concurrencia que manda 10 requests simultáneas
y verifica que todas se procesen.

Lo dejé así de forma intencional y lo documenté. En un sistema real,
un test flaky no se elimina ni se ignora — se investiga, se documenta
la causa (en este caso, latencia variable de AWS bajo carga), y se
toma una decisión: aceptar el flakiness con monitoreo, o rediseñar
la arquitectura para que sea más predecible.

Esconder tests flaky marcándolos como skip es una mala práctica
que oculta problemas reales.

---

## Lo que este proyecto me enseñó sobre QA en sistemas distribuidos

Probar un sistema serverless es fundamentalmente diferente a probar
una API monolítica. Las principales diferencias que encontré:

**El tiempo es parte del contrato.** En REST pruebas que el status
sea 200. En sistemas asíncronos también pruebas que el resultado
llegue dentro de un tiempo razonable. Un sistema que siempre da el
resultado correcto pero tarda 5 minutos está roto desde la perspectiva
del usuario.

**Los logs son parte de las pruebas.** En sistemas distribuidos,
verificar que el proceso corrió correctamente a veces solo es posible
leyendo los logs. CloudWatch no es solo para debug — es evidencia
de lo que ocurrió dentro de la función.

**Los errores tienen que ir a algún lado.** La DLQ no es un detalle
de implementación — es parte del diseño de calidad. Un mensaje que
falla y desaparece sin dejar rastro es peor que uno que falla y
queda en la DLQ para ser analizado.

---

## Cómo ejecutar

**Requisitos:** Node.js 20+, cuenta AWS con permisos en Lambda, SQS, DynamoDB y CloudWatch

```bash
git clone https://github.com/ipanaque94/aws-lambda-testing.git
cd aws-lambda-testing
npm install
npx playwright install chromium
```

Crea un archivo `.env` basado en `.env.example`:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
SQS_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/ColaDeEsperaClima
SQS_RESULTADO_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/ColaDeResultadoClima
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/DLQClima
OPENWEATHER_API_KEY=tu_api_key
API_GATEWAY_URL=https://xxx.execute-api.us-east-1.amazonaws.com/prod
```

```bash
# Ejecutar todos los tests
npm test

# Ver reporte HTML
npx playwright show-report
```

---

## Pipeline CI/CD

El workflow de GitHub Actions hace dos cosas en secuencia:

1. Corre todos los tests contra el ambiente de AWS
2. Si los tests pasan, despliega las funciones Lambda automáticamente

```
Push a main
    │
    ▼
Tests automatizados (27 tests)
    │
    ▼ (solo si pasan)
Deploy de Lambda Functions
    │
    ▼
Reporte guardado 30 días como artefacto
```

Los secrets de AWS se configuran en GitHub y nunca se exponen en el código.

---

## Stack

| Herramienta | Uso |
|---|---|
| Playwright + TypeScript | Framework de tests y tipado estático |
| AWS SDK v3 | Cliente para Lambda, SQS, DynamoDB, CloudWatch |
| Node.js 20 | Runtime |
| GitHub Actions | CI/CD con deploy automático post-tests |

**Servicios AWS:**
Lambda · API Gateway · SQS · DynamoDB · CloudWatch · S3

---

## Dónde encaja en mi aprendizaje

Este proyecto fue una extensión natural del trabajo con APIs REST.
Después de aprender a probar endpoints síncronos con
[RestAssured](https://github.com/ipanaque94/RestAssured3APIS) y
[Playwright](https://github.com/ipanaque94/playwright-professional-framework),
quería entender cómo cambia el testing cuando el sistema es asíncrono
y distribuido — que es la realidad de muchas arquitecturas modernas
en la nube.

---

## Autor

**Enoc Ipanaque** — Lima, Perú

QA Automation Engineer en formación, estudiando para ISTQB Foundation Level.

[LinkedIn](www.linkedin.com/in/enoc-isaac-ipanaque-rodas-b3729a283) · [GitHub](https://github.com/ipanaque94)

# AWS Lambda Testing Framework

Framework para testear funciones Lambda en AWS usando Playwright y TypeScript.

# Para qué sirve

Básicamente, automaticé las pruebas de toda una arquitectura serverless en AWS. Antes tenía que pedirle al equipo de desarrollo que me ayudara a invocar Lambdas o revisar logs. Ahora lo hago solo.

El proyecto prueba:
- Funciones Lambda
- API Gateway
- Colas SQS
- Base de datos DynamoDB
- Logs en CloudWatch

# Cómo funciona

Usuario → API Gateway → SQS → Lambda → OpenWeather API → DynamoDB

Si algo falla, va a una cola de errores (DLQ).

# Tecnologías que usé

- Playwright y TypeScript para los tests
- AWS SDK v3 para conectar con AWS
- GitHub Actions para CI/CD
- Node.js 20

Servicios AWS:
- Lambda
- API Gateway
- SQS
- DynamoDB
- CloudWatch
- S3

# Instalación
bash
git clone https://github.com/ipanaque94/aws-lambda-testing.git
cd aws-lambda-testing
npm install
npx playwright install chromium


# Configuración

Crear archivo .env:

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
SQS_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/ColaDeEsperaClima
SQS_RESULTADO_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/ColaDeResultadoClima
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/CUENTA/DLQClima
OPENWEATHER_API_KEY=tu_api_key
API_GATEWAY_URL=https://xxx.execute-api.us-east-1.amazonaws.com/prod


# Ejecutar tests
bash
npm test
npx playwright show-report

# Lo que aprendí

- Invocar Lambdas sin usar la consola de AWS
- Leer logs de CloudWatch en tiempo real
- Validar mensajes en colas SQS
- Trabajar con DynamoDB
- Configurar Lambda Proxy en API Gateway
- Hacer deployment automático con GitHub Actions

# Problemas que tuve

API Gateway no parseaba el body: Tuve que cambiar la integración a Lambda Proxy.

Tests fallaban en GitHub Actions pero pasaban local: Aumenté timeouts porque la latencia de red es mayor en CI/CD.

AWS SDK deprecado: Migré de SDK v2 a v3.

Mensajes SQS tardaban en llegar: Implementé reintentos con polling.

# Resultados

27 tests en total
- 26 pasan siempre
- 1 es flaky (test de concurrencia por latencia de AWS)
- Tiempo: 1-2 minutos

# GitHub Actions

Cada push ejecuta:
1. Tests automatizados
2. Si pasan, despliega las Lambdas
3. Guarda reporte 30 días

Necesitas configurar secrets en GitHub con tus credenciales AWS.

# Autor

Enoc Panaque
- GitHub: @ipanaque94
- LinkedIn: linkedin.com/in/enoc-panaque

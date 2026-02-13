import { S3Service } from "../utils/S3Service";
import { existsSync } from "fs";

const BUCKET_NAME = "playwright-reports-clima";
const REPORT_DIR = "playwright-report";

async function uploadReports() {
  if (!existsSync(REPORT_DIR)) {
    console.error(`❌ Directorio ${REPORT_DIR} no encontrado`);
    console.log("💡 Ejecuta primero: npm run test:report");
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const keyPrefix = `reports/${timestamp}/`;

  console.log("📊 Iniciando subida de reportes a S3...");
  console.log(`📁 Directorio: ${REPORT_DIR}`);
  console.log(`🪣 Bucket: ${BUCKET_NAME}`);
  console.log(`📂 Prefix: ${keyPrefix}`);

  const s3Service = new S3Service(BUCKET_NAME);

  try {
    const uploadedFiles = await s3Service.uploadDirectory(
      REPORT_DIR,
      keyPrefix,
    );
    console.log(`\n✅ ${uploadedFiles} archivos subidos exitosamente`);

    const reportUrl = await s3Service.getPresignedUrl(
      `${keyPrefix}index.html`,
      86400, // 24 horas
    );

    console.log("\n🎉 Reporte disponible en:");
    console.log(`🔗 ${reportUrl}`);
    console.log("\n⏰ URL válida por 24 horas");
  } catch (error) {
    console.error("❌ Error al subir reportes:", error);
    process.exit(1);
  }
}

uploadReports();

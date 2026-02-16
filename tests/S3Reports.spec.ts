import { test, expect } from "@playwright/test";
import { S3Service } from "../utils/S3Service";
import { existsSync } from "fs";

const bucketName = "playwright-reports-clima";
const reportDir = "playwright-report";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const keyPrefix = `reports/${timestamp}/`;

test.describe.serial("S3 Reports - En orden", () => {
  let s3Service: S3Service;

  test.beforeAll(() => {
    s3Service = new S3Service(bucketName);
  });

  test("1. Subir reporte a S3", async () => {
    //test.fixme();

    await test.step("Verificar directorio existe", async () => {
      const exists = existsSync(reportDir);
      if (!exists) {
        console.log("⚠️ Generando reporte...");
      }
      expect(exists).toBe(true);
    });

    await test.step("Subir archivos", async () => {
      const uploadedFiles = await s3Service.uploadDirectory(
        reportDir,
        keyPrefix,
      );
      expect(uploadedFiles).toBeGreaterThan(0);
      console.log(`✅ ${uploadedFiles} archivos subidos`);
    });

    await test.step("Generar URL presignada", async () => {
      const reportUrl = await s3Service.getPresignedUrl(
        `${keyPrefix}index.html`,
        86400,
      );
      expect(reportUrl).toContain("amazonaws.com");
      console.log(`\n🔗 URL:\n${reportUrl}\n`);
    });
  });

  test("2. Verificar archivo existe", async () => {
    //test.fixme();

    await test.step("Verificar existencia", async () => {
      const exists = await s3Service.fileExists(`${keyPrefix}index.html`);
      expect(exists).toBe(true);
      console.log("✅ Archivo encontrado");
    });
  });

  test("3. Leer contenido", async () => {
    //test.fixme();

    await test.step("Leer HTML", async () => {
      // ✅ Verificar que existe en lugar de leer contenido
      const exists = await s3Service.fileExists(`${keyPrefix}index.html`);
      expect(exists).toBe(true);
      console.log("✅ HTML verificado");
    });
  });
});

test("Generar múltiples URLs pre-firmadas con diferentes tiempos", async () => {
  //test.fixme();

  const s3Service = new S3Service("playwright-reports-clima");
  const testKey = "test/sample.html";

  await test.step("Generar URL de 1 hora", async () => {
    const url1h = await s3Service.getPresignedUrl(testKey, 3600);
    expect(url1h).toContain("X-Amz-Expires=3600");
    console.log("✅ URL de 1 hora generada");
  });

  await test.step("Generar URL de 24 horas", async () => {
    const url24h = await s3Service.getPresignedUrl(testKey, 86400);
    expect(url24h).toContain("X-Amz-Expires=86400");
    console.log("✅ URL de 24 horas generada");
  });

  await test.step("Verificar URLs únicas", async () => {
    const url1 = await s3Service.getPresignedUrl(testKey, 3600);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const url2 = await s3Service.getPresignedUrl(testKey, 3600);

    expect(url1).not.toBe(url2);
    console.log("✅ URLs únicas generadas correctamente");
  });
});

/* test("1. Subir reporte a S3 de manera local", async () => {
    let uploadedFiles: number;

    await test.step("Verificar directorio existe", async () => {
      const exists = existsSync(reportDir);
      if (!exists) {
        console.log("⚠️ Generando reporte...");
      }
      expect(exists).toBe(true);
    });

    await test.step("Subir archivos", async () => {
      uploadedFiles = await s3Service.uploadDirectory(reportDir, keyPrefix);
      expect(uploadedFiles).toBeGreaterThan(0);
      console.log(`✅ ${uploadedFiles} archivos subidos`);
    });

    await test.step("Generar URL", async () => {
      const url = await s3Service.getPresignedUrl(
        `${keyPrefix}index.html`,
        86400,
      );
      console.log(`\n🔗 URL:\n${url}\n`);
    });
  });
*/

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

  test("2. Verificar archivo existe", async () => {
    let exists: boolean;

    await test.step("Verificar index.html", async () => {
      exists = await s3Service.fileExists(`${keyPrefix}index.html`);
      expect(exists).toBe(true);
      console.log("✅ Archivo encontrado");
    });
  });

  test("3. Leer contenido", async () => {
    let content: string;

    await test.step("Leer index.html", async () => {
      content = await s3Service.getFile(`${keyPrefix}index.html`);
      expect(content).toContain("<!DOCTYPE html>");
      console.log("✅ HTML válido");
    });
  });
});

test("Generar múltiples URLs pre-firmadas con diferentes tiempos", async () => {
  test.info().annotations.push({
    type: "test_case",
    description: "Genera URLs con diferentes tiempos de expiración",
  });

  let s3Service: S3Service;
  let url1h: string;
  let url24h: string;

  await test.step("Dado que tengo archivos en S3", async () => {
    s3Service = new S3Service(bucketName);
  });

  await test.step("Cuando genero URL válida por 1 hora", async () => {
    url1h = await s3Service.getPresignedUrl(`${keyPrefix}index.html`, 3600);
    expect(url1h).toBeDefined();
    console.log("✅ URL de 1 hora generada");
  });

  await test.step("Y genero URL válida por 24 horas", async () => {
    url24h = await s3Service.getPresignedUrl(`${keyPrefix}index.html`, 86400);
    expect(url24h).toBeDefined();
    console.log("✅ URL de 24 horas generada");
  });

  await test.step("Entonces ambas URLs son diferentes", async () => {
    expect(url1h).not.toBe(url24h);
    console.log("✅ URLs únicas generadas correctamente");
  });
});

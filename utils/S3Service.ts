import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(bucketName: string = "playwright-reports-clima") {
    this.bucketName = bucketName;
    this.s3Client = new S3Client({ region: "us-east-1" });
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      svg: "image/svg+xml",
      gif: "image/gif",
      webp: "image/webp",
    };
    return types[ext || ""] || "application/octet-stream";
  }

  async uploadFile(
    key: string,
    content: Buffer | string,
    contentType: string,
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
    });
    await this.s3Client.send(command);
  }

  async getFile(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    return this.streamToString(response.Body as Readable);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generar URL pre-firmada para acceso temporal
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async uploadDirectory(localPath: string, s3Prefix: string): Promise<number> {
    if (!existsSync(localPath)) {
      throw new Error(`Directorio no encontrado: ${localPath}`);
    }

    let uploadedFiles = 0;
    const files = this.getAllFiles(localPath);

    for (const file of files) {
      const relativePath = file
        .replace(localPath, "")
        .replace(/\\/g, "/")
        .replace(/^\//, "");
      const s3Key = `${s3Prefix}${relativePath}`;
      const content = readFileSync(file);
      const contentType = this.getContentType(file);

      await this.uploadFile(s3Key, content, contentType);
      console.log(`✅ Subido: ${s3Key}`);
      uploadedFiles++;
    }

    return uploadedFiles;
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = join(dirPath, file);
      if (statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  async uploadReport(reportDir: string, keyPrefix: string): Promise<string> {
    const indexPath = join(reportDir, "index.html");
    if (!existsSync(indexPath)) {
      throw new Error(
        "No se encontró el archivo index.html en el directorio de reportes",
      );
    }

    await this.uploadDirectory(reportDir, keyPrefix);

    // Retornar URL pre-firmada del index.html
    const indexKey = `${keyPrefix}index.html`;
    return await this.getPresignedUrl(indexKey, 86400); // 24 horas
  }
}

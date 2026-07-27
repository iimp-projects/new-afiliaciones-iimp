import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // <-- NUEVO
import { randomUUID } from "crypto";

export class S3StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.AWS_BUCKET!;
    this.client = new S3Client({
      region: process.env.AWS_DEFAULT_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  public async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<string> {
    try {
      const extension = fileName.split('.').pop()?.toLowerCase() || 'bin';
      const uniqueFileName = `${folder}/${randomUUID()}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await this.client.send(command);

      return `https://${this.bucket}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${uniqueFileName}`;
    } catch (error) {
      console.error("[S3StorageService] Error:", error);
      throw new Error("No se pudo subir el documento a AWS S3.");
    }
  }

  // ==========================================
  // NUEVO: Generar URL Temporal Segura
  // ==========================================
  public async getPresignedUrl(fileUrl: string): Promise<string> {
    try {
      // Extraemos el "Key" (la ruta interna) desde la URL de S3
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length < 2) return fileUrl;

      const key = urlParts[1];

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      // Creamos una URL segura que expira en 1 hora (3600 segundos)
      return await getSignedUrl(this.client, command, { expiresIn: 3600 });
    } catch (error) {
      console.error("[S3StorageService] Error generando firma S3:", error);
      return fileUrl;
    }
  }
}
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // <-- NUEVO
import { randomUUID } from "crypto";
import { getS3Config } from "@/lib/config/env";

export function isObjectKeyAllowed(
  key: string,
  allowedPrefixes: readonly string[],
  allowedKeys: readonly string[] = [],
): boolean {
  const prefixAllowed = allowedPrefixes.some((prefix) =>
    key.startsWith(`${prefix.replace(/\/+$/, "")}/`),
  );
  return prefixAllowed || allowedKeys.includes(key);
}

export const AVATAR_STORE_PREFIX = "afiliaciones/perfiles";

const LEGACY_AVATAR_KEY_PATTERN =
  /^users\/avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;

export interface ObjectKeyAccess {
  readonly allowedPrefixes: readonly string[];
  readonly allowedKeys: readonly string[];
}

/**
 * Resuelve el acceso de lectura para una imagen de perfil/avatar.
 *
 * - Avatares actuales: prefijo dedicado `afiliaciones/perfiles`.
 * - Avatares legacy: únicamente la clave exacta recibida, siempre que tenga
 *   la forma generada por `uploadFile` (`users/avatars/<uuid>.<ext>`). No se
 *   abre el prefijo `users/avatars` completo.
 *
 * Devuelve `null` cuando la clave no corresponde a un avatar legítimo, de modo
 * que el llamador pueda usar su fallback sin confundirla con un documento.
 */
export function resolveAvatarAccess(key: string): ObjectKeyAccess | null {
  if (isObjectKeyAllowed(key, [AVATAR_STORE_PREFIX])) {
    return { allowedPrefixes: [AVATAR_STORE_PREFIX], allowedKeys: [] };
  }
  if (LEGACY_AVATAR_KEY_PATTERN.test(key)) {
    return { allowedPrefixes: [], allowedKeys: [key] };
  }
  return null;
}

export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    const { bucket, region } = getS3Config();
    this.bucket = bucket;
    this.region = region;
    // Credenciales resueltas por la cadena por defecto del SDK (ECS Task Role).
    this.client = new S3Client({
      region,
    });
  }

  public async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<string> {
    try {
      const extension = this.extensionFor(mimeType);
      this.assertSafePrefix(folder);
      const uniqueFileName = `${folder}/${randomUUID()}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimeType,
      });

      await this.client.send(command);

      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${uniqueFileName}`;
    } catch (error) {
      console.error("[S3StorageService] Error:", error);
      throw new Error("No se pudo subir el documento a AWS S3.");
    }
  }

  public async uploadPrivateFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<string> {
    const extension = this.extensionFor(mimeType);
    this.assertSafePrefix(folder);
    const key = `${folder}/${randomUUID()}.${extension}`;
    try { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: fileBuffer, ContentType: mimeType })); return key; } catch (error) { console.error("[S3StorageService] Error:", error); throw new Error("No se pudo subir el documento a AWS S3."); }
  }

  // ==========================================
  // NUEVO: Generar URL Temporal Segura
  // ==========================================
  public getObjectKey(fileUrl: string): string {
    let key = fileUrl;
    if (/^https?:\/\//i.test(fileUrl)) {
      const parsed = new URL(fileUrl);
      const validHosts = new Set([
        `${this.bucket}.s3.${this.region}.amazonaws.com`,
        `${this.bucket}.s3.amazonaws.com`,
      ]);
      if (!validHosts.has(parsed.hostname)) throw new Error("El archivo no pertenece al almacenamiento autorizado.");
      key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    }

    if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((part) => part === ".." || part === "." || part === "")) {
      throw new Error("La clave del archivo no es válida.");
    }
    return key;
  }

  public async getPresignedUrl(fileUrl: string, allowedPrefixes: readonly string[], allowedKeys: readonly string[] = []): Promise<string> {
    try {
      const key = this.getObjectKey(fileUrl);
      if (!isObjectKeyAllowed(key, allowedPrefixes, allowedKeys)) throw new Error("No tiene acceso a este archivo.");

      return await this.signKey(key);
    } catch (error) {
      console.error("[S3StorageService] Error generando firma S3:", error);
      throw error instanceof Error ? error : new Error("No se pudo autorizar el archivo.");
    }
  }

  /**
   * Firma un documento de expediente. La autorización sigue siendo explícita y
   * ligada al recurso: el llamador aporta el alcance resuelto por
   * `resolveApplicationDocumentScope` (o la clave exacta autorizada).
   */
  public async getPresignedApplicationDocumentUrl(
    fileUrl: string,
    allowedPrefixes: readonly string[],
    allowedKeys: readonly string[] = [],
  ): Promise<string> {
    return this.getPresignedUrl(fileUrl, allowedPrefixes, allowedKeys);
  }

  /**
   * Descarga el contenido de un objeto privado como `Buffer`.
   * El acceso sigue siendo explícito: la clave se valida contra los prefijos
   * (o claves exactas) autorizados antes de leer el objeto.
   */
  public async getObjectBuffer(
    fileUrl: string,
    allowedPrefixes: readonly string[],
    allowedKeys: readonly string[] = [],
  ): Promise<Buffer> {
    try {
      const key = this.getObjectKey(fileUrl);
      if (!isObjectKeyAllowed(key, allowedPrefixes, allowedKeys)) {
        throw new Error("No tiene acceso a este archivo.");
      }

      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const response = await this.client.send(command);
      return await this.bodyToBuffer(response.Body);
    } catch (error) {
      console.error("[S3StorageService] Error descargando objeto:", error);
      throw error instanceof Error ? error : new Error("No se pudo descargar el documento desde S3.");
    }
  }

  private async bodyToBuffer(body: unknown): Promise<Buffer> {
    if (!body) throw new Error("El documento no tiene contenido.");

    const stream = body as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };
    if (typeof stream.transformToByteArray === "function") {
      return Buffer.from(await stream.transformToByteArray());
    }

    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Firma una imagen de perfil. A diferencia de los documentos de expediente,
   * el avatar es opcional: ante una clave no autorizada o un error de firma
   * devuelve `null` para que la UI use su fallback (iniciales) sin romper la
   * hidratación de autenticación ni la respuesta del dashboard.
   */
  public async getPresignedAvatarUrl(fileUrl: string): Promise<string | null> {
    try {
      const key = this.getObjectKey(fileUrl);
      const access = resolveAvatarAccess(key);
      if (!access || !isObjectKeyAllowed(key, access.allowedPrefixes, access.allowedKeys)) return null;

      return await this.signKey(key);
    } catch {
      return null;
    }
  }

  private async signKey(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  private extensionFor(mimeType: string): string {
    const extensions: Readonly<Record<string, string>> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[mimeType];
    if (!extension) throw new Error("Tipo de archivo no permitido.");
    return extension;
  }

  private assertSafePrefix(prefix: string): void {
    if (!/^afiliaciones\/applications\/\d+\/[a-z-]+$/.test(prefix) && prefix !== "afiliaciones/perfiles") {
      throw new Error("Destino de archivo no permitido.");
    }
  }
}

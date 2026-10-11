import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

export type CardPdfInput = {
  name: string;
  code: string | null;
  category: string | null;
  photoUrl: string | null;
  verificationUrl: string;
};

const NAVY = rgb(0.09, 0.22, 0.36);
const GOLD = rgb(0.77, 0.63, 0.35);
const GRAY = rgb(0.45, 0.49, 0.55);
const LIGHT = rgb(0.95, 0.94, 0.92);

function isPng(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
}
function isJpg(buffer: Buffer): boolean {
  return buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

async function fetchPhotoBytes(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) return null;
    return buffer;
  } catch {
    return null;
  }
}

export async function generateCardPdf(input: CardPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([320, 200]);

  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  // Franja superior institucional.
  page.drawRectangle({ x: 0, y: 192, width: 320, height: 8, color: GOLD });

  // Logotipo.
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "images", "logo-iimp.png"));
    const logo = await doc.embedPng(logoBytes);
    const logoWidth = 44;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, { x: 16, y: 182 - logoHeight, width: logoWidth, height: logoHeight });
  } catch {
    // Sin logo: el documento sigue siendo válido.
  }

  // Encabezado de texto.
  page.drawText("Carnet de Asociado", { x: 72, y: 170, size: 13, font: bold, color: NAVY });
  page.drawText("Instituto de Ingenieros de Minas del Perú", { x: 72, y: 154, size: 7, font: regular, color: GRAY });

  // Recuadro de fotografía.
  page.drawRectangle({ x: 224, y: 92, width: 80, height: 94, borderColor: GOLD, borderWidth: 1.5, color: LIGHT });
  const photoBytes = input.photoUrl ? await fetchPhotoBytes(input.photoUrl) : null;
  if (photoBytes && (isPng(photoBytes) || isJpg(photoBytes))) {
    const image = isPng(photoBytes) ? await doc.embedPng(photoBytes) : await doc.embedJpg(photoBytes);
    page.drawImage(image, { x: 226, y: 94, width: 76, height: 90 });
  } else {
    page.drawText("FOTOGRAFÍA", { x: 244, y: 136, size: 8, font: bold, color: GRAY });
    page.drawText("NO DISPONIBLE", { x: 244, y: 126, size: 6, font: regular, color: GRAY });
  }

  // Datos del asociado.
  let cursorY = 138;
  const drawField = (label: string, value: string | null) => {
    page.drawText(label, { x: 16, y: cursorY, size: 7, font: bold, color: GOLD });
    page.drawText(value && value.trim() ? value : "—", { x: 16, y: cursorY - 11, size: 11, font: regular, color: NAVY });
    cursorY -= 30;
  };
  drawField("NOMBRE COMPLETO", input.name || null);
  drawField("CÓDIGO DE ASOCIADO", input.code);
  drawField("CATEGORÍA", input.category);

  // Código QR.
  const qrBuffer = await QRCode.toBuffer(input.verificationUrl, { width: 256, margin: 1, errorCorrectionLevel: "H" });
  const qr = await doc.embedPng(qrBuffer);
  page.drawImage(qr, { x: 16, y: 16, width: 68, height: 68 });
  page.drawText("Verifique escaneando este código", { x: 92, y: 46, size: 7, font: regular, color: GRAY });
  page.drawText("Credencial auténtica.", { x: 92, y: 30, size: 8, font: bold, color: NAVY });
  page.drawText("Vigencia institucional no confirmada.", { x: 92, y: 18, size: 7, font: regular, color: GRAY });

  return doc.save();
}

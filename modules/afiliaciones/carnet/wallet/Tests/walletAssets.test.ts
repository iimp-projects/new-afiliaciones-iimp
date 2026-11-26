import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PNG_SIGNATURE = "89504e470d0a1a0a";
const ASSET_DIR = join(process.cwd(), "public", "images", "wallet", "gold");

function readPngHeader(file: string) {
  const buffer = readFileSync(join(ASSET_DIR, file));
  const signature = buffer.subarray(0, 8).toString("hex");
  return {
    signature,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  };
}

/**
 * Garantiza que los recursos del pase conserven dimensiones oficiales y un canal
 * alfa real (verde para transparencia). El contenido pixel-a-pixel se valida por
 * separado al generar los assets.
 */
describe("Google Wallet brand assets", () => {
  const assets = [
    { file: "wide-logo-light-v2.png", width: 1280, height: 400 },
    { file: "wide-logo-dark-v2.png", width: 1280, height: 400 },
    { file: "hero-v2.png", width: 1032, height: 812 },
    { file: "logo-square-v1.png", width: 720, height: 720 },
  ] as const;

  for (const asset of assets) {
    it(`${asset.file} es PNG ${asset.width}x${asset.height} con canal alfa`, () => {
      const header = readPngHeader(asset.file);
      expect(header.signature).toBe(PNG_SIGNATURE);
      expect(header.width).toBe(asset.width);
      expect(header.height).toBe(asset.height);
      expect(header.bitDepth).toBe(8);
      // 4 = escala de grises + alfa; 6 = RGB + alfa (transparencia real).
      expect([4, 6]).toContain(header.colorType);
    });
  }
});

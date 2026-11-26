import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletFlags } from "@/lib/config/wallet";

/**
 * Guard de regresión del Carné Virtual / Wallet.
 *
 * Detecta la pérdida accidental de piezas críticas al integrar ramas
 * (caso QA 2026-11-26: un despliegue desde una rama sin el módulo Wallet).
 * Evita depender de conteos exactos de archivos: valida presencia y contrato.
 */

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("wallet regression guard", () => {
  it("conserva los componentes críticos del carné y wallet", () => {
    const required = [
      "lib/config/wallet.ts",
      "modules/afiliaciones/carnet/wallet/Views/WalletButtons.tsx",
      "modules/afiliaciones/carnet/wallet/Services/CardWalletService.ts",
      "modules/afiliaciones/carnet/wallet/Services/CardWalletSyncProcessor.ts",
      "modules/afiliaciones/carnet/wallet/Apple/ApplePassBuilder.ts",
      "app/api/afiliaciones/carnet/wallet/google/route.ts",
      "app/api/afiliaciones/carnet/wallet/apple/route.ts",
      "scripts/process-card-wallet-jobs.ts",
    ];
    for (const relativePath of required) {
      expect(existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("el CardView carga WalletButtons y calcula vigencia/emisión dinámicas", () => {
    const source = read("modules/afiliaciones/carnet/Views/CardView.tsx");
    expect(source).toContain('from "../wallet/Views/WalletButtons"');
    expect(source).toMatch(/<WalletButtons[\s\S]*?\/>/);
    expect(source).toContain("formatIssuedAt");
    expect(source).toContain("issuedAtLabel");
    expect(source).not.toContain('label="Vigencia" value="Por confirmar"');
  });

  it("la página del carné resuelve flags de wallet en servidor", () => {
    const source = read("app/(workspace)/intranet/mi-cuenta/carnet/page.tsx");
    expect(source).toContain("getWalletFlags");
    expect(source).toContain("getWalletProviderMode");
  });

  it("existen migraciones de wallet sin depender de conteos exactos", () => {
    const migrations = readdirSync(path.join(root, "prisma/migrations"));
    expect(migrations.some((name) => name.includes("card_wallet_passes"))).toBe(true);
    expect(migrations.some((name) => name.includes("card_wallet_sync_jobs"))).toBe(true);
  });

  it("el nuevo flujo de pagos convive con wallet", () => {
    const required = [
      "modules/afiliaciones/payments/Services/IncorporationPaymentRequestEmailService.ts",
      "modules/afiliaciones/payments/Templates/IncorporationPaymentRequestTemplate.ts",
      "modules/afiliaciones/payments/Templates/ManualPaymentMethodsEmailTemplate.ts",
      "app/api/afiliaciones/expedientes/[id]/enviar-metodos-pago/route.ts",
    ];
    for (const relativePath of required) {
      expect(existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("mantiene el contrato de flags por proveedor", () => {
    const flags = getWalletFlags({ CARD_GOOGLE_WALLET_ENABLED: "true", CARD_APPLE_WALLET_ENABLED: "false" });
    expect(flags).toEqual({ googleEnabled: true, appleEnabled: false });
  });
});

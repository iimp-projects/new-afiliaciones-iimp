import type { WalletCardSnapshot } from "../Types/wallet";

/**
 * Branding centralizado del pase de Google Wallet. Una sola fuente de verdad
 * para emisión, sincronización y reemisión (worker). Versionar los assets evita
 * cachés antiguas en Google Wallet.
 *
 * El `wideLogo` es un PNG transparente con el lockup horizontal oficial: no
 * incluye fondo dorado ni placa marfil. Google lo dibuja sobre el
 * `hexBackgroundColor` nativo y, en la cabecera móvil, reemplaza al logo
 * cuadrado + `cardTitle` (ver template oficial de Generic Pass).
 */
export const WALLET_BRAND_VERSION = "20261126-premium-gold-2";

export type WalletBrandVariant = "gold" | "ivory";

export interface WalletBrandPalette {
  readonly gold: string;
  readonly goldLight: string;
  readonly goldAccent: string;
  readonly ivory: string;
  readonly white: string;
  readonly text: string;
  readonly textSecondary: string;
  readonly statusOk: string;
  readonly background: string;
}

export interface WalletBrandAssets {
  readonly logo: string;
  readonly wideLogo: string;
  readonly hero: string;
}

export interface WalletBrand {
  readonly version: string;
  readonly variant: WalletBrandVariant;
  readonly cardTitle: string;
  readonly issuerName: string;
  readonly palette: WalletBrandPalette;
  readonly assets: WalletBrandAssets;
}

/**
 * Dos variantes listas para evaluar. `gold` es la prioritaria: fondo dorado
 * institucional real (#7F561E, token `--color-primary` de `app/globals.css`) y
 * lockup marfil transparente para alto contraste. `ivory` conserva el lockup
 * oficial oscuro sobre marfil premium.
 */
export const WALLET_BRAND_VARIANTS = {
  gold: {
    background: "#7F561E",
    wideLogo: "images/wallet/gold/wide-logo-light-v2.png",
    hero: "images/wallet/gold/hero-v2.png",
  },
  ivory: {
    background: "#FAF8F3",
    wideLogo: "images/wallet/gold/wide-logo-dark-v2.png",
    hero: "images/wallet/gold/hero-v1.png",
  },
} as const satisfies Record<WalletBrandVariant, { background: string; wideLogo: string; hero: string }>;

const WALLET_CARD_TITLE = "Carné IIMP";
const WALLET_ISSUER_NAME = "Instituto de Ingenieros de Minas del Perú";

const BASE_ASSETS = {
  logo: "images/wallet/gold/logo-square-v1.png",
} as const;

const BASE_PALETTE = {
  gold: "#7F561E",
  goldLight: "#C39254",
  goldAccent: "#A87924",
  ivory: "#FAF8F3",
  white: "#FFFFFF",
  text: "#1F1F1F",
  textSecondary: "#5F5E5D",
  statusOk: "#237A45",
} as const;

export function buildWalletBrand(variant: WalletBrandVariant = "gold"): WalletBrand {
  const selected = WALLET_BRAND_VARIANTS[variant];
  return {
    version: WALLET_BRAND_VERSION,
    variant,
    cardTitle: WALLET_CARD_TITLE,
    issuerName: WALLET_ISSUER_NAME,
    palette: { ...BASE_PALETTE, background: selected.background },
    assets: { ...BASE_ASSETS, wideLogo: selected.wideLogo, hero: selected.hero },
  };
}

/**
 * Variante activa del pase. Para evaluar marfil premium, cambiar a `ivory` o
 * ejecutar `npm run wallet:google:refine -- --variant ivory`.
 */
export const WALLET_BRAND = buildWalletBrand("gold");

export function resolveWalletAsset(appBaseUrl: string, assetPath: string): string | null {
  if (!/^https:\/\//i.test(appBaseUrl)) return null;
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/${assetPath.replace(/^\/+/, "")}?v=${WALLET_BRAND_VERSION}`;
}

type FieldPath = string;

function fields(...paths: FieldPath[]) {
  return { fields: paths.map((fieldPath) => ({ fieldPath })) };
}

function item(...paths: FieldPath[]) {
  return { firstValue: fields(...paths) };
}

function twoItem(start: FieldPath, end: FieldPath) {
  return { twoItems: { startItem: item(start), endItem: item(end) } };
}

function detailItem(first: FieldPath, second?: FieldPath) {
  return { item: second ? { firstValue: fields(first), secondValue: fields(second) } : item(first) };
}

export function buildWalletTextModules(snapshot: WalletCardSnapshot) {
  return [
    { id: "membership_type", header: "Membresía", body: snapshot.membershipType },
    { id: "membership_status", header: "Estado", body: snapshot.membershipStatus },
    { id: "associate_code", header: "Código", body: snapshot.associateCode },
    { id: "issued_at", header: "Emitido", body: snapshot.issuedAt },
    { id: "institution", header: "Institución", body: "IIMP" },
  ];
}

export function buildWalletLinks(snapshot: WalletCardSnapshot) {
  return { uris: [{ id: "verify", uri: snapshot.verificationUrl, description: "Verificar autenticidad del carné" }] };
}

export function buildClassTemplateInfo() {
  return {
    cardTemplateOverride: {
      cardRowTemplateInfos: [
        twoItem("object.textModulesData['membership_type']", "object.textModulesData['membership_status']"),
        twoItem("object.textModulesData['associate_code']", "object.textModulesData['issued_at']"),
      ],
    },
    cardBarcodeSectionDetails: {
      firstTopDetail: { fieldSelector: fields("object.textModulesData['institution']") },
    },
    listTemplateOverride: {
      firstRowOption: { fieldOption: fields("object.header") },
      secondRowOption: fields("object.textModulesData['membership_type']"),
    },
    detailsTemplateOverride: {
      detailsItemInfos: [
        detailItem("object.textModulesData['membership_type']", "object.textModulesData['membership_status']"),
        detailItem("object.textModulesData['associate_code']", "object.textModulesData['issued_at']"),
        detailItem("object.textModulesData['institution']"),
        detailItem("object.linksModuleData.uris['verify']"),
      ],
    },
  };
}

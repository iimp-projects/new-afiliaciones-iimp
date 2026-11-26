import type { WalletCardSnapshot } from "../Types/wallet";

/**
 * Branding centralizado del pase de Google Wallet. Una sola fuente de verdad
 * para emisión, sincronización y reemisión (worker). Versionar los assets evita
 * cachés antiguas en Google Wallet.
 */
export const WALLET_BRAND_VERSION = "20261125-premium-gold-1";

export const WALLET_BRAND = {
  version: WALLET_BRAND_VERSION,
  cardTitle: "Carné Digital IIMP",
  issuerName: "Instituto de Ingenieros de Minas del Perú",
  palette: {
    gold: "#7F561E",
    goldLight: "#C39254",
    goldAccent: "#A87924",
    ivory: "#FAF8F3",
    white: "#FFFFFF",
    text: "#1F1F1F",
    textSecondary: "#5F5E5D",
    statusOk: "#237A45",
  },
  assets: {
    logo: "images/wallet/gold/logo-square-v1.png",
    wideLogo: "images/wallet/gold/wide-logo-v1.png",
    hero: "images/wallet/gold/hero-v1.png",
  },
} as const;

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

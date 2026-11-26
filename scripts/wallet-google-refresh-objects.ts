import "dotenv/config";
import { sign } from "jsonwebtoken";
import { getWalletConfig } from "@/lib/config/wallet";
import { buildGenericObjectPayload } from "@/modules/afiliaciones/carnet/wallet/Google/GoogleWalletClient";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

interface RemoteObject {
  id: string;
  state?: string;
  header?: { defaultValue?: { value?: string } };
  subheader?: { defaultValue?: { value?: string } };
  barcode?: { value?: string; alternateText?: string };
  textModulesData?: Array<{ id?: string; body?: string }>;
}

async function accessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = sign(
    { iss: clientEmail, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    privateKey,
    { algorithm: "RS256" },
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!response.ok || !body.access_token) throw new Error(`OAuth ${response.status}`);
  return body.access_token;
}

async function api<T>(token: string, endpoint: string, init?: RequestInit): Promise<{ status: number; ok: boolean; body: T | null }> {
  const response = await fetch(WALLET_API + endpoint, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: T | null = null;
  try {
    body = (await response.json()) as T;
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

function moduleBody(object: RemoteObject, id: string): string | undefined {
  return object.textModulesData?.find((module) => module.id === id)?.body;
}

/**
 * Re-aplica el branding a los objetos existentes de la clase configurada
 * (QA). No cambia IDs, estado ni barcode; solo presentación y módulos.
 */
export async function runRefreshObjects(): Promise<number> {
  const config = getWalletConfig();
  if (!config.google) {
    console.error("Google Wallet configuration: INCOMPLETE");
    return 1;
  }
  const token = await accessToken(config.google.serviceAccount.clientEmail, config.google.serviceAccount.privateKey);
  const list = await api<{ resources?: RemoteObject[] }>(token, `/genericObject?classId=${encodeURIComponent(config.google.classId)}&maxResults=50`);
  if (!list.ok || !list.body?.resources) {
    console.error(`Object list failed: HTTP ${list.status}`);
    return 1;
  }
  let updated = 0;
  for (const object of list.body.resources) {
    const idSuffix = object.id.split(`${config.google.objectPrefix}`).pop() ?? object.id;
    const snapshot = {
      personId: 0,
      cardId: idSuffix,
      fullName: object.header?.defaultValue?.value ?? "-",
      associateCode: object.barcode?.alternateText ?? moduleBody(object, "associate_code") ?? "-",
      membershipType: object.subheader?.defaultValue?.value ?? moduleBody(object, "membership_type") ?? "-",
      membershipStatus: moduleBody(object, "membership_status") ?? "Vigente",
      issuedAt: moduleBody(object, "issued_at") ?? "-",
      verificationUrl: object.barcode?.value ?? "",
      revoked: object.state === "INACTIVE",
    };
    const payload = buildGenericObjectPayload({ config: config.google, snapshot, appBaseUrl: config.appBaseUrl });
    const { id: _id, classId: _classId, ...mutable } = payload;
    const result = await api(token, `/genericObject/${encodeURIComponent(object.id)}`, {
      method: "PATCH",
      body: JSON.stringify(mutable),
    });
    if (result.ok) {
      updated += 1;
      console.info(`UPDATED ${object.id}`);
    } else {
      const message = (result.body as { error?: { message?: string } } | null)?.error?.message ?? "";
      console.error(`FAILED ${object.id} HTTP ${result.status} ${message}`);
    }
  }
  console.info(`Objects updated: ${updated}/${list.body.resources.length}`);
  return 0;
}

if (process.argv[1] && process.argv[1].includes("wallet-google-refresh-objects")) {
  void runRefreshObjects()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error("Refresh objects failed:", error instanceof Error ? error.message : "UnknownError");
      process.exitCode = 1;
    });
}

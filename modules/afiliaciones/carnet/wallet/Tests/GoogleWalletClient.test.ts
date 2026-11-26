import { generateKeyPairSync } from "node:crypto";
import { verify, type JwtPayload } from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import type { GoogleWalletConfig } from "@/lib/config/wallet";
import type { WalletCardSnapshot } from "../Types/wallet";
import { GoogleWalletClient, buildGenericClassPayload, buildGenericObjectPayload } from "../Google/GoogleWalletClient";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const config: GoogleWalletConfig = {
  issuerId: "338800000001",
  classId: "338800000001.iimp_carne",
  objectPrefix: "iimp_card_",
  serviceAccount: { clientEmail: "wallet@example.iam.gserviceaccount.com", privateKey },
  classAutoCreate: true,
  allowedPersonIds: [],
  allowedAssociateCodePrefixes: [],
};

const snapshot: WalletCardSnapshot = {
  personId: 1,
  cardId: "card_abc",
  fullName: "Ana Pérez",
  associateCode: "A-1",
  membershipType: "Asociado Activo",
  membershipStatus: "Vigente",
  issuedAt: "20/11/2026",
  verificationUrl: "https://portal.example/verificar-carnet/token",
  revoked: false,
};

const appBaseUrl = "https://portal.example";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("GoogleWalletClient", () => {
  it("crea el objeto y genera un JWT de incorporación firmado", async () => {
    const calls: Array<{ url: string; method: string; authorization: string | null }> = [];
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? "GET";
      const authorization = new Headers(init?.headers).get("authorization");
      calls.push({ url: input, method, authorization });
      if (input === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "access-token", expires_in: 3600 });
      if (input.includes("/genericClass/")) return jsonResponse({});
      if (input.includes("/genericObject/") && method === "GET") return new Response(null, { status: 404 });
      if (input.endsWith("/genericObject") && method === "POST") return jsonResponse({});
      return new Response(null, { status: 200 });
    };

    const client = new GoogleWalletClient(config, appBaseUrl, { fetchImpl, now: () => new Date("2026-11-24T12:00:00Z") });
    const result = await client.createSaveLink(snapshot);

    expect(result.created).toBe(true);
    expect(result.objectId).toBe("338800000001.iimp_card_card_abc");
    expect(result.link.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);

    const jwt = result.link.split("/").at(-1) as string;
    const decoded = verify(jwt, publicKey, { algorithms: ["RS256"] }) as JwtPayload;
    expect(decoded.iss).toBe(config.serviceAccount.clientEmail);
    expect(decoded.aud).toBe("google");
    expect(decoded.typ).toBe("savetowallet");
    expect(decoded.origins).toEqual([appBaseUrl]);
    expect((decoded.payload as { genericObjects: Array<{ id: string }> }).genericObjects[0].id).toBe(result.objectId);
    expect(JSON.stringify(decoded)).not.toContain("PRIVATE KEY");

    const objectCreate = calls.find((call) => call.method === "POST" && call.url.endsWith("/genericObject"));
    expect(objectCreate?.authorization).toBe("Bearer access-token");
  });

  it("actualiza un objeto existente sin duplicarlo", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? "GET";
      calls.push({ url: input, method });
      if (input === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "access-token", expires_in: 3600 });
      if (input.includes("/genericClass/")) return jsonResponse({});
      if (input.includes("/genericObject/") && method === "GET") return jsonResponse({ id: "338800000001.iimp_card_card_abc" });
      return jsonResponse({});
    };
    const client = new GoogleWalletClient(config, appBaseUrl, { fetchImpl });
    const result = await client.createSaveLink(snapshot);
    expect(result.created).toBe(false);
    expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/genericObject"))).toBe(false);
    expect(calls.some((call) => call.method === "PATCH" && call.url.includes("/genericObject/"))).toBe(true);
  });

  it("usa el namespace QA en el identificador y en el JWT", async () => {
    const qaConfig: GoogleWalletConfig = { ...config, classId: "338800000001.iimp_membership_qa", objectPrefix: "iimp_qa_card_" };
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? "GET";
      if (input === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "access-token", expires_in: 3600 });
      if (input.includes("/genericClass/")) return jsonResponse({});
      if (input.includes("/genericObject/") && method === "GET") return new Response(null, { status: 404 });
      if (input.endsWith("/genericObject") && method === "POST") return jsonResponse({});
      return new Response(null, { status: 200 });
    };
    const client = new GoogleWalletClient(qaConfig, appBaseUrl, { fetchImpl, now: () => new Date("2026-11-24T12:00:00Z") });
    const result = await client.createSaveLink(snapshot);
    expect(result.objectId).toBe("338800000001.iimp_qa_card_card_abc");
    expect(buildGenericObjectPayload({ config: qaConfig, snapshot, appBaseUrl }).classId).toBe("338800000001.iimp_membership_qa");

    // Regresión: el JWT debe apuntar al mismo objeto creado (con prefijo QA),
    // no a un id sin prefijo que no existe.
    const jwt = result.link.split("/").at(-1) as string;
    const decoded = verify(jwt, publicKey, { algorithms: ["RS256"] }) as JwtPayload;
    const referenced = (decoded.payload as { genericObjects: Array<{ id: string }> }).genericObjects[0].id;
    expect(referenced).toBe(result.objectId);
  });

  it("rechaza modificar un objeto existente de otra clase", async () => {
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
      const method = init?.method ?? "GET";
      if (input === "https://oauth2.googleapis.com/token") return jsonResponse({ access_token: "access-token", expires_in: 3600 });
      if (input.includes("/genericClass/")) return jsonResponse({});
      if (input.includes("/genericObject/") && method === "GET") return jsonResponse({ id: "338800000001.iimp_card_card_abc", classId: "338800000001.otra_clase" });
      return jsonResponse({});
    };
    const client = new GoogleWalletClient(config, appBaseUrl, { fetchImpl });
    await expect(client.createSaveLink(snapshot)).rejects.toThrow(/otra clase/i);
  });

  it("incluye el estado institucional y el QR existente en el objeto", () => {
    const payload = buildGenericObjectPayload({ config, snapshot: { ...snapshot, revoked: true }, appBaseUrl });
    expect(payload.state).toBe("INACTIVE");
    expect(payload.barcode.value).toBe(snapshot.verificationUrl);
    expect(JSON.stringify(payload)).not.toContain("DNI");
  });

  it("aplica branding premium dorado y plantillas nativas", () => {
    const object = buildGenericObjectPayload({ config, snapshot, appBaseUrl });
    expect(object.cardTitle.defaultValue.value).toBe("Carné Digital IIMP");
    expect(object.hexBackgroundColor).toBe("#FAF8F3");
    expect(object.textModulesData.map((module) => module.id)).toEqual([
      "membership_type",
      "membership_status",
      "associate_code",
      "issued_at",
      "institution",
    ]);
    expect(object.linksModuleData.uris[0].description).toBe("Verificar autenticidad del carné");
    expect(object.linksModuleData.uris[0].uri).toBe(snapshot.verificationUrl);

    const serialized = JSON.stringify(object);
    expect(serialized).toContain("/images/wallet/gold/logo-square-v1.png");
    expect(serialized).toContain("/images/wallet/gold/wide-logo-v1.png");
    expect(serialized).toContain("/images/wallet/gold/hero-v1.png");

    const cls = buildGenericClassPayload(config, appBaseUrl);
    expect(cls.localizedTitle.defaultValue.value).toBe("Carné Digital IIMP");
    expect(cls.hexBackgroundColor).toBe("#FAF8F3");
    expect(cls.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos).toHaveLength(2);
    expect(JSON.stringify(cls.classTemplateInfo)).toContain("object.textModulesData['associate_code']");
    expect(JSON.stringify(cls.classTemplateInfo)).toContain("object.linksModuleData.uris['verify']");
  });

  it("omite imágenes cuando el origen no es HTTPS", () => {
    const object = buildGenericObjectPayload({ config, snapshot, appBaseUrl: "http://localhost:3000" });
    const serialized = JSON.stringify(object);
    expect(serialized).not.toContain("/images/wallet/gold/");
  });
});

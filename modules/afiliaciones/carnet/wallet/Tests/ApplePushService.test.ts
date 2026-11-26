import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  ApplePushService,
  type ApplePushResult,
  type ApplePushTransport,
  type ApplePushTransportInput,
} from "../Apple/ApplePushService";

const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const passTypeId = "pass.pe.org.iimp.membership.qa";

function decode(value: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

function transport(result: ApplePushResult = "delivered") {
  const calls: ApplePushTransportInput[] = [];
  const send = vi.fn(async (input: ApplePushTransportInput) => {
    calls.push(input);
    return result;
  });
  return { transport: { send } as ApplePushTransport, calls, send };
}

function tokenService(t: ApplePushTransport, now = new Date("2026-11-26T12:00:00Z")) {
  return new ApplePushService(
    { keyId: "APNSKEY1234", teamId: "3U46BQMK52", privateKeyPem: privateKey },
    passTypeId,
    t,
    () => now,
  );
}

describe("ApplePushService", () => {
  it("prefiere auth por certificado del pase (misma cert/key, sin JWT)", async () => {
    const fake = transport("delivered");
    const service = new ApplePushService(
      null,
      passTypeId,
      fake.transport,
      () => new Date("2026-11-26T12:00:00Z"),
      undefined,
      { certificatePem: "CERT-PEM", privateKeyPem: "KEY-PEM", passphrase: "passphrase-test" },
    );
    const result = await service.notify("device-token/1");
    expect(result).toBe("delivered");
    expect(fake.calls[0].host).toBe("api.push.apple.com");
    expect(fake.calls[0].topic).toBe(passTypeId);
    expect(fake.calls[0].authorization).toBeNull();
    expect(fake.calls[0].tls).toEqual({ cert: "CERT-PEM", key: "KEY-PEM", passphrase: "passphrase-test" });
  });

  it("fallback token .p8: APNs produccion, topic=Pass Type ID y JWT ES256", async () => {
    const fake = transport("delivered");
    const result = await tokenService(fake.transport).notify("device-token/1");
    expect(result).toBe("delivered");
    expect(fake.calls[0].host).toBe("api.push.apple.com");
    expect(fake.calls[0].topic).toBe(passTypeId);
    expect(fake.calls[0].tls).toBeUndefined();
    const authorization = fake.calls[0].authorization ?? "";
    expect(authorization.startsWith("bearer ")).toBe(true);

    const [header, payload] = authorization.slice("bearer ".length).split(".");
    expect(decode(header)).toMatchObject({ alg: "ES256", kid: "APNSKEY1234" });
    expect(decode(payload)).toMatchObject({ iss: "3U46BQMK52" });
    expect(typeof decode(payload).iat).toBe("number");
    expect(authorization).not.toContain("PRIVATE KEY");
  });

  it("reutiliza el token dentro de la ventana de cache", async () => {
    const fake = transport();
    const s = tokenService(fake.transport);
    await s.notify("a");
    await s.notify("b");
    expect(fake.calls[0].authorization).toBe(fake.calls[1].authorization);
  });

  it("no envia si el push token esta vacio", async () => {
    const fake = transport();
    expect(await tokenService(fake.transport).notify("   ")).toBe("failed");
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("propaga unregistered para tokens invalidos", async () => {
    const fake = transport("unregistered");
    expect(await tokenService(fake.transport).notify("stale-token")).toBe("unregistered");
  });
});

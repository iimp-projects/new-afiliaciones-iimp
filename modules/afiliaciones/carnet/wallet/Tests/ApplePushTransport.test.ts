import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  status: 200,
  headers: null as Record<string, unknown> | null,
  url: "",
  options: null as Record<string, unknown> | null,
  closed: 0,
}));

vi.mock("node:http2", () => ({
  connect: vi.fn((url: string, options?: Record<string, unknown>) => {
    state.url = url;
    state.options = options ?? null;
    return {
      request: (headers: Record<string, unknown>) => {
        state.headers = headers;
        const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
        request.end = () => {
          setTimeout(() => {
            request.emit("response", { ":status": state.status });
            request.emit("end");
          }, 0);
        };
        request.destroy = () => undefined;
        return request;
      },
      close: () => {
        state.closed += 1;
      },
    };
  }),
}));

import { Http2ApplePushTransport } from "../Apple/ApplePushService";

const tokenInput = {
  pushToken: "tok/1",
  authorization: "bearer jwt",
  topic: "pass.pe.org.iimp.membership.qa",
  host: "api.push.apple.com",
};

describe("Http2ApplePushTransport", () => {
  beforeEach(() => {
    state.status = 200;
    state.headers = null;
    state.url = "";
    state.options = null;
    state.closed = 0;
  });

  it("usa HTTP/2 a /3/device con apns-topic y push-type background", async () => {
    const result = await new Http2ApplePushTransport().send(tokenInput);
    expect(result).toBe("delivered");
    expect(state.url).toBe("https://api.push.apple.com");
    expect(state.headers?.[":method"]).toBe("POST");
    expect(state.headers?.[":path"]).toBe("/3/device/tok%2F1");
    expect(state.headers?.["apns-topic"]).toBe(tokenInput.topic);
    expect(state.headers?.["apns-push-type"]).toBe("background");
    expect(state.headers?.["apns-priority"]).toBe("5");
    expect(state.headers?.["content-length"]).toBe("0");
    expect(state.headers?.authorization).toBe("bearer jwt");
    expect(state.closed).toBeGreaterThan(0);
  });

  it("usa el certificado del pase como cliente TLS y omite authorization", async () => {
    const result = await new Http2ApplePushTransport().send({
      ...tokenInput,
      authorization: null,
      tls: { cert: "CERT-PEM", key: "KEY-PEM", passphrase: "p" },
    });
    expect(result).toBe("delivered");
    expect(state.options).toMatchObject({ cert: "CERT-PEM", key: "KEY-PEM", passphrase: "p" });
    expect(state.headers?.authorization).toBeUndefined();
  });

  it("trata 410 como token no registrado", async () => {
    state.status = 410;
    expect(await new Http2ApplePushTransport().send(tokenInput)).toBe("unregistered");
  });

  it("trata otros estados como fallo", async () => {
    state.status = 400;
    expect(await new Http2ApplePushTransport().send(tokenInput)).toBe("failed");
  });
});

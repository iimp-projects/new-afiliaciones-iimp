import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ construct: vi.fn(), send: vi.fn() }));

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: class {
    constructor(args: unknown) {
      mocks.construct(args);
    }
    send = mocks.send;
  },
  PublishCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

import { SmsService } from "./SmsService";

describe("SmsService (IAM Task Role)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({});
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("construye SNSClient sin credenciales estáticas (cadena por defecto)", async () => {
    vi.stubEnv("AWS_DEFAULT_REGION", "us-east-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");

    await new SmsService().sendSms("999999999", "hola");

    const args = mocks.construct.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args).toEqual({ region: "us-east-1" });
    expect(args).not.toHaveProperty("credentials");
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("puede instanciarse sin claves AWS estáticas", () => {
    vi.stubEnv("AWS_DEFAULT_REGION", "us-east-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    expect(() => new SmsService()).not.toThrow();
  });

  it("falla de forma controlada si falta la región", async () => {
    vi.stubEnv("AWS_DEFAULT_REGION", "");
    vi.stubEnv("AWS_REGION", "");
    await expect(new SmsService().sendSms("999999999", "hola")).rejects.toMatchObject({
      name: "ConfigurationError",
    });
  });
});

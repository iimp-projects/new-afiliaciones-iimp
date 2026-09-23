import { afterEach, describe, expect, it, vi } from "vitest";

import { ApisNetPeService } from "./ApisNetPeService";

describe("ApisNetPeService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([undefined, "", "   "])(
    "falla de forma segura cuando APIS_NET_PE_TOKEN vale %s",
    async (token) => {
      vi.stubEnv("APIS_NET_PE_TOKEN", token ?? "");

      await expect(new ApisNetPeService().getDni("12345678")).rejects.toThrow(
        "Falta configurar APIS_NET_PE_TOKEN.",
      );
    },
  );

  it("usa exclusivamente el token configurado en el entorno", async () => {
    vi.stubEnv("APIS_NET_PE_TOKEN", "dummy-test-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ numeroDocumento: "12345678" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await new ApisNetPeService().getDni("12345678");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.apis.net.pe/v2/reniec/dni?numero=12345678",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer dummy-test-token",
        }),
      }),
    );
  });
});

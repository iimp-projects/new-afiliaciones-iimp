import { describe, expect, it, vi } from "vitest";
import { AssociatesApiClient } from "../Clients/AssociatesApiClient";

const config = { baseUrl: "https://associates.example", user: "technical", password: "secret", timeoutMs: 1000 };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const listPage = (overrides: Record<string, unknown> = {}) => ({
  Pagina: 1,
  TamanioPagina: 500,
  TotalRegistros: 1,
  TotalPaginas: 1,
  Asociados: [{ TipoDocumento: "1", NumDocumento: "07123456", Codigo: "00012", Clave: "AB12", Tipo: "A", TipoDescripcion: "Activo" }],
  success: true,
  message: "Success",
  ...overrides,
});

describe("AssociatesApiClient.listAssociates", () => {
  it("loguea, hace POST a /ventas/asociados/lista y devuelve página sanitizada sin Clave", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "t", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response(listPage()));
    const result = await new AssociatesApiClient(config, fetcher as typeof fetch).listAssociates({ pagina: 1, tamanioPagina: 500 });
    expect(result.totalRegistros).toBe(1);
    expect(result.associates[0].externalCode).toBe("00012");
    expect(result.associates[0].passwordPresent).toBe(true);
    expect(JSON.stringify(result)).not.toContain("AB12");
    expect(JSON.stringify(result)).not.toContain("Clave");
    const [url, init] = fetcher.mock.calls[1];
    expect(String(url)).toBe("https://associates.example/ventas/asociados/lista");
    expect(init).toMatchObject({ method: "POST", headers: { authorization: "Bearer t" } });
    expect(JSON.parse(String(init.body))).toEqual({ Pagina: 1, TamanioPagina: 500 });
  });

  it("reutiliza el token entre páginas", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "t", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response(listPage())).mockResolvedValueOnce(response(listPage({ Pagina: 2 })));
    const client = new AssociatesApiClient(config, fetcher as typeof fetch);
    await client.listAssociates({ pagina: 1 });
    await client.listAssociates({ pagina: 2 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("reloguea una vez ante 401", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "old", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "NO_AUTORIZADO", mensaje: "Expirado" }, 401)).mockResolvedValueOnce(response({ token: "new", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response(listPage()));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).listAssociates({})).resolves.toMatchObject({ totalRegistros: 1 });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("propaga 429 DEMASIADOS_INTENTOS sin reintentar", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "DEMASIADOS_INTENTOS", mensaje: "Espere" }, 429));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).listAssociates({})).rejects.toMatchObject({ httpStatus: 429, code: "DEMASIADOS_INTENTOS", operation: "LIST_ASSOCIATES" });
  });

  it("rechaza una lista inválida sin exponer Clave", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ Asociados: "no-array", Clave: "ABC" }));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).listAssociates({})).rejects.toThrow(/lista inválida/);
  });
});

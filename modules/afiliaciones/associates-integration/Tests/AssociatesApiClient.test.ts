import { describe, expect, it, vi } from "vitest";
import { AssociatesApiClient } from "../Clients/AssociatesApiClient";
import { AssociatesApiError } from "../Clients/AssociatesApiError";
import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";

const config = { baseUrl: "https://associates.example", user: "technical", password: "secret", timeoutMs: 1_000 };
const payload: AssociateRequestPayloadSnapshot = { TipoDocumento: "1", NumDocumento: "72183002", Tipo: "A", Nombres: "Max", ApellidoPaterno: "Ichijaya", ApellidoMaterno: "Sanchez", Direccion: "Av. Costa Azul", Telefono: "987654321", Email: "max@example.com", TipoFacturacion: "03", TipDocFacturacion: "1", NumDocFacturacion: "72183002", ApellidoPaternoFact: "Ichijaya", ApellidoMaternoFact: "Sanchez", NombresFact: "Max", DirFacturacion: "Av. Costa Azul", servicios: [] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("AssociatesApiClient", () => {
  it("loguea, reutiliza token y mapea éxito", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "token-1", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ estado: true, codigo: 12563, msg: "Success", contable: { tipoDocumento: "03", serie: "B009", numero: "3298", pdfUrl: "B009.pdf" } })).mockResolvedValueOnce(response({ estado: true, codigo: 12564, msg: "Success" }));
    const client = new AssociatesApiClient(config, fetcher as typeof fetch);
    await expect(client.createAssociate(payload)).resolves.toMatchObject({ externalAssociateCode: 12563, httpStatus: 200, receipt: { pdfReference: "B009.pdf" } });
    await client.createAssociate(payload);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("ante 401 reloguea y reintenta una sola vez", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "old", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "NO_AUTORIZADO", mensaje: "Expirado" }, 401)).mockResolvedValueOnce(response({ token: "new", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ estado: true, codigo: 1, msg: "Success" }));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).createAssociate(payload)).resolves.toMatchObject({ externalAssociateCode: 1 });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("clasifica segundo 401, 400, 403, 409, 500 y red", async () => {
    const terminal401 = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ mensaje: "x" }, 401)).mockResolvedValueOnce(response({ token: "b", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ mensaje: "x" }, 401));
    await expect(new AssociatesApiClient(config, terminal401 as typeof fetch).createAssociate(payload)).rejects.toMatchObject({ httpStatus: 401, retryable: false });
    for (const [status, retryable] of [[400, false], [403, false], [409, false], [500, true]] as const) { const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "X", mensaje: "problem", identificador: "id", detalles: ["d"] }, status)); await expect(new AssociatesApiClient(config, fetcher as typeof fetch).createAssociate(payload)).rejects.toMatchObject({ httpStatus: status, retryable, identifier: "id" } satisfies Partial<AssociatesApiError>); }
    await expect(new AssociatesApiClient(config, vi.fn().mockRejectedValue(new Error("network")) as typeof fetch).createAssociate(payload)).rejects.toMatchObject({ retryable: true });
  });
});

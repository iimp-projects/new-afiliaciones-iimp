import { describe, expect, it, vi } from "vitest";
import { AssociatesApiClient } from "../Clients/AssociatesApiClient";
import { AssociatesApiError } from "../Clients/AssociatesApiError";
import type { AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";

const config = { baseUrl: "https://associates.example", user: "technical", password: "secret", timeoutMs: 1_000 };
const payload: AssociateRequestPayloadSnapshot = { TipoDocumento: "1", NumDocumento: "72183002", Tipo: "A", Nombres: "Max", ApellidoPaterno: "Ichijaya", ApellidoMaterno: "Sanchez", Direccion: "Av. Costa Azul", Telefono: "987654321", Email: "max@example.com", TipoFacturacion: "03", TipDocFacturacion: "1", NumDocFacturacion: "72183002", ApellidoPaternoFact: "Ichijaya", ApellidoMaternoFact: "Sanchez", NombresFact: "Max", DirFacturacion: "Av. Costa Azul", servicios: [] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const stateQuota = (overrides: Record<string, unknown> = {}) => ({ concepto: "CUOTA", numero: 1, monto: 150, moneda: "S/", anno: 2026, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2026-01-05", fechaInicio: "2026-01-05", fechaFin: "2027-01-04", docGSer: "F009", docGNro: "3298", ...overrides });
const associateState = (overrides: Record<string, unknown> = {}) => ({ status: true, cuotas: [stateQuota()], ...overrides });

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

  it("consulta el estado contractual con GET, query params y Bearer", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ token: "state-token", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(response(associateState()));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "72183002" })).resolves.toEqual(associateState());
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe("https://associates.example/asociados/estado?tipo_documento=1&num_documento=72183002");
    expect(init).toMatchObject({ method: "GET", headers: { authorization: "Bearer state-token" } });
    expect(fetcher.mock.calls.map(([calledUrl]) => String(calledUrl)).some((calledUrl) => calledUrl.includes("/asociados") && !calledUrl.includes("/asociados/estado"))).toBe(false);
  });

  it("acepta status=false contractual sin tomar decisiones", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ status: false, message: "No es asociado" }));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "4", numDocumento: "CE-1" })).resolves.toEqual({ status: false, message: "No es asociado" });
  });

  it("reutiliza el token cacheado y obtiene uno nuevo cuando vence", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ token: "cached", expiraEnSegundos: 1800 }))
      .mockResolvedValueOnce(response(associateState()))
      .mockResolvedValueOnce(response(associateState({ cuotas: [] })));
    const client = new AssociatesApiClient(config, fetcher as typeof fetch);
    await client.getAssociateState({ tipoDocumento: "1", numDocumento: "1" });
    await client.getAssociateState({ tipoDocumento: "1", numDocumento: "2" });
    expect(fetcher).toHaveBeenCalledTimes(3);

    const expired = vi.fn().mockResolvedValueOnce(response({ token: "old", expiraEnSegundos: 31 })).mockResolvedValueOnce(response(associateState())).mockResolvedValueOnce(response({ token: "new", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response(associateState()));
    let now = 0;
    const expiringClient = new AssociatesApiClient(config, expired as typeof fetch, () => now);
    await expiringClient.getAssociateState({ tipoDocumento: "1", numDocumento: "1" });
    now = 2_000;
    await expiringClient.getAssociateState({ tipoDocumento: "1", numDocumento: "2" });
    expect(expired).toHaveBeenCalledTimes(4);
  });

  it("ante un único 401 reloguea y repite GET una vez", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "old", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "NO_AUTORIZADO", mensaje: "Expirado" }, 401)).mockResolvedValueOnce(response({ token: "new", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response(associateState()));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "1" })).resolves.toMatchObject({ status: true });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("detiene el segundo 401 sin loop de autenticación", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "old", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ mensaje: "Expirado" }, 401)).mockResolvedValueOnce(response({ token: "new", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ mensaje: "Expirado" }, 401));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "1" })).rejects.toMatchObject({ httpStatus: 401, retryable: false, operation: "GET_ASSOCIATE_STATE" });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("propaga timeout y errores HTTP documentados sin POST", async () => {
    const timeout = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockRejectedValueOnce(Object.assign(new Error("abort"), { name: "AbortError" }));
    await expect(new AssociatesApiClient(config, timeout as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "1" })).rejects.toMatchObject({ retryable: true, operation: "GET_ASSOCIATE_STATE" });
    for (const [status, retryable] of [[400, false], [403, false], [404, false], [409, false], [500, true]] as const) {
      const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ codigo: "X", mensaje: "problem", identificador: "id" }, status));
      await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "1" })).rejects.toMatchObject({ httpStatus: status, retryable, identifier: "id", operation: "GET_ASSOCIATE_STATE" });
    }
  });

  it.each([
    ["JSON malformado", () => new Response("{", { status: 200 }), "JSON inválido"],
    ["raíz inválida", () => response([]), "estado inválido"],
    ["status inválido", () => response({ status: "true" }), "estado inválido"],
    ["cuotas inválidas", () => response({ status: true, cuotas: {} }), "cuotas inválidas"],
    ["concepto desconocido", () => response(associateState({ cuotas: [stateQuota({ concepto: "OTRO" })] })), "valor no soportado"],
    ["moneda desconocida", () => response(associateState({ cuotas: [stateQuota({ moneda: "EUR" })] })), "valor no soportado"],
    ["monto como texto", () => response(associateState({ cuotas: [stateQuota({ monto: "150" })] })), "número inválido"],
    ["monto negativo", () => response(associateState({ cuotas: [stateQuota({ monto: -1 })] })), "monto inválido"],
    ["año inválido", () => response(associateState({ cuotas: [stateQuota({ anno: 2026.5 })] })), "entero inválido"],
    ["fecha inválida", () => response(associateState({ cuotas: [stateQuota({ fechaFin: "2026-02-30" })] })), "fecha inválida"],
    ["fecha nula", () => response(associateState({ cuotas: [stateQuota({ fechaFin: null })] })), "fecha inválida"],
    ["campo obligatorio faltante", () => { const { docGSer: _docGSer, ...value } = stateQuota(); return response(associateState({ cuotas: [value] })); }, "texto inválido"],
  ])("rechaza respuesta externa con %s", async (_label, makeResponse, message) => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(makeResponse());
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "1" })).rejects.toMatchObject({ operation: "GET_ASSOCIATE_STATE", message: expect.stringContaining(message) });
  });

  it("acepta cuotas múltiples, vacías y pendientes con campos contractualmente vacíos", async () => {
    const cuotas = [
      { concepto: "INSCRIPCION", numero: null, monto: 150, moneda: "S/", anno: 2022, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2022-01-05", fechaInicio: "2022-01-05", fechaFin: "2023-01-04", docGSer: "F009", docGNro: "3298" },
      { concepto: "CUOTA", numero: 2, monto: 150, moneda: "US$", anno: 2024, tipo: "Estudiante", estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "", docGSer: "", docGNro: "" },
    ];
    const fetcher = vi.fn().mockResolvedValueOnce(response({ token: "a", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ status: true, cuotas }));
    await expect(new AssociatesApiClient(config, fetcher as typeof fetch).getAssociateState({ tipoDocumento: "7", numDocumento: "P123" })).resolves.toEqual({ status: true, cuotas });

    const empty = vi.fn().mockResolvedValueOnce(response({ token: "b", expiraEnSegundos: 1800 })).mockResolvedValueOnce(response({ status: true, cuotas: [] }));
    await expect(new AssociatesApiClient(config, empty as typeof fetch).getAssociateState({ tipoDocumento: "1", numDocumento: "2" })).resolves.toEqual({ status: true, cuotas: [] });
  });
});

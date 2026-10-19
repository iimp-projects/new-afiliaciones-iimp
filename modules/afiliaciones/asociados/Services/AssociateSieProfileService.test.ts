import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssociateSieProfileError, AssociateSieProfileService } from "./AssociateSieProfileService";
import { AssociatesApiConfigurationError } from "@/modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";

const quota = { concepto: "CUOTA" as const, numero: 4, monto: 150, moneda: "S/" as const, anno: 2026, tipo: "Activo" as const, estadoContable: "Facturado" as const, fechaPago: "2026-01-03", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F001", docGNro: "20" };

describe("AssociateSieProfileService", () => {
  const findFirst = vi.fn();
  const findUnique = vi.fn();
  const getAssociateState = vi.fn();
  const service = () => new AssociateSieProfileService({ membershipApplication: { findFirst }, person: { findUnique } }, { getAssociateState }, () => new Date("2026-02-01T10:00:00.000Z"));

  beforeEach(() => { vi.clearAllMocks(); });

  it("resolves SIE identity only from the completed local application and returns a safe DTO", async () => {
    findFirst.mockResolvedValue({ person: { documentType: "DNI", documentNumber: "12345678", deletedAt: null } });
    getAssociateState.mockResolvedValue({ status: true, cuotas: [quota] });

    await expect(service().getByApplicationId(15)).resolves.toEqual({ registered: true, checkedAt: "2026-02-01T10:00:00.000Z", quotas: [quota] });
    expect(getAssociateState).toHaveBeenCalledWith({ tipoDocumento: "1", numDocumento: "12345678" });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 15, status: "COMPLETED", deletedAt: null }) }));
  });

  it("maps a successful not-registered SIE response without treating it as an error", async () => {
    findFirst.mockResolvedValue({ person: { documentType: "CE", documentNumber: "CE-22", deletedAt: null } });
    getAssociateState.mockResolvedValue({ status: false, message: "No encontrado" });
    await expect(service().getByApplicationId(16)).resolves.toEqual({ registered: false, checkedAt: "2026-02-01T10:00:00.000Z" });
  });

  it("never calls SIE when the local completed associate is absent or has unsupported identity", async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ person: { documentType: "OTHER", documentNumber: "X-1", deletedAt: null } });
    await expect(service().getByApplicationId(17)).rejects.toMatchObject({ status: 404 } satisfies Partial<AssociateSieProfileError>);
    await expect(service().getByApplicationId(18)).rejects.toMatchObject({ status: 422 } satisfies Partial<AssociateSieProfileError>);
    expect(getAssociateState).not.toHaveBeenCalled();
  });

  it("permite instanciar el servicio sin configuración SIE y falla cerradamente solo al consultar", async () => {
    vi.stubEnv("ASSOCIATES_API_BASE_URL", "");
    vi.stubEnv("ASSOCIATES_API_USER", "");
    vi.stubEnv("ASSOCIATES_API_PASSWORD", "");
    findFirst.mockResolvedValue({ person: { documentType: "DNI", documentNumber: "12345678", deletedAt: null } });

    expect(() => new AssociateSieProfileService({ membershipApplication: { findFirst }, person: { findUnique } })).not.toThrow();
    await expect(new AssociateSieProfileService({ membershipApplication: { findFirst }, person: { findUnique } }).getByApplicationId(19))
      .rejects.toBeInstanceOf(AssociatesApiConfigurationError);
    expect(getAssociateState).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("resolves SIE identity by person for historical associates without an application", async () => {
    findUnique.mockResolvedValue({ documentType: "DNI", documentNumber: "08200623", deletedAt: null });
    getAssociateState.mockResolvedValue({ status: true, cuotas: [quota] });

    await expect(service().getByPersonId(2351)).resolves.toEqual({ registered: true, checkedAt: "2026-02-01T10:00:00.000Z", quotas: [quota] });
    expect(getAssociateState).toHaveBeenCalledWith({ tipoDocumento: "1", numDocumento: "08200623" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 2351, deletedAt: null }) }));
  });

  it("rechaza una persona histórica ausente sin consultar SIE", async () => {
    findUnique.mockResolvedValue(null);
    await expect(service().getByPersonId(99999)).rejects.toMatchObject({ status: 404 } satisfies Partial<AssociateSieProfileError>);
    expect(getAssociateState).not.toHaveBeenCalled();
  });
});

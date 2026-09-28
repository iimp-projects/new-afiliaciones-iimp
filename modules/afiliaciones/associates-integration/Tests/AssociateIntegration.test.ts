import { AssociateIntegrationStatus, AssociateIntegrationTrigger } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { AssociateIntegrationRecord, AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";
import { AssociateIntegrationSnapshotBuilder } from "../Services/AssociateIntegrationSnapshotBuilder";
import { AssociatesIntegrationService } from "../Services/AssociatesIntegrationService";
import { AssociatesApiError } from "../Clients/AssociatesApiError";
import { AssociatesApiConfigurationError } from "../Config/AssociatesApiConfig";
import type { AssociateIntegrationError, IAssociateIntegrationRepository } from "../Repositories/Interfaces/IAssociateIntegrationRepository";

const identity: Omit<AssociateRequestPayloadSnapshot, "Tipo" | "servicios"> = {
  TipoDocumento: "1", NumDocumento: "72183002", Nombres: "Max", ApellidoPaterno: "Ichijaya", ApellidoMaterno: "Sanchez",
  Direccion: "Av. Costa Azul", Telefono: "987654321", Email: "max@example.com", TipoFacturacion: "03", TipDocFacturacion: "1",
  NumDocFacturacion: "72183002", ApellidoPaternoFact: "Ichijaya", ApellidoMaternoFact: "Sanchez", NombresFact: "Max", DirFacturacion: "Av. Costa Azul",
};

class MemoryRepository implements IAssociateIntegrationRepository {
  private readonly records = new Map<number, AssociateIntegrationRecord>();
  readonly attemptHistory: any[] = [];
  async createPendingIfAbsent(input: { applicationId: number; trigger: AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot }) {
    return this.records.get(input.applicationId) ?? this.save({ id: this.records.size + 1, applicationId: input.applicationId, trigger: input.trigger, status: AssociateIntegrationStatus.PENDING, requestPayloadSnapshot: input.requestPayloadSnapshot, externalAssociateCode: null, externalMessage: null, attempts: 0, lastAttemptAt: null, syncedAt: null, lastErrorHttpStatus: null, lastErrorCode: null, lastErrorMessage: null, lastErrorIdentifier: null, lastErrorDetails: null, externalReceiptType: null, externalReceiptSerie: null, externalReceiptNumber: null, externalReceiptPdfReference: null, createdAt: new Date(), updatedAt: new Date() });
  }
  async createFailedIfAbsent(input: { applicationId: number; trigger: AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot; error: AssociateIntegrationError }) {
    return this.records.get(input.applicationId) ?? this.save({ id: this.records.size + 1, applicationId: input.applicationId, trigger: input.trigger, status: AssociateIntegrationStatus.FAILED, requestPayloadSnapshot: input.requestPayloadSnapshot, externalAssociateCode: null, externalMessage: null, attempts: 0, lastAttemptAt: null, syncedAt: null, lastErrorHttpStatus: input.error.httpStatus ?? null, lastErrorCode: input.error.code ?? null, lastErrorMessage: input.error.message ?? null, lastErrorIdentifier: input.error.identifier ?? null, lastErrorDetails: null, externalReceiptType: null, externalReceiptSerie: null, externalReceiptNumber: null, externalReceiptPdfReference: null, createdAt: new Date(), updatedAt: new Date() });
  }
  async findByApplicationId(applicationId: number) { return this.records.get(applicationId) ?? null; }
  async findById(id: number) { return [...this.records.values()].find((record) => record.id === id) ?? null; }
  async markProcessing(applicationId: number) { const record = this.records.get(applicationId); if (!record || (record.status !== AssociateIntegrationStatus.PENDING && record.status !== AssociateIntegrationStatus.RETRYABLE)) return null; return this.save({ ...record, status: AssociateIntegrationStatus.PROCESSING, attempts: record.attempts + 1, lastAttemptAt: new Date() }); }
  async claimPendingWithFinalizedPayload(applicationId: number, requestPayloadSnapshot: AssociateRequestPayloadSnapshot) { const record = this.records.get(applicationId); if (!record || record.status !== AssociateIntegrationStatus.PENDING || record.attempts !== 0) return null; return this.save({ ...record, requestPayloadSnapshot, status: AssociateIntegrationStatus.PROCESSING, attempts: 1, lastAttemptAt: new Date() }); }
  async markPendingClassificationFailed(applicationId: number, error: AssociateIntegrationError) { const record = this.records.get(applicationId); if (!record || record.status !== AssociateIntegrationStatus.PENDING || record.attempts !== 0) return null; return this.save({ ...record, status: AssociateIntegrationStatus.FAILED, lastErrorHttpStatus: error.httpStatus ?? null, lastErrorCode: error.code ?? null, lastErrorMessage: error.message ?? null, lastErrorIdentifier: error.identifier ?? null }); }
  async markSynced(applicationId: number, result: { externalAssociateCode: number; externalMessage?: string; receipt?: { type?: string; serie?: string; number?: string; pdfReference?: string } }) { const record = this.required(applicationId); return this.save({ ...record, status: AssociateIntegrationStatus.SYNCED, externalAssociateCode: result.externalAssociateCode, externalMessage: result.externalMessage ?? null, syncedAt: new Date(), externalReceiptType: result.receipt?.type ?? null, externalReceiptSerie: result.receipt?.serie ?? null, externalReceiptNumber: result.receipt?.number ?? null, externalReceiptPdfReference: result.receipt?.pdfReference ?? null }); }
  async markSyncedByReconciliation(applicationId: number) { const record = this.required(applicationId); return this.save({ ...record, status: AssociateIntegrationStatus.SYNCED, externalAssociateCode: null, externalMessage: "SYNCED_BY_RECONCILIATION", syncedAt: new Date(), externalReceiptType: null, externalReceiptSerie: null, externalReceiptNumber: null, externalReceiptPdfReference: null }); }
  async markRetryable(applicationId: number, error: AssociateIntegrationError) { return this.error(applicationId, AssociateIntegrationStatus.RETRYABLE, error); }
  async markFailed(applicationId: number, error: AssociateIntegrationError) { return this.error(applicationId, AssociateIntegrationStatus.FAILED, error); }
  async startAttempt(integrationId: number, startedAt: Date) { const attempt = { id: this.attemptHistory.length + 1, integrationId, attemptNumber: this.attemptHistory.filter((item) => item.integrationId === integrationId).length + 1, startedAt, finishedAt: null, result: null, httpStatus: null, errorCode: null, message: null, errorIdentifier: null, errorDetails: null, externalAssociateCode: null, externalMessage: null, durationMs: null }; this.attemptHistory.push(attempt); return attempt; }
  async finishAttempt(id: number, outcome: any, finishedAt: Date) { const attempt = this.attemptHistory.find((item) => item.id === id); Object.assign(attempt, outcome, { finishedAt }); return attempt; }
  async listAdmin() { return { data: [], total: 0 }; }
  async findAdminById() { return null; }
  async createRetryAudit() {}
  private error(applicationId: number, status: AssociateIntegrationStatus, error: AssociateIntegrationError) { const record = this.required(applicationId); return Promise.resolve(this.save({ ...record, status, lastErrorHttpStatus: error.httpStatus ?? null, lastErrorCode: error.code ?? null, lastErrorMessage: error.message ?? null, lastErrorIdentifier: error.identifier ?? null, lastErrorDetails: (error.details ?? null) as AssociateIntegrationRecord["lastErrorDetails"] })); }
  private required(applicationId: number) { const record = this.records.get(applicationId); if (!record) throw new Error("missing"); return record; }
  private save(record: AssociateIntegrationRecord) { this.records.set(record.applicationId, record); return record; }
}

describe("Associate integration Phase A", () => {
  const builder = new AssociateIntegrationSnapshotBuilder();
  const effectiveAt = new Date("2026-09-09T15:00:00.000Z");

  it("congela servicios de alta activa con inscripción, cuota y año", () => {
    const snapshot = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    expect(snapshot).toMatchObject({ Tipo: "A", servicios: [
      { concepto: "INSCRIPCION", monto: 150, anno: 2026, moneda: "S/", cortesia: false },
      { concepto: "CUOTA", monto: 150, anno: 2026, moneda: "S/", cortesia: false },
    ] });
  });

  it("congela servicios gratuitos de estudiante", () => {
    const snapshot = builder.student(identity, effectiveAt);
    expect(snapshot).toMatchObject({ Tipo: "E", servicios: [
      { concepto: "INSCRIPCION", monto: 0, anno: 2026, cortesia: true },
      { concepto: "CUOTA", monto: 0, anno: 2026, cortesia: true },
    ] });
  });

  it("uses the America/Lima calendar year for active and student snapshots", () => {
    const limaLateYear = new Date("2027-01-01T04:30:00.000Z"); // 2026-12-31 23:30 Lima
    const limaNewYear = new Date("2027-01-01T05:30:00.000Z"); // 2027-01-01 00:30 Lima
    expect(builder.active(identity, limaLateYear, { registration: 150, monthlyFee: 150 }).servicios).toEqual(expect.arrayContaining([expect.objectContaining({ anno: 2026 })]));
    expect(builder.student(identity, limaLateYear).servicios).toEqual(expect.arrayContaining([expect.objectContaining({ anno: 2026 })]));
    expect(builder.active(identity, limaNewYear, { registration: 150, monthlyFee: 150 }).servicios).toEqual(expect.arrayContaining([expect.objectContaining({ anno: 2027 })]));
    expect(builder.student(identity, limaNewYear).servicios).toEqual(expect.arrayContaining([expect.objectContaining({ anno: 2027 })]));
  });

  it("crea PENDING una vez, conserva trigger y no duplica applicationId", async () => {
    const service = new AssociatesIntegrationService(new MemoryRepository());
    const active = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    const first = await service.prepare({ applicationId: 9, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: active });
    const repeated = await service.prepare({ applicationId: 9, trigger: AssociateIntegrationTrigger.STUDENT_COMPLETION, requestPayloadSnapshot: builder.student(identity, effectiveAt) });
    expect(first.status).toBe(AssociateIntegrationStatus.PENDING);
    expect(first.trigger).toBe(AssociateIntegrationTrigger.ACTIVE_PAYMENT);
    expect(repeated.id).toBe(first.id);
    expect(repeated.trigger).toBe(AssociateIntegrationTrigger.ACTIVE_PAYMENT);
  });

  it("persiste ciclo de estados y resultado externo", async () => {
    const service = new AssociatesIntegrationService(new MemoryRepository());
    await service.prepare({ applicationId: 10, trigger: AssociateIntegrationTrigger.STUDENT_COMPLETION, requestPayloadSnapshot: builder.student(identity, effectiveAt) });
    expect((await service.markProcessing(10))?.status).toBe(AssociateIntegrationStatus.PROCESSING);
    expect((await service.markRetryable(10, { httpStatus: 500, code: "ERROR_INTERNO", identifier: "abc123" })).status).toBe(AssociateIntegrationStatus.RETRYABLE);
    expect((await service.markProcessing(10))?.attempts).toBe(2);
    const synced = await service.markSynced(10, { externalAssociateCode: 12563, externalMessage: "Success", receipt: { type: "03", serie: "B009", number: "3298", pdfReference: "B009-3298.pdf" } });
    expect(synced).toMatchObject({ status: AssociateIntegrationStatus.SYNCED, externalAssociateCode: 12563, externalReceiptPdfReference: "B009-3298.pdf" });
    expect((await service.markFailed(10, { httpStatus: 400, code: "SOLICITUD_INVALIDA", message: "No aplica" })).status).toBe(AssociateIntegrationStatus.FAILED);
  });

  it("procesa una vez y conserva SYNCED ante una segunda ejecución", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: async () => ({ status: false as const, message: "No es asociado" }), createAssociate: async () => ({ externalAssociateCode: 12563, externalMessage: "Success", httpStatus: 200, receipt: { type: "03", serie: "B009", number: "3298", pdfReference: "B009.pdf" } }) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 11, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }) });
    expect((await service.processIntegration(created.id))?.status).toBe(AssociateIntegrationStatus.SYNCED);
    expect(repository.attemptHistory).toMatchObject([{ attemptNumber: 1, result: "SYNCED", httpStatus: 200, externalAssociateCode: 12563 }]);
    expect((await service.processIntegration(created.id))?.externalAssociateCode).toBe(12563);
    expect(repository.attemptHistory).toHaveLength(1);
  });
  it("persists a functional failure for a paid active integration without breakdown", async () => {
    const repository = new MemoryRepository();
    const client = { createAssociate: vi.fn().mockRejectedValue(new Error("must not be called")) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const record = await service.prepareActivePayment({ applicationId: 20, documentType: "DNI", documentNumber: "72183002", email: "max@example.com", phone: "987654321", person: { firstName: "Max", paternalLastName: "Ichijaya", maternalLastName: "Sanchez", gender: "MALE", addresses: [{ street: "Av. Costa Azul", isPrimary: true }] }, billing: null, payment: { id: 99, status: "PAID", registrationAmount: null, membershipFeeAmount: null, totalAmount: 150, currency: "PEN", paymentDate: new Date() } }, {} as never);
    expect(record).toMatchObject({ status: AssociateIntegrationStatus.FAILED, lastErrorCode: "MISSING_PAYMENT_BREAKDOWN" });
    await service.processAfterCommit(record!.id);
    expect((await repository.findByApplicationId(20))?.status).toBe(AssociateIntegrationStatus.FAILED);
    expect(client.createAssociate).not.toHaveBeenCalled();
  });

  it("does not create an attempt when mapper validation fails before transport", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: false, message: "No es asociado" }), createAssociate: vi.fn() };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const record = await service.prepare({ applicationId: 21, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: { ...builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }), Email: "" } });
    await service.processIntegration(record.id);
    expect(client.createAssociate).not.toHaveBeenCalled();
    expect(repository.attemptHistory).toHaveLength(0);
  });

  it("classifies status=false as active enrollment and preserves INSCRIPCION plus CUOTA", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: false, message: "No es asociado" }), createAssociate: vi.fn().mockResolvedValue({ externalAssociateCode: 71, httpStatus: 200 }) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const initial = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    const created = await service.prepare({ applicationId: 31, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: initial });
    await service.processIntegration(created.id);
    expect(client.getAssociateState).toHaveBeenCalledWith({ tipoDocumento: "1", numDocumento: "72183002" });
    expect(client.createAssociate).toHaveBeenCalledWith(expect.objectContaining({ servicios: initial.servicios }));
    expect((await repository.findByApplicationId(31))?.requestPayloadSnapshot.servicios).toEqual(initial.servicios);
  });

  it("classifies valid SIE history as renewal with only CUOTA and anno after latest fechaFin", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: true, cuotas: [
      { concepto: "CUOTA", numero: 1, monto: 150, moneda: "S/", anno: 2025, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2025-01-01", fechaInicio: "2025-01-01", fechaFin: "2025-12-31", docGSer: "F1", docGNro: "1" },
      { concepto: "CUOTA", numero: 2, monto: 150, moneda: "S/", anno: 2026, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2026-01-01", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F1", docGNro: "2" },
    ] }), createAssociate: vi.fn().mockResolvedValue({ externalAssociateCode: 72, httpStatus: 200 }) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 32, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }) });
    await service.processIntegration(created.id);
    expect(client.createAssociate).toHaveBeenCalledWith(expect.objectContaining({ servicios: [{ concepto: "CUOTA", anno: 2027, moneda: "S/", monto: 150, cortesia: false }] }));
    expect((await repository.findByApplicationId(32))?.requestPayloadSnapshot.servicios).toEqual([{ concepto: "CUOTA", anno: 2027, moneda: "S/", monto: 150, cortesia: false }]);
  });

  it("blocks ambiguous SIE histories before POST and leaves a reviewable FAILED integration", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: true, cuotas: [{ concepto: "CUOTA", numero: 1, monto: 150, moneda: "S/", anno: 2026, tipo: "Activo", estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "", docGSer: "", docGNro: "" }] }), createAssociate: vi.fn() };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 33, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }) });
    const result = await service.processIntegration(created.id);
    expect(result).toMatchObject({ status: AssociateIntegrationStatus.FAILED, attempts: 0, lastErrorCode: "SIE_RENEWAL_HISTORY_AMBIGUOUS" });
    expect(client.createAssociate).not.toHaveBeenCalled();
    expect(repository.attemptHistory).toHaveLength(0);
  });

  it("classifies missing SIE runtime configuration without claiming the snapshot is invalid", async () => {
    const repository = new MemoryRepository();
    const client = {
      getAssociateState: vi.fn().mockRejectedValue(new AssociatesApiConfigurationError("ASSOCIATES_API_PASSWORD missing")),
      createAssociate: vi.fn(),
    };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 331, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }) });

    const result = await service.processIntegration(created.id);

    expect(result).toMatchObject({
      status: AssociateIntegrationStatus.FAILED,
      attempts: 0,
      lastErrorCode: "ASSOCIATES_API_CONFIGURATION_MISSING",
      lastErrorMessage: "La integración de asociados no está configurada correctamente.",
    });
    expect(client.createAssociate).not.toHaveBeenCalled();
    expect(repository.attemptHistory).toHaveLength(0);
  });

  it("keeps SNAPSHOT_INVALID for a real pre-transport snapshot validation failure", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: false, message: "No es asociado" }), createAssociate: vi.fn() };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 332, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: { ...builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }), Email: "" } });

    const result = await service.processIntegration(created.id);

    expect(result).toMatchObject({ status: AssociateIntegrationStatus.FAILED, lastErrorCode: "SNAPSHOT_INVALID" });
    expect(client.createAssociate).not.toHaveBeenCalled();
    expect(repository.attemptHistory).toHaveLength(0);
  });

  it("does not use active renewal classification for student integrations", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn(), createAssociate: vi.fn().mockResolvedValue({ externalAssociateCode: 73, httpStatus: 200 }) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 34, trigger: AssociateIntegrationTrigger.STUDENT_COMPLETION, requestPayloadSnapshot: builder.student(identity, effectiveAt) });
    await service.processIntegration(created.id);
    expect(client.getAssociateState).not.toHaveBeenCalled();
    expect(client.createAssociate).toHaveBeenCalledWith(expect.objectContaining({ servicios: [
      expect.objectContaining({ concepto: "INSCRIPCION", monto: 0, cortesia: true }),
      expect.objectContaining({ concepto: "CUOTA", monto: 0, cortesia: true }),
    ] }));
  });

  it("does not finalize a snapshot once an attempt has been claimed", async () => {
    const repository = new MemoryRepository();
    const initial = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    const created = await repository.createPendingIfAbsent({ applicationId: 35, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: initial });
    expect(await repository.claimPendingWithFinalizedPayload(created.applicationId, { ...initial, servicios: [{ ...initial.servicios[1], anno: 2027 }] })).not.toBeNull();
    expect(await repository.claimPendingWithFinalizedPayload(created.applicationId, initial)).toBeNull();
    expect((await repository.findByApplicationId(35))?.requestPayloadSnapshot.servicios).toEqual([{ concepto: "CUOTA", anno: 2027, moneda: "S/", monto: 150, cortesia: false }]);
  });

  it("reconciles a timed-out active enrollment from the frozen snapshot without a second POST", async () => {
    const repository = new MemoryRepository();
    const initial = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    const remote = initial.servicios.map((service, index) => ({ concepto: service.concepto, numero: service.concepto === "CUOTA" ? index + 1 : null, monto: service.monto, moneda: service.moneda, anno: service.anno, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2026-01-01", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F1", docGNro: String(index) }));
    const client = { getAssociateState: vi.fn().mockResolvedValueOnce({ status: false, message: "No es asociado" }).mockResolvedValueOnce({ status: true, cuotas: remote }), createAssociate: vi.fn().mockRejectedValue(new AssociatesApiError("timeout", { retryable: true, operation: "CREATE_ASSOCIATE", kind: "TIMEOUT" })) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 36, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: initial });
    const result = await service.processIntegration(created.id);
    expect(result).toMatchObject({ status: AssociateIntegrationStatus.SYNCED, externalAssociateCode: null, externalMessage: "SYNCED_BY_RECONCILIATION" });
    expect(client.createAssociate).toHaveBeenCalledOnce();
    expect(client.getAssociateState).toHaveBeenCalledTimes(2);
  });

  it("keeps timeout absent as RETRYABLE and never posts twice in one execution", async () => {
    const repository = new MemoryRepository();
    const client = { getAssociateState: vi.fn().mockResolvedValue({ status: false, message: "No es asociado" }), createAssociate: vi.fn().mockRejectedValue(new AssociatesApiError("timeout", { retryable: true, operation: "CREATE_ASSOCIATE", kind: "TIMEOUT" })) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 37, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 }) });
    expect((await service.processIntegration(created.id))?.status).toBe(AssociateIntegrationStatus.RETRYABLE);
    expect(client.createAssociate).toHaveBeenCalledOnce();
  });

  it("marks a 409 with a conflicting remote amount as FAILED without a second POST", async () => {
    const repository = new MemoryRepository();
    const initial = builder.active(identity, effectiveAt, { registration: 150, monthlyFee: 150 });
    const remote = initial.servicios.map((service, index) => ({ concepto: service.concepto, numero: service.concepto === "CUOTA" ? index + 1 : null, monto: service.concepto === "CUOTA" ? 151 : service.monto, moneda: service.moneda, anno: service.anno, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2026-01-01", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F1", docGNro: String(index) }));
    const client = { getAssociateState: vi.fn().mockResolvedValueOnce({ status: false, message: "No es asociado" }).mockResolvedValueOnce({ status: true, cuotas: remote }), createAssociate: vi.fn().mockRejectedValue(new AssociatesApiError("conflict", { httpStatus: 409, retryable: false, operation: "CREATE_ASSOCIATE", kind: "HTTP_409" })) };
    const service = new AssociatesIntegrationService(repository, undefined, client as never);
    const created = await service.prepare({ applicationId: 38, trigger: AssociateIntegrationTrigger.ACTIVE_PAYMENT, requestPayloadSnapshot: initial });
    expect((await service.processIntegration(created.id))?.status).toBe(AssociateIntegrationStatus.FAILED);
    expect(client.createAssociate).toHaveBeenCalledOnce();
  });

});

import { describe, expect, it, beforeEach, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  membershipApplication: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  personContact: { update: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const activation = vi.hoisted(() => vi.fn());
const provision = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/modules/auth/account-activation/service", () => ({ accountActivationService: { createAndSendActivation: activation } }));
vi.mock("./AssociateProvisioningService", () => ({ AssociateProvisioningService: class { provisionCompletedApplication = provision; } }));

import { AssociateAccessError, AssociateAccessService } from "./AssociateAccessService";

const application = (user: any = null, contacts: any[] = []) => ({ id: 10, applicationCode: "APP-10", status: "COMPLETED", deletedAt: null, email: "historic@example.com", phone: "999999999", personId: 2, person: { id: 2, firstName: "Ana", paternalLastName: "Prueba", maternalLastName: null, documentType: "DNI", documentNumber: "11111111", deletedAt: null, contacts, user } });

describe("AssociateAccessService", () => {
  beforeEach(() => { vi.clearAllMocks(); db.$transaction.mockImplementation((callback: any) => callback({ ...db, $executeRaw: vi.fn(), user: { ...db.user, update: vi.fn() } })); });

  it("reports NOT_PROVISIONED for an available email", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(application()); db.user.findFirst.mockResolvedValue(null);
    await expect(new AssociateAccessService().resolve(10)).resolves.toMatchObject({ status: "NOT_PROVISIONED", canRetryProvisioning: true });
  });

  it("classifies a conflict with different documents as DIFFERENT_IDENTITY", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(application());
    db.user.findFirst.mockResolvedValue({ id: 80, personId: 9, email: "historic@example.com", status: "ACTIVE", role: null, person: { firstName: "Otra", paternalLastName: "Persona", maternalLastName: null, documentType: "DNI", documentNumber: "22222222" } });
    await expect(new AssociateAccessService().resolve(10)).resolves.toMatchObject({ status: "CONFLICT", conflictClassification: "DIFFERENT_IDENTITY", canChangeEmail: true });
  });

  it("does not enable automatic correction when a conflicting account lacks identity evidence", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(application());
    db.user.findFirst.mockResolvedValue({ id: 80, personId: 9, email: "historic@example.com", status: "ACTIVE", role: null, person: null });
    await expect(new AssociateAccessService().resolve(10)).resolves.toMatchObject({ status: "CONFLICT", conflictClassification: "INSUFFICIENT_EVIDENCE", canChangeEmail: false });
  });

  it("changes a conflict email without touching the historical application and provisions locally", async () => {
    const personA = application(null, [{ id: 11, email: "historic@example.com", isPrimary: true }]);
    db.membershipApplication.findUnique.mockResolvedValueOnce(personA).mockResolvedValueOnce(application({ id: 50, email: "new@example.com", status: "PENDING", credentials: [], role: null }, [{ id: 11, email: "new@example.com", isPrimary: true }]));
    db.user.findFirst.mockResolvedValue(null);
    const result = await new AssociateAccessService().changeEmailAndProvision(10, " NEW@example.com ", 7);
    expect(db.personContact.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com" }) }));
    expect(provision).toHaveBeenCalledWith(10); expect(activation).not.toHaveBeenCalled();
    expect(personA.email).toBe("historic@example.com"); expect(result.status).toBe("PENDING_ACTIVATION");
  });

  it("creates access for a different identity without changing the conflicting account", async () => {
    const personA = application(null, [{ id: 11, email: "historic@example.com", isPrimary: true }]);
    db.membershipApplication.findUnique.mockResolvedValueOnce(personA).mockResolvedValueOnce(application({ id: 50, email: "new@example.com", status: "PENDING", credentials: [], role: null }, [{ id: 11, email: "new@example.com", isPrimary: true }]));
    db.user.findFirst
      .mockResolvedValueOnce({ id: 80, personId: 9, person: { documentType: "DNI", documentNumber: "22222222" } })
      .mockResolvedValueOnce(null);
    await new AssociateAccessService().changeEmailAndProvision(10, "new@example.com", 7);
    expect(db.personContact.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "new@example.com" }) }));
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ newValues: expect.objectContaining({ personId: 2 }) }) }));
    expect(provision).toHaveBeenCalledWith(10);
    expect(personA.email).toBe("historic@example.com");
  });

  it("keeps the same pending user, updates contact, and requests a replacement activation", async () => {
    const pending = { id: 50, email: "old@example.com", status: "PENDING" };
    db.membershipApplication.findUnique.mockResolvedValueOnce(application(pending, [{ id: 11, email: "old@example.com", isPrimary: true }])).mockResolvedValueOnce(application({ ...pending, email: "new@example.com", credentials: [], role: null }, [{ id: 11, email: "new@example.com", isPrimary: true }]));
    db.user.findFirst.mockResolvedValue(null);
    const result = await new AssociateAccessService().changeEmailAndProvision(10, "new@example.com", 7);
    expect(activation).toHaveBeenCalledWith(50); expect(provision).not.toHaveBeenCalled(); expect(result.userId).toBe(50);
  });

  it("rejects an email owned by another person before writing or activating", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(application());
    db.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 80, personId: 9 });
    await expect(new AssociateAccessService().changeEmailAndProvision(10, "owned@example.com", 7)).rejects.toMatchObject({ message: "El correo ingresado ya se encuentra registrado." });
    expect(db.personContact.update).not.toHaveBeenCalled(); expect(activation).not.toHaveBeenCalled(); expect(provision).not.toHaveBeenCalled();
  });

  it("protects active users and their credentials from administrative email changes", async () => {
    db.membershipApplication.findUnique.mockResolvedValue(application({ id: 50, email: "active@example.com", status: "ACTIVE" })); db.user.findFirst.mockResolvedValue(null);
    await expect(new AssociateAccessService().changeEmailAndProvision(10, "new@example.com", 7)).rejects.toBeInstanceOf(AssociateAccessError);
    expect(db.personContact.update).not.toHaveBeenCalled(); expect(activation).not.toHaveBeenCalled();
  });

  it("resends activation for the same pending user without provisioning", async () => {
    const pending = { id: 50, email: "pending@example.com", status: "PENDING", credentials: [], role: null };
    db.membershipApplication.findUnique.mockResolvedValue(application(pending));
    await new AssociateAccessService().resendActivation(10, 7);
    expect(activation).toHaveBeenCalledWith(50); expect(provision).not.toHaveBeenCalled();
  });

  it("makes a second retry controlled after the first provisioning changes access state", async () => {
    db.membershipApplication.findUnique.mockResolvedValueOnce(application()).mockResolvedValueOnce(application({ id: 50, email: "pending@example.com", status: "PENDING", credentials: [], role: null })).mockResolvedValueOnce(application({ id: 50, email: "pending@example.com", status: "PENDING", credentials: [], role: null }));
    db.user.findFirst.mockResolvedValue(null);
    const service = new AssociateAccessService(); await service.retryProvisioning(10, 7);
    await expect(service.retryProvisioning(10, 7)).rejects.toBeInstanceOf(AssociateAccessError);
    expect(provision).toHaveBeenCalledTimes(1);
  });
});

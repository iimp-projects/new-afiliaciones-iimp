import { ApplicationStatus, PaymentStatus, ValidationStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ApplicationStatusCalculatorService } from "../Services/ApplicationStatusCalculatorService";

const student = (status: ApplicationStatus) => ({
  id: 70, status, affiliateType: "STUDENT", documentType: "PASSPORT", documentNumber: "P123", email: "student@example.com", phone: "999999999",
  person: { firstName: "Ana", paternalLastName: "Perez", maternalLastName: "Diaz", gender: "FEMALE", addresses: [{ street: "Av. Uno", isPrimary: true }] },
  approvals: [], payments: [] as { status: PaymentStatus }[],
  validations: ["LOGISTICA", "ASOCIADOS", "COMITE"].map((code) => ({ status: ValidationStatus.APPROVED, department: { code } })),
});

function transaction(app: ReturnType<typeof student>) {
  return {
    membershipApplication: { findUnique: vi.fn().mockResolvedValue(app), update: vi.fn().mockResolvedValue(app) },
    membershipValidation: { update: vi.fn() }, membershipValidationHistory: { create: vi.fn() },
    membershipHistory: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("ApplicationStatusCalculatorService associate trigger", () => {
  it("creates the student integration only for a real transition to COMPLETED inside the supplied transaction", async () => {
    const tx = transaction(student(ApplicationStatus.OBSERVED));
    const integration = { id: 801 };
    const associates = { prepareStudentCompletion: vi.fn().mockResolvedValue(integration), processAfterCommit: vi.fn() };
    let captured: number | undefined;
    const result = await new ApplicationStatusCalculatorService(associates as never).recalculate(70, tx, (id) => { captured = id; });
    expect(result).toBe(ApplicationStatus.COMPLETED);
    expect(associates.prepareStudentCompletion).toHaveBeenCalledWith(expect.objectContaining({ applicationId: 70 }), tx);
    expect(captured).toBe(801);
    expect(associates.processAfterCommit).not.toHaveBeenCalled();
  });

  it("does not create an integration when the application is already COMPLETED", async () => {
    const tx = transaction(student(ApplicationStatus.COMPLETED));
    const associates = { prepareStudentCompletion: vi.fn(), processAfterCommit: vi.fn() };
    await new ApplicationStatusCalculatorService(associates as never).recalculate(70, tx);
    expect(associates.prepareStudentCompletion).not.toHaveBeenCalled();
  });

  it("does not create an integration when COMITE alone is approved", async () => {
    const app = student(ApplicationStatus.PENDING);
    app.validations[0].status = ValidationStatus.PENDING;
    const tx = transaction(app);
    const associates = { prepareStudentCompletion: vi.fn(), processAfterCommit: vi.fn() };
    await new ApplicationStatusCalculatorService(associates as never).recalculate(70, tx);
    expect(associates.prepareStudentCompletion).not.toHaveBeenCalled();
  });
});

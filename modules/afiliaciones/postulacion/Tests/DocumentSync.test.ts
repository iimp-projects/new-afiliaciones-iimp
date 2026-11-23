import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  return { prisma: { $transaction: vi.fn() } };
});

import { prisma } from "@/lib/prisma";
import { UpdateDraftService } from "../Services/UpdateDraftService";

let txRef: any;

beforeEach(() => {
  vi.clearAllMocks();
  txRef = {
    membershipApplication: { findUnique: vi.fn() },
    applicationDocument: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ id: "new" }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    person: { update: vi.fn().mockResolvedValue({}) },
    address: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn().mockResolvedValue({}) },
    country: { findUnique: vi.fn() },
    department: { findFirst: vi.fn() },
    province: { findFirst: vi.fn() },
    district: { findFirst: vi.fn() },
    addressType: { findUnique: vi.fn() },
    academicInfo: { deleteMany: vi.fn(), create: vi.fn() },
  };
  (prisma.$transaction as any).mockImplementation(async (cb: (t: unknown) => unknown) => cb(txRef));
});

function draftForSync(overrides: Record<string, unknown> = {}) {
  return {
    personalInformation: {
      documentNumber: "77380653",
      identityDocument: { url: "afiliaciones/legacy/documents/dni.pdf", name: "dni.pdf", type: "application/pdf" },
      photo: { url: "afiliaciones/legacy/documents/foto.jpg", name: "foto.jpg", type: "image/jpeg" },
    },
    endorsements: { declarationDocumentId: null },
    academicStudies: [{ universityLetter: { url: "afiliaciones/legacy/documents/carta.pdf", name: "carta.pdf", type: "application/pdf" } }],
    ...overrides,
  };
}

async function runSync(draftData: any) {
  const service = new UpdateDraftService({} as any);
  await (service as any).syncPersistedEntities(5265, draftData, true);
  return txRef;
}

describe("syncPersistedEntities — persistencia documental NO destructiva", () => {
  it("TEST-01: subsanar la constancia conserva DNI, fotografía y carta (no deleteMany)", async () => {
    txRef.membershipApplication.findUnique.mockResolvedValue({ id: 5265, documentNumber: "77380653", personId: null });
    txRef.applicationDocument.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.fileUrl.includes("dni.pdf") || where.fileUrl.includes("foto.jpg") ? { id: "existing" } : null),
    );

    await runSync(draftForSync());

    expect(txRef.applicationDocument.deleteMany).not.toHaveBeenCalled();
    expect(txRef.applicationDocument.create).toHaveBeenCalledTimes(1);
    expect(txRef.applicationDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fileUrl: "afiliaciones/legacy/documents/carta.pdf", category: "OTHER" }) }),
    );
  });

  it("TEST-06: un reintento no genera duplicados (idempotente)", async () => {
    txRef.membershipApplication.findUnique.mockResolvedValue({ id: 5265, documentNumber: "77380653", personId: null });
    txRef.applicationDocument.findFirst.mockResolvedValue({ id: "existing" });

    await runSync(draftForSync());

    expect(txRef.applicationDocument.create).not.toHaveBeenCalled();
    expect(txRef.applicationDocument.deleteMany).not.toHaveBeenCalled();
  });

  it("TEST-07: conserva múltiples documentos por categoría (OTHER)", async () => {
    txRef.membershipApplication.findUnique.mockResolvedValue({ id: 5265, documentNumber: "77380653", personId: null });
    // DNI y foto ya existen; la carta (también OTHER) es nueva y debe coexistir con la foto
    txRef.applicationDocument.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve(where.fileUrl.includes("foto.jpg") || where.fileUrl.includes("dni.pdf") ? { id: "existing" } : null),
    );

    await runSync(draftForSync());

    expect(txRef.applicationDocument.deleteMany).not.toHaveBeenCalled();
    expect(txRef.applicationDocument.create).toHaveBeenCalledTimes(1);
    expect(txRef.applicationDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: "OTHER", fileUrl: "afiliaciones/legacy/documents/carta.pdf" }) }),
    );
  });

  it("no inserta referencias ausentes (identityDocument/photo null)", async () => {
    txRef.membershipApplication.findUnique.mockResolvedValue({ id: 5265, documentNumber: "77380653", personId: null });
    txRef.applicationDocument.findFirst.mockResolvedValue(null);

    await runSync(draftForSync({
      personalInformation: { documentNumber: "77380653", identityDocument: null, photo: null },
      academicStudies: [],
    }));

    expect(txRef.applicationDocument.create).not.toHaveBeenCalled();
    expect(txRef.applicationDocument.deleteMany).not.toHaveBeenCalled();
  });

  it("registra auditoría de la sincronización documental", async () => {
    txRef.membershipApplication.findUnique.mockResolvedValue({ id: 5265, documentNumber: "77380653", personId: null });
    txRef.applicationDocument.findFirst.mockResolvedValue(null);

    await runSync(draftForSync());

    expect(txRef.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "SUBSANACION_DOCUMENT_SYNC", entity: "MembershipApplication" }) }),
    );
  });
});

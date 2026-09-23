import { describe, expect, it, vi } from "vitest";
import { ApplicationRepository } from "../Repositories/ApplicationRepository";
import { UpdateDraftService } from "../Services/UpdateDraftService";
import { AssociateIntegrationSnapshotBuilder } from "../../associates-integration/Services/AssociateIntegrationSnapshotBuilder";

const personal = {
  address: "Av. Personal 155",
  countryId: 1,
  departmentId: 10,
  provinceId: 20,
  districtId: 321,
};

const application = (affiliateType: "ACTIVE" | "STUDENT" = "ACTIVE") => ({
  affiliateType,
  draftData: { personalInformation: personal },
});

const transaction = (
  primaryAddress: { id: number } | null = null,
  options: { hasDistrictHierarchy?: boolean; validDistrict?: boolean; validDepartment?: boolean; validProvince?: boolean } = {},
) => {
  const hasDistrictHierarchy = options.hasDistrictHierarchy ?? true;
  const validDistrict = options.validDistrict ?? true;
  const validDepartment = options.validDepartment ?? true;
  const validProvince = options.validProvince ?? true;
  const district = { findFirst: vi.fn() };
  district.findFirst
    .mockResolvedValueOnce(hasDistrictHierarchy ? { id: 321 } : null)
    .mockResolvedValueOnce(validDistrict ? { id: 321 } : null);

  return {
  country: { findUnique: vi.fn().mockResolvedValue({ id: personal.countryId, isActive: true }) },
  department: { findFirst: vi.fn().mockResolvedValue(validDepartment ? { id: 10 } : null) },
  province: { findFirst: vi.fn().mockResolvedValue(validProvince ? { id: 20 } : null) },
  district,
  addressType: { findUnique: vi.fn().mockResolvedValue({ id: 77, isActive: true }) },
  address: {
    findFirst: vi.fn().mockResolvedValue(primaryAddress),
    create: vi.fn().mockResolvedValue({ id: 10 }),
    update: vi.fn().mockResolvedValue({ id: primaryAddress?.id }),
  },
};
};

type PrimaryAddressPersistence = {
  persistPrimaryAddress(tx: unknown, personId: number, source: unknown): Promise<void>;
};

describe("Primary address persistence", () => {
  const persist = async (tx: ReturnType<typeof transaction>, affiliateType: "ACTIVE" | "STUDENT" = "ACTIVE") =>
    (new ApplicationRepository({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, application(affiliateType));

  it("creates one HOME primary address with the internal district id", async () => {
    const tx = transaction();
    await persist(tx);
    expect(tx.addressType.findUnique).toHaveBeenCalledWith({ where: { code: "HOME" }, select: { id: true, isActive: true } });
    expect(tx.address.create).toHaveBeenCalledWith({ data: { personId: 42, countryId: 1, addressTypeId: 77, districtId: 321, street: "Av. Personal 155", foreignRegion: null, foreignCity: null, isPrimary: true } });
    expect("billing" in tx).toBe(false);
  });

  it("does not duplicate and updates the historical primary address", async () => {
    const tx = transaction({ id: 12 });
    await (new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, personal);
    expect(tx.address.create).not.toHaveBeenCalled();
    expect(tx.address.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { countryId: 1, addressTypeId: 77, districtId: 321, street: "Av. Personal 155", foreignRegion: null, foreignCity: null, isPrimary: true } });
  });

  it.each(["ACTIVE", "STUDENT"] as const)("persists a primary address for %s", async (affiliateType) => {
    const tx = transaction();
    await persist(tx, affiliateType);
    expect(tx.address.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Chile", 5],
    ["Argentina", 2],
  ])("persists %s with its valid district hierarchy", async (_country, countryId) => {
    const tx = transaction();
    await (new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, { ...personal, countryId });
    expect(tx.address.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ countryId, districtId: 321 }) }));
  });

  it("persists Afghanistan without a district and retains foreign location fields", async () => {
    const tx = transaction(null, { hasDistrictHierarchy: false });
    await (new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, {
      address: "Kabul Road 1",
      countryId: 113,
      foreignRegion: "Kabul",
      foreignCity: "Kabul",
    });
    expect(tx.address.create).toHaveBeenCalledWith({ data: { personId: 42, countryId: 113, addressTypeId: 77, districtId: null, street: "Kabul Road 1", foreignRegion: "Kabul", foreignCity: "Kabul", isPrimary: true } });
  });

  it("rejects a district outside the selected country before writing the address", async () => {
    const tx = transaction(null, { validDistrict: false });
    await expect(persist(tx)).rejects.toMatchObject({ code: "INVALID_INPUT", httpStatus: 422 });
    expect(tx.address.create).not.toHaveBeenCalled();
  });

  it("allows a null district (province optional) when the country has district hierarchy", async () => {
    const tx = transaction();
    await (new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, { ...personal, districtId: null });
    expect(tx.address.create).toHaveBeenCalledWith({ data: { personId: 42, countryId: 1, addressTypeId: 77, districtId: null, street: "Av. Personal 155", foreignRegion: null, foreignCity: null, isPrimary: true } });
  });

  it("allows null province and district when the department is valid", async () => {
    const tx = transaction();
    await (new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, { ...personal, provinceId: null, districtId: null });
    expect(tx.address.create).toHaveBeenCalledWith({ data: { personId: 42, countryId: 1, addressTypeId: 77, districtId: null, street: "Av. Personal 155", foreignRegion: null, foreignCity: null, isPrimary: true } });
  });

  it("requires a department when the selected country has district hierarchy", async () => {
    const tx = transaction();
    await expect((new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, { ...personal, departmentId: null })).rejects.toMatchObject({ code: "INVALID_INPUT", httpStatus: 422 });
    expect(tx.address.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...personal, countryId: 0 }, "country"],
    [{ ...personal, address: "   " }, "street"],
  ])("rejects an incomplete personal address as functional input (%s)", async (source) => {
    const tx = transaction();
    await expect((new UpdateDraftService({} as never) as unknown as PrimaryAddressPersistence).persistPrimaryAddress(tx, 42, source)).rejects.toMatchObject({ code: "INVALID_INPUT", httpStatus: 422 });
    expect(tx.address.create).not.toHaveBeenCalled();
  });

  it("fails before address write when HOME cannot be resolved, allowing the surrounding transaction to roll back", async () => {
    const tx = transaction();
    tx.addressType.findUnique.mockResolvedValue(null);
    await expect(persist(tx)).rejects.toThrow("No existe un tipo de direccion principal activo.");
    expect(tx.address.create).not.toHaveBeenCalled();
    expect(tx.address.update).not.toHaveBeenCalled();
  });

  it("keeps personal and billing addresses separate in the SIE snapshot", () => {
    const source = {
      applicationId: 9,
      documentType: "DNI",
      documentNumber: "12345678",
      email: "postulante@example.com",
      phone: "999999999",
      person: { firstName: "Ana", paternalLastName: "Perez", maternalLastName: "Diaz", gender: "FEMALE", addresses: [{ street: "Av. Personal 155", isPrimary: true }] },
      billing: { taxId: "12345678", businessName: "Ana Perez Diaz", billingAddress: "Av. Fiscal 900", billingEmail: "facturacion@example.com", documentType: "DNI", receiptType: "BOLETA", billingContact: null },
    };
    const builder = new AssociateIntegrationSnapshotBuilder();
    const activeSnapshot = builder.activeFrom(source, new Date("2026-09-10T12:00:00.000Z"), { registration: 150, monthlyFee: 150, total: 300 });
    const studentSnapshot = builder.studentFrom({ ...source, billing: null }, new Date("2026-09-10T12:00:00.000Z"));
    expect(activeSnapshot.Direccion).toBe("Av. Personal 155");
    expect(activeSnapshot.DirFacturacion).toBe("Av. Fiscal 900");
    expect(studentSnapshot.Direccion).toBe("Av. Personal 155");
    expect(studentSnapshot.DirFacturacion).toBe("Av. Personal 155");
  });
});

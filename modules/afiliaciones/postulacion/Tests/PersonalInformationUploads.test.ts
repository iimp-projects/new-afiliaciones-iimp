import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_INFORMATION_UPLOAD_FOLDERS,
  resolvePersonalInformationUploads,
} from "../Services/PersonalInformationUploads";
import type { PersonalInformation, UploadedFile } from "../Models/PersonalInformation";

const base: PersonalInformation = {
  documentType: "DNI",
  documentNumber: "12345678",
  names: "Ana",
  fatherLastName: "Perez",
  motherLastName: "Diaz",
  birthDate: "1990-01-01",
  gender: "FEMALE",
  phone: "999999999",
  primaryEmail: "ana@example.com",
  countryId: 1,
  address: "Av. Siempre Viva 123",
  identityVerified: true,
};

const uploaded = (url: string): UploadedFile => ({ url, name: `${url}.png`, type: "image/png" });
const isFile = (value: unknown): value is File => value instanceof File;

describe("resolvePersonalInformationUploads", () => {
  it("sube foto y documento con las carpetas permitidas y en orden", async () => {
    const calls: string[] = [];
    const upload = vi.fn(async (file: File, folder: string) => {
      calls.push(folder);
      return uploaded(`${folder}/${file.name}`);
    });
    const result = await resolvePersonalInformationUploads(
      {
        ...base,
        photo: new File(["foto"], "foto.png", { type: "image/png" }),
        identityDocument: new File(["dni"], "dni.png", { type: "image/png" }),
      },
      upload,
      isFile,
    );
    expect(upload).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      PERSONAL_INFORMATION_UPLOAD_FOLDERS.photo,
      PERSONAL_INFORMATION_UPLOAD_FOLDERS.identityDocument,
    ]);
    expect(result.photo).toEqual(uploaded("afiliaciones/fotos/foto.png"));
    expect(result.identityDocument).toEqual(uploaded("afiliaciones/documentos/dni.png"));
  });

  it("no vuelve a subir referencias ya persistidas", async () => {
    const upload = vi.fn();
    const persisted = uploaded("afiliaciones/fotos/ya-existe.png");
    const result = await resolvePersonalInformationUploads(
      { ...base, photo: persisted, identityDocument: null },
      upload,
      isFile,
    );
    expect(upload).not.toHaveBeenCalled();
    expect(result.photo).toBe(persisted);
    expect(result.identityDocument).toBeNull();
  });

  it("normaliza campos ausentes a null", async () => {
    const result = await resolvePersonalInformationUploads({ ...base }, vi.fn(), isFile);
    expect(result.photo).toBeNull();
    expect(result.identityDocument).toBeNull();
  });
});

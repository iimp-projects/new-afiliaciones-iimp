import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import type { InternalProfileUpdateInput } from "../DTOs/internal-profile.schema";
import { InternalProfileRepository } from "../Repositories/InternalProfileRepository";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export type InternalProfileDTO = {
  personal: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
    documentType: string;
    documentNumber: string;
    avatarUrl: string | null;
  };
  contact: { email: string; phone: string | null };
  account: { roleName: string; roleSlug: string; status: string };
};

export class InternalProfileService {
  constructor(
    private readonly repository = new InternalProfileRepository(),
    private readonly storage = new S3StorageService(),
  ) {}

  async getForCurrentUser(userId: number): Promise<InternalProfileDTO> {
    const profile = await this.repository.findByUserId(userId);
    const user = profile?.user;
    const person = user?.person;
    const role = user?.role;
    if (!user || !person || !role) throw new Error("No se encontró el perfil interno.");
    const phone = this.canonicalPhone(person.contacts);
    return {
      personal: {
        firstName: person.firstName,
        paternalLastName: person.paternalLastName,
        maternalLastName: person.maternalLastName,
        documentType: person.documentType,
        documentNumber: person.documentNumber,
        avatarUrl: user.image ? await this.storage.getPresignedAvatarUrl(user.image) : null,
      },
      contact: { email: user.email, phone: phone?.phoneNumber ?? null },
      account: { roleName: role.name, roleSlug: role.slug, status: user.status },
    };
  }

  async updateForCurrentUser(userId: number, input: InternalProfileUpdateInput, avatar?: File | null): Promise<InternalProfileDTO> {
    let imageKey: string | undefined;
    if (avatar && avatar.size > 0) imageKey = await this.uploadAvatar(avatar);
    await this.repository.updateOwnProfile(userId, input.phone, imageKey);
    return this.getForCurrentUser(userId);
  }

  private canonicalPhone<T extends { phoneType: string; phoneNumber: string; email: string | null; isPrimary: boolean }>(contacts: T[]): T | undefined {
    return contacts.find((contact) => contact.phoneType === "MOBILE" && contact.isPrimary)
      ?? contacts.find((contact) => contact.phoneType === "MOBILE")
      ?? contacts.find((contact) => contact.isPrimary && !contact.email)
      ?? contacts.find((contact) => !contact.email);
  }

  private async uploadAvatar(file: File): Promise<string> {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("La fotografía debe ser JPG, PNG o WEBP.");
    if (file.size > MAX_AVATAR_SIZE) throw new Error("La fotografía no puede superar los 5 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!this.hasExpectedImageSignature(buffer, file.type)) throw new Error("El contenido del archivo no corresponde a una imagen válida.");
    return this.storage.uploadPrivateFile(buffer, file.name, file.type, "afiliaciones/perfiles");
  }

  private hasExpectedImageSignature(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    return false;
  }
}

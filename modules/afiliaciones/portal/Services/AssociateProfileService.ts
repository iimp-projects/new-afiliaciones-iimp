import { ApplicationStatus, Gender, PhoneType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDateFromDatabase, calendarDateToDatabaseDate } from "../Utils/calendarDate";

type ProfessionalProfile = {
  companyId: number | null;
  positionId: number | null;
  company: string | null;
  companyTaxId: string | null;
  companyIndustry: string | null;
  companySector: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  position: string | null;
  area: string | null;
  workingAddress: string | null;
  workPhone: string | null;
  workExtension: string | null;
  workEmail: string | null;
};

type DraftContact = { primaryEmail: string | null; secondaryEmail: string | null; phone: string | null };

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contactFromDraft(draft: unknown): DraftContact {
  if (!draft || typeof draft !== "object" || !("personalInformation" in draft)) {
    return { primaryEmail: null, secondaryEmail: null, phone: null };
  }
  const personalInformation = draft.personalInformation;
  if (!personalInformation || typeof personalInformation !== "object") {
    return { primaryEmail: null, secondaryEmail: null, phone: null };
  }
  return {
    primaryEmail: optionalText("primaryEmail" in personalInformation ? personalInformation.primaryEmail : null),
    secondaryEmail: optionalText("secondaryEmail" in personalInformation ? personalInformation.secondaryEmail : null),
    phone: optionalText("phone" in personalInformation ? personalInformation.phone : null),
  };
}

export type AssociateProfileDTO = {
  identity: {
    fullName: string; firstName: string; paternalLastName: string; maternalLastName: string | null;
    image: string | null; documentType: string; documentNumber: string; birthDate: string | null;
    gender: string | null; nationality: string | null; nationalityId: number | null;
  };
  contact: { primaryPhone: string | null; primaryEmail: string | null; secondaryEmail: string | null };
  address: {
    street: string | null; reference: string | null; country: string | null; countryId: number | null;
    department: string | null; departmentId: number | null; province: string | null; provinceId: number | null;
    district: string | null; districtId: number | null;
  };
  professional: ProfessionalProfile | null;
  academic: Array<{ university: string | null; specialty: string | null; degree: string | null; graduationYear: number | null; professionalAssociation: string | null; licenseNumber: string | null }>;
  membership: { type: "ACTIVE" | "STUDENT" | null; code: string | null; status: string; memberSince: string | null; updatedAt: string | null };
  account: { email: string; lastLoginAt: string | null };
};

export class AssociateProfileService {
  async updateEmployment(userId: number, input: { companyId: number; positionId: number | null; area: string | null; workingAddress: string | null; workPhone: string | null; workExtension: string | null; workEmail: string | null }) {
    const person = await this.personForUser(userId);
    const [company, position] = await Promise.all([
      prisma.company.findFirst({ where: { id: input.companyId, isActive: true }, select: { id: true } }),
      input.positionId ? prisma.jobPosition.findFirst({ where: { id: input.positionId, isActive: true }, select: { id: true } }) : null,
    ]);
    if (!company || (input.positionId && !position)) throw new Error("La empresa o el cargo seleccionado no está disponible.");
    const current = await prisma.employmentInfo.findFirst({ where: { personId: person.id }, orderBy: { updatedAt: "desc" } });
    const data = { companyId: company.id, positionId: position?.id ?? null, area: input.area, workingAddress: input.workingAddress, workPhone: input.workPhone, workExtension: input.workExtension, workEmail: input.workEmail };
    await prisma.$transaction(async (tx) => {
      const employment = current ? await tx.employmentInfo.update({ where: { id: current.id }, data }) : await tx.employmentInfo.create({ data: { personId: person.id, ...data } });
      await tx.auditLog.create({ data: { userId, action: current ? "ASSOCIATE_PROFILE_EMPLOYMENT_UPDATED" : "ASSOCIATE_PROFILE_EMPLOYMENT_CREATED", entity: "EmploymentInfo", entityId: String(employment.id), oldValues: current ? { companyId: current.companyId, positionId: current.positionId } : {}, newValues: { personId: person.id, companyId: data.companyId, positionId: data.positionId } } });
    });
    return this.getForUser(userId);
  }
  async getForUser(userId: number): Promise<AssociateProfileDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: {
          include: {
            nationality: true,
            contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
            addresses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], include: { country: true, district: { include: { province: { include: { department: true } } } } } },
            academicInfos: { orderBy: { updatedAt: "desc" }, include: { university: true, specialty: true, degree: true } },
            employmentInfos: { orderBy: { updatedAt: "desc" }, include: { company: { include: { sector: true } }, position: true } },
            professionalExperiences: { orderBy: [{ isCurrent: "desc" }, { updatedAt: "desc" }], include: { company: { include: { sector: true } }, position: true } },
            applications: {
              where: { status: ApplicationStatus.COMPLETED, deletedAt: null },
              orderBy: { updatedAt: "desc" },
              take: 1,
              include: { documents: { orderBy: { updatedAt: "desc" } } },
            },
          },
        },
      },
    });
    if (!user?.person) return null;

    const person = user.person;
    const contact = person.contacts[0];
    const secondary = person.contacts.find((item) => item.email && item.email !== contact?.email);
    const address = person.addresses[0];
    const district = address?.district;
    const province = district?.province;
    const department = province?.department;
    const employment = person.employmentInfos[0];
    const experience = person.professionalExperiences[0];
    const professionalSource = employment ?? experience;
    const company = professionalSource?.company;
    const application = person.applications[0];
    const draftContact = contactFromDraft(application?.draftData);
    const photo = application?.documents.find((document) =>
      document.mimeType.startsWith("image/") &&
      (document.category === "OTHER" || document.fileName.toLowerCase().includes("foto")),
    );

    return {
      identity: {
        fullName: [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" "),
        firstName: person.firstName, paternalLastName: person.paternalLastName, maternalLastName: person.maternalLastName,
        image: photo?.fileUrl ?? user.image, documentType: person.documentType, documentNumber: person.documentNumber,
        birthDate: calendarDateFromDatabase(person.birthDate), gender: person.gender ?? null,
        nationality: person.nationality?.name ?? null, nationalityId: person.nationalityId,
      },
      contact: {
        primaryPhone: contact?.phoneNumber ?? application?.phone ?? draftContact.phone,
        primaryEmail: contact?.email ?? application?.email ?? draftContact.primaryEmail,
        secondaryEmail: secondary?.email ?? draftContact.secondaryEmail,
      },
      address: {
        street: address?.street ?? null, reference: address?.reference ?? null, country: address?.country?.name ?? null, countryId: address?.countryId ?? null,
        department: department?.name ?? address?.foreignRegion ?? null, departmentId: department?.id ?? null,
        province: province?.name ?? null, provinceId: province?.id ?? null, district: district?.name ?? address?.foreignCity ?? null, districtId: district?.id ?? null,
      },
      professional: professionalSource ? {
        companyId: company?.id ?? null, positionId: professionalSource.position?.id ?? null,
        company: company?.name ?? null, companyTaxId: company?.taxId ?? null, companyIndustry: company?.industry ?? null,
        companySector: company?.sector?.name ?? null, companyEmail: company?.email ?? null, companyPhone: company?.phone ?? null,
        companyAddress: company?.address ?? null, position: professionalSource.position?.name ?? null,
        area: employment?.area ?? null, workingAddress: employment?.workingAddress ?? null, workPhone: employment?.workPhone ?? null,
        workExtension: employment?.workExtension ?? null, workEmail: employment?.workEmail ?? null,
      } : null,
      academic: person.academicInfos.map((item) => ({
        university: item.university?.name ?? null, specialty: item.specialty?.name ?? null,
        degree: item.degree?.name ?? item.degreeTitle ?? null, graduationYear: item.graduationYear ?? null,
        professionalAssociation: item.professionalAssociation ?? null, licenseNumber: item.licenseNumber ?? null,
      })),
      membership: {
        type: application?.affiliateType ?? null, code: application?.applicationCode ?? null, status: user.status,
        memberSince: application?.submittedAt?.toISOString() ?? application?.createdAt?.toISOString() ?? null,
        updatedAt: person.updatedAt.toISOString(),
      },
      account: { email: user.email, lastLoginAt: user.lastLoginAt?.toISOString() ?? null },
    };
  }

  async updateIdentity(userId: number, input: { firstName: string; paternalLastName: string; maternalLastName: string | null; birthDate: string | null; gender: Gender | null; nationalityId: number | null; image?: { key: string; fileName: string; mimeType: string; sizeBytes: number } }) {
    const person = await this.personForUser(userId);
    if (input.nationalityId && !(await prisma.country.findFirst({ where: { id: input.nationalityId, isActive: true } }))) throw new Error("La nacionalidad seleccionada no es válida.");
    await prisma.$transaction(async (tx) => {
      await tx.person.update({ where: { id: person.id }, data: { firstName: input.firstName, paternalLastName: input.paternalLastName, maternalLastName: input.maternalLastName, birthDate: calendarDateToDatabaseDate(input.birthDate), gender: input.gender, nationalityId: input.nationalityId } });

      if (!input.image) return;

      const application = await tx.membershipApplication.findFirst({
        where: { personId: person.id, status: ApplicationStatus.COMPLETED, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { documents: { orderBy: { updatedAt: "desc" } } },
      });
      if (!application) throw new Error("No se encontró una postulación completada para actualizar la fotografía.");

      const photo = application.documents.find((document) =>
        document.mimeType.startsWith("image/") &&
        (document.category === "OTHER" || document.fileName.toLowerCase().includes("foto")),
      );
      const imageData = { fileUrl: input.image.key, fileName: input.image.fileName, mimeType: input.image.mimeType, sizeBytes: BigInt(input.image.sizeBytes) };
      if (photo) await tx.applicationDocument.update({ where: { id: photo.id }, data: imageData });
      else await tx.applicationDocument.create({ data: { applicationId: application.id, category: "OTHER", ...imageData } });
    });
    return this.getForUser(userId);
  }

  async updateContact(userId: number, input: { primaryPhone: string; secondaryEmail: string | null }) {
    const person = await this.personForUser(userId);
    const contacts = await prisma.personContact.findMany({ where: { personId: person.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
    const primary = contacts[0];
    await prisma.$transaction(async (tx) => {
      if (primary) await tx.personContact.update({ where: { id: primary.id }, data: { phoneNumber: input.primaryPhone, isPrimary: true } });
      else await tx.personContact.create({ data: { personId: person.id, phoneType: PhoneType.MOBILE, phoneNumber: input.primaryPhone, isPrimary: true } });
      const alternate = contacts.find((item) => item.id !== primary?.id && item.email);
      if (alternate) await tx.personContact.update({ where: { id: alternate.id }, data: { email: input.secondaryEmail } });
      else if (input.secondaryEmail) await tx.personContact.create({ data: { personId: person.id, phoneType: PhoneType.OTHER, phoneNumber: input.primaryPhone, email: input.secondaryEmail } });
    });
    return this.getForUser(userId);
  }

  async updateAddress(userId: number, input: { street: string; reference: string | null; countryId: number | null; districtId: number | null }) {
    const person = await this.personForUser(userId);
    if (input.districtId) {
      const district = await prisma.district.findFirst({ where: { id: input.districtId, isActive: true }, include: { province: { include: { department: true } } } });
      if (!district || (input.countryId && district.province.department.countryId !== input.countryId)) throw new Error("La ubicación seleccionada no es válida.");
    }
    const address = await prisma.address.findFirst({ where: { personId: person.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
    if (address) await prisma.address.update({ where: { id: address.id }, data: { street: input.street, reference: input.reference, countryId: input.countryId, districtId: input.districtId, foreignRegion: null, foreignCity: null, isPrimary: true } });
    else {
      const home = await prisma.addressType.findFirst({ where: { code: "HOME", isActive: true } });
      if (!home) throw new Error("No está configurado el tipo de dirección Domicilio.");
      await prisma.address.create({ data: { personId: person.id, addressTypeId: home.id, street: input.street, reference: input.reference, countryId: input.countryId, districtId: input.districtId, isPrimary: true } });
    }
    return this.getForUser(userId);
  }

  private async personForUser(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { person: { select: { id: true } } } });
    if (!user?.person) throw new Error("No se encontró la información personal de la cuenta.");
    return user.person;
  }
}

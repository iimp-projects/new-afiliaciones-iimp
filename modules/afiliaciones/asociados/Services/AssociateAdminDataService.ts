/* eslint-disable @typescript-eslint/no-explicit-any -- merge controlado de draftData JSON heterogéneo. */
import { PhoneType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERU_COUNTRY_ID } from "../../portal/Rules/ProfileCompletenessRules";
import { calendarDateToDatabaseDate } from "../../portal/Utils/calendarDate";
import type { AdminAssociateDataInput } from "../Validators/AdminAssociateDataSchema";
import { validateAdminAssociateData, type AdminAssociateDataErrors } from "../Validators/validateAdminAssociateData";

export class AssociateAdminDataError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class AssociateAdminDataValidationError extends AssociateAdminDataError {
  constructor(message: string, readonly errors: AdminAssociateDataErrors) {
    super(message, 400);
  }
}

export interface AssociateProfileImage {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export class AssociateAdminDataService {
  async updatePhoto(actorUserId: number, personId: number, image: AssociateProfileImage): Promise<void> {
    const user = await prisma.user.findFirst({ where: { personId }, select: { id: true, image: true } });
    if (!user) throw new AssociateAdminDataError("El asociado no tiene una cuenta para asociar la fotografía.", 404);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { image: image.key } });
      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "ASSOCIATE_PROFILE_PHOTO_UPDATED",
          entity: "User",
          entityId: String(user.id),
          oldValues: { image: user.image },
          newValues: { image: image.key },
        },
      });
    });
  }

  async updateAll(actorUserId: number, personId: number, input: AdminAssociateDataInput, options: { applicationId?: number } = {}): Promise<void> {
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        firstName: true,
        paternalLastName: true,
        maternalLastName: true,
        documentType: true,
        documentNumber: true,
        birthDate: true,
        gender: true,
        nationalityId: true,
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        addresses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        academicInfos: { orderBy: { updatedAt: "desc" } },
        employmentInfos: { orderBy: { updatedAt: "desc" } },
        user: { select: { role: { select: { slug: true } } } },
        applications: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 1, select: { affiliateType: true } },
      },
    });
    if (!person) throw new AssociateAdminDataError("El asociado no existe.", 404);

    const isStudent = person.user?.role?.slug === "ASOCIADO_ESTUDIANTE" || person.applications[0]?.affiliateType === "STUDENT";
    const validationErrors = validateAdminAssociateData(input, { isStudent });
    if (Object.keys(validationErrors).length > 0) {
      throw new AssociateAdminDataValidationError("Verifica los datos ingresados.", validationErrors);
    }

    if (person.documentType !== input.identity.documentType || person.documentNumber !== input.identity.documentNumber) {
      const duplicate = await prisma.person.findFirst({
        where: {
          id: { not: personId },
          documentType: input.identity.documentType,
          documentNumber: input.identity.documentNumber,
        },
        select: { id: true },
      });
      if (duplicate) throw new AssociateAdminDataError("Ya existe otra persona con ese documento.", 409);
    }

    if (input.identity.nationalityId) {
      const nationality = await prisma.country.findFirst({ where: { id: input.identity.nationalityId, isActive: true }, select: { id: true } });
      if (!nationality) throw new AssociateAdminDataError("La nacionalidad seleccionada no es válida.", 400);
    }

    const isPeru = input.address.countryId === PERU_COUNTRY_ID;
    const country = await prisma.country.findFirst({ where: { id: input.address.countryId, isActive: true }, select: { id: true } });
    if (!country) throw new AssociateAdminDataError("El país seleccionado no es válido.", 400);
    if (isPeru && input.address.districtId) {
      const district = await prisma.district.findFirst({ where: { id: input.address.districtId, isActive: true }, include: { province: { include: { department: true } } } });
      if (!district || district.province.department.countryId !== input.address.countryId) {
        throw new AssociateAdminDataError("La ubicación seleccionada no es válida.", 400);
      }
    }

    if (input.academic) {
      const [university, specialty, degree] = await Promise.all([
        input.academic.universityId ? prisma.university.findFirst({ where: { id: input.academic.universityId, isActive: true }, select: { id: true } }) : null,
        input.academic.specialtyId ? prisma.specialty.findFirst({ where: { id: input.academic.specialtyId, isActive: true }, select: { id: true } }) : null,
        input.academic.degreeId ? prisma.academicDegree.findFirst({ where: { id: input.academic.degreeId, isActive: true }, select: { id: true } }) : null,
      ]);
      if (input.academic.universityId && !university) throw new AssociateAdminDataError("La universidad seleccionada no es válida.", 400);
      if (input.academic.specialtyId && !specialty) throw new AssociateAdminDataError("La especialidad seleccionada no es válida.", 400);
      if (input.academic.degreeId && !degree) throw new AssociateAdminDataError("El grado seleccionado no es válido.", 400);
    }

    if (input.employment) {
      const [company, position] = await Promise.all([
        input.employment.companyId ? prisma.company.findFirst({ where: { id: input.employment.companyId, isActive: true }, select: { id: true } }) : null,
        input.employment.positionId ? prisma.jobPosition.findFirst({ where: { id: input.employment.positionId, isActive: true }, select: { id: true } }) : null,
      ]);
      if (input.employment.companyId && !company) throw new AssociateAdminDataError("La empresa seleccionada no es válida.", 400);
      if (input.employment.positionId && !position) throw new AssociateAdminDataError("El cargo seleccionado no es válido.", 400);
    }

    const contact = person.contacts[0];
    const alternate = person.contacts.find((item) => item.id !== contact?.id && item.email);
    const address = person.addresses[0];
    const academic = person.academicInfos[0];
    const employment = person.employmentInfos[0];
    const addressData = {
      street: input.address.street,
      reference: input.address.reference,
      countryId: input.address.countryId,
      districtId: isPeru ? input.address.districtId : null,
      zipCode: input.address.postalCode,
      foreignRegion: isPeru ? null : input.address.foreignRegion,
      foreignCity: isPeru ? null : input.address.foreignCity,
      isPrimary: true,
    };

    await prisma.$transaction(async (tx) => {
      await tx.person.update({
        where: { id: personId },
        data: {
          firstName: input.identity.firstName,
          paternalLastName: input.identity.paternalLastName,
          maternalLastName: input.identity.maternalLastName,
          documentType: input.identity.documentType,
          documentNumber: input.identity.documentNumber,
          birthDate: input.identity.birthDate ? calendarDateToDatabaseDate(input.identity.birthDate) : null,
          gender: input.identity.gender,
          nationalityId: input.identity.nationalityId,
        },
      });

      if (contact) {
        await tx.personContact.update({ where: { id: contact.id }, data: { phoneNumber: input.contact.phone, email: input.contact.primaryEmail, isPrimary: true } });
      } else {
        await tx.personContact.create({ data: { personId, phoneType: PhoneType.MOBILE, phoneNumber: input.contact.phone, email: input.contact.primaryEmail, isPrimary: true } });
      }
      if (alternate) {
        await tx.personContact.update({ where: { id: alternate.id }, data: { email: input.contact.secondaryEmail } });
      } else if (input.contact.secondaryEmail) {
        await tx.personContact.create({ data: { personId, phoneType: PhoneType.OTHER, phoneNumber: input.contact.phone, email: input.contact.secondaryEmail } });
      }

      if (address) await tx.address.update({ where: { id: address.id }, data: addressData });
      else {
        const home = await tx.addressType.findFirst({ where: { code: "HOME", isActive: true } });
        if (!home) throw new AssociateAdminDataError("No está configurado el tipo de dirección Domicilio.", 400);
        await tx.address.create({ data: { personId, addressTypeId: home.id, ...addressData } });
      }

      if (input.academic) {
        const academicData = { ...input.academic };
        if (academic) await tx.academicInfo.update({ where: { id: academic.id }, data: academicData });
        else await tx.academicInfo.create({ data: { personId, ...academicData } });
      }

      if (input.employment) {
        const employmentData = { ...input.employment };
        if (employment) await tx.employmentInfo.update({ where: { id: employment.id }, data: employmentData });
        else await tx.employmentInfo.create({ data: { personId, ...employmentData } });
      }

      if (options.applicationId) {
        const application = await tx.membershipApplication.findFirst({
          where: { id: options.applicationId, personId, deletedAt: null },
          select: { id: true, draftData: true, email: true },
        });
        if (!application) throw new AssociateAdminDataError("El expediente no pertenece a la persona indicada.", 400);

        const [country, district, university, specialty, company, position] = await Promise.all([
          tx.country.findUnique({ where: { id: input.address.countryId }, select: { name: true } }),
          input.address.districtId ? tx.district.findUnique({ where: { id: input.address.districtId }, include: { province: { include: { department: true } } } }) : null,
          input.academic?.universityId ? tx.university.findUnique({ where: { id: input.academic.universityId }, select: { name: true } }) : null,
          input.academic?.specialtyId ? tx.specialty.findUnique({ where: { id: input.academic.specialtyId }, select: { name: true } }) : null,
          input.employment?.companyId ? tx.company.findUnique({ where: { id: input.employment.companyId }, select: { name: true } }) : null,
          input.employment?.positionId ? tx.jobPosition.findUnique({ where: { id: input.employment.positionId }, select: { name: true } }) : null,
        ]);

        const current = (application.draftData && typeof application.draftData === "object" && !Array.isArray(application.draftData))
          ? application.draftData as Record<string, any>
          : {};
        const personal = current.personalInformation && typeof current.personalInformation === "object" ? current.personalInformation as Record<string, any> : {};
        const academicStudies = Array.isArray(current.academicStudies) ? [...current.academicStudies] : [];
        const employmentInformation = current.employmentInformation && typeof current.employmentInformation === "object" ? current.employmentInformation as Record<string, any> : {};
        const personalInformation = {
          ...personal,
          names: input.identity.firstName,
          fatherLastName: input.identity.paternalLastName,
          motherLastName: input.identity.maternalLastName,
          birthDate: input.identity.birthDate,
          gender: input.identity.gender,
          nationalityId: input.identity.nationalityId,
          primaryEmail: input.contact.primaryEmail,
          secondaryEmail: input.contact.secondaryEmail,
          phone: input.contact.phone,
          address: input.address.street,
          countryId: input.address.countryId,
          departmentId: district?.province?.departmentId ?? null,
          provinceId: district?.provinceId ?? null,
          districtId: input.address.districtId,
          resolvedCountry: country?.name ?? null,
          resolvedDepartment: district?.province?.department?.name ?? null,
          resolvedProvince: district?.province?.name ?? null,
          resolvedDistrict: district?.name ?? null,
        };

        if (input.academic) {
          const first = academicStudies[0] && typeof academicStudies[0] === "object" ? academicStudies[0] as Record<string, any> : {};
          academicStudies[0] = {
            ...first,
            studyLevel: input.academic.studyLevel,
            institutionId: input.academic.universityId,
            otherInstitution: null,
            universityName: university?.name ?? first.universityName ?? null,
            specialtyId: input.academic.specialtyId,
            specialty: specialty?.name ?? first.specialty ?? null,
            degreeId: input.academic.degreeId,
            degreeTitle: input.academic.degreeTitle,
            graduationYear: input.academic.graduationYear,
            cycle: input.academic.termOrSemester,
            professionalAssociation: input.academic.professionalAssociation,
            registrationNumber: input.academic.licenseNumber,
          };
        }

        if (input.employment) {
          employmentInformation.companyId = input.employment.companyId;
          employmentInformation.positionId = input.employment.positionId;
          employmentInformation.companyName = company?.name ?? employmentInformation.companyName ?? null;
          employmentInformation.position = position?.name ?? employmentInformation.position ?? null;
          employmentInformation.area = input.employment.area;
          employmentInformation.workEmail = input.employment.workEmail;
          employmentInformation.workPhone = input.employment.workPhone;
          employmentInformation.workExtension = input.employment.workExtension;
          employmentInformation.workingAddress = input.employment.workingAddress;
        }

        await tx.membershipApplication.update({
          where: { id: application.id },
          data: {
            email: input.contact.primaryEmail ?? application.email,
            phone: input.contact.phone,
            documentType: input.identity.documentType,
            documentNumber: input.identity.documentNumber,
            draftData: {
              ...current,
              personalInformation,
              ...(input.academic ? { academicStudies } : {}),
              ...(input.employment ? { employmentInformation } : {}),
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "ASSOCIATE_PROFILE_DATA_UPDATED",
          entity: "Person",
          entityId: String(personId),
          oldValues: {
            firstName: person.firstName,
            paternalLastName: person.paternalLastName,
            maternalLastName: person.maternalLastName,
            documentType: person.documentType,
            documentNumber: person.documentNumber,
            phone: contact?.phoneNumber ?? null,
            primaryEmail: contact?.email ?? null,
            secondaryEmail: alternate?.email ?? null,
            address: address ? { street: address.street, countryId: address.countryId, districtId: address.districtId, postalCode: address.zipCode } : null,
            academicId: academic?.id ?? null,
            employmentId: employment?.id ?? null,
          },
          newValues: {
            ...input.identity,
            contact: input.contact,
            address: addressData,
            academic: input.academic,
            employment: input.employment,
          },
        },
      });
    });
  }
}

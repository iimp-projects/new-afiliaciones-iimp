import { PhoneType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type InternalProfileRecord = {
  user: {
    id: number;
    email: string;
    image: string | null;
    status: string;
    role: { name: string; slug: string } | null;
    person: {
      id: number;
      firstName: string;
      paternalLastName: string;
      maternalLastName: string | null;
      documentType: string;
      documentNumber: string;
      contacts: Array<{ id: number; phoneType: PhoneType; phoneNumber: string; email: string | null; isPrimary: boolean }>;
    } | null;
  };
};

export class InternalProfileRepository {
  async findByUserId(userId: number): Promise<InternalProfileRecord | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        image: true,
        status: true,
        role: { select: { name: true, slug: true } },
        person: {
          select: {
            id: true,
            firstName: true,
            paternalLastName: true,
            maternalLastName: true,
            documentType: true,
            documentNumber: true,
            contacts: { select: { id: true, phoneType: true, phoneNumber: true, email: true, isPrimary: true } },
          },
        },
      },
    });

    return user ? { user } : null;
  }

  async updateOwnProfile(userId: number, phone: string, imageKey?: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    const person = profile?.user.person;
    if (!person) throw new Error("No se encontró la información personal de la cuenta.");

    const canonicalPhone =
      person.contacts.find((contact) => contact.phoneType === PhoneType.MOBILE && contact.isPrimary) ??
      person.contacts.find((contact) => contact.phoneType === PhoneType.MOBILE) ??
      person.contacts.find((contact) => contact.isPrimary && !contact.email) ??
      person.contacts.find((contact) => !contact.email);

    await prisma.$transaction(async (tx) => {
      if (canonicalPhone) {
        await tx.personContact.update({ where: { id: canonicalPhone.id }, data: { phoneNumber: phone } });
      } else {
        await tx.personContact.create({
          data: {
            personId: person.id,
            phoneType: PhoneType.MOBILE,
            phoneNumber: phone,
            isPrimary: person.contacts.length === 0,
          },
        });
      }

      if (imageKey) await tx.user.update({ where: { id: userId }, data: { image: imageKey } });
    });
  }
}

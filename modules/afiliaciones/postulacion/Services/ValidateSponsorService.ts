import { DocumentType, UserStatus, UserType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AssociatesApiClient } from "@/modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { mapSieDocumentType } from "@/modules/afiliaciones/associates-integration/Mappers/SieAssociateListMapper";
import type { SanitizedSieAssociate } from "@/modules/afiliaciones/associates-integration/Models/SieAssociateList";
import { sponsorEligibilityWhere } from "./SponsorEligibility";

const SIE_PAGE_SIZE = 500;

type SponsorLookup = {
  id: number;
  documentNumber: string;
  fullName: string;
  email: string;
  sponsorCode: string;
};

export class ValidateSponsorService {
  private readonly sieClient?: AssociatesApiClient;

  constructor(sieClient?: AssociatesApiClient) {
    this.sieClient = sieClient;
  }

  public async execute(documentNumber: string): Promise<SponsorLookup | null> {
    const local = await this.findLocal(documentNumber);
    if (local) return local;

    return this.provisionFromSie(documentNumber);
  }

  private async findLocal(documentNumber: string): Promise<SponsorLookup | null> {
    // Asociado Activo Hábil: persona con usuario AFFILIATE + ACTIVE (regla compartida con SponsorEligibility).
    const person = await prisma.person.findFirst({
      where: sponsorEligibilityWhere(documentNumber),
      include: {
        user: { select: { email: true } },
        contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    });

    if (!person) return null;

    const contactEmail =
      person.contacts.find((contact) => contact.isPrimary)?.email ||
      person.contacts[0]?.email;

    return {
      id: person.id,
      documentNumber: person.documentNumber,
      fullName: `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim(),
      email: person.user?.email || contactEmail || "Sin correo",
      sponsorCode: `A-${person.id.toString().padStart(4, "0")}`,
    };
  }

  /**
   * Fallback on-demand: si el DNI no existe como aval local, consulta SIE y, si
   * confirma que es asociado (cualquier categoría) y trae correo, lo inserta
   * localmente como asociado activo (Person + User AFFILIATE/ACTIVE).
   *
   * Sin correo en SIE no se genera nada.
   */
  private async provisionFromSie(documentNumber: string): Promise<SponsorLookup | null> {
    try {
      const client = this.sieClient ?? new AssociatesApiClient();

      const state = await client.getAssociateState({ tipoDocumento: "1", numDocumento: documentNumber });
      if (!state.status) return null;

      const associate = await this.findAssociateByDocument(client, documentNumber);
      if (!associate) return null;

      const email = (associate.correo ?? "").trim().toLowerCase();
      const firstName = (associate.nombres ?? "").trim();
      const paternalLastName = (associate.apellidoPaterno ?? "").trim();

      // Requisito del negocio: solo se inserta si SIE entrega correo y nombres.
      if (!email || !firstName || !paternalLastName) return null;

      const documentType = mapSieDocumentType(associate.documentType) ?? DocumentType.DNI;
      const maternalLastName = (associate.apellidoMaterno ?? "").trim() || null;

      return this.upsertLocalAssociate({
        documentType,
        documentNumber,
        firstName,
        paternalLastName,
        maternalLastName,
        email,
      });
    } catch {
      // Integración no disponible o error: se trata como "no encontrado" sin romper la validación.
      return null;
    }
  }

  private async findAssociateByDocument(
    client: AssociatesApiClient,
    documentNumber: string,
  ): Promise<SanitizedSieAssociate | null> {
    const first = await client.listAssociates({ pagina: 1, tamanioPagina: SIE_PAGE_SIZE });
    const totalPages = first.totalPaginas && first.totalPaginas >= 1 ? first.totalPaginas : 1;
    for (let page = 1; page <= totalPages; page += 1) {
      const result = page === 1 ? first : await client.listAssociates({ pagina: page, tamanioPagina: SIE_PAGE_SIZE });
      const match = result.associates.find((item) => item.documentNumber === documentNumber);
      if (match) return match;
    }
    return null;
  }

  private async upsertLocalAssociate(input: {
    documentType: DocumentType;
    documentNumber: string;
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
    email: string;
  }): Promise<SponsorLookup | null> {
    return prisma.$transaction(async (tx) => {
      let person = await tx.person.findFirst({
        where: { documentType: input.documentType, documentNumber: input.documentNumber },
      });

      if (!person) {
        person = await tx.person.create({
          data: {
            documentType: input.documentType,
            documentNumber: input.documentNumber,
            firstName: input.firstName,
            paternalLastName: input.paternalLastName,
            maternalLastName: input.maternalLastName,
          },
        });
      }

      // Si ya tiene cuenta (cualquier tipo), no la pisamos.
      const existingUser = await tx.user.findFirst({ where: { personId: person.id, deletedAt: null } });
      if (existingUser) return null;

      // El correo es único: si ya pertenece a otra cuenta, no generamos nada.
      const emailOwner = await tx.user.findFirst({ where: { email: input.email } });
      if (emailOwner) return null;

      await tx.user.create({
        data: {
          email: input.email,
          type: UserType.AFFILIATE,
          status: UserStatus.ACTIVE,
          personId: person.id,
        },
      });

      return {
        id: person.id,
        documentNumber: person.documentNumber,
        fullName: `${person.firstName} ${person.paternalLastName} ${person.maternalLastName || ""}`.trim(),
        email: input.email,
        sponsorCode: `A-${person.id.toString().padStart(4, "0")}`,
      };
    });
  }
}

import { prisma } from "@/lib/prisma";
import type { AffiliateType, DocumentType } from "@prisma/client";
export class ApplicationLookupRepository {
  async isAffiliate(documentType: DocumentType, documentNumber: string) {
    const person = await prisma.person.findUnique({ where: { documentType_documentNumber: { documentType, documentNumber } }, select: { user: { select: { type: true } } } });
    return person?.user?.type === "AFFILIATE";
  }
  find(documentType: DocumentType, documentNumber: string, affiliateType?: AffiliateType) {
    return prisma.membershipApplication.findMany({ where: { documentType, documentNumber, deletedAt: null, ...(affiliateType ? { affiliateType } : {}) }, select: { id: true, documentType: true, documentNumber: true, affiliateType: true, email: true, phone: true, status: true, createdAt: true, trackingCode: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  }
  findById(id: number) { return prisma.membershipApplication.findFirst({ where: { id, deletedAt: null } }); }
  findByIds(ids: number[]) { return prisma.membershipApplication.findMany({ where: { id: { in: ids }, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }); }
}

import { 
  PrismaClient, DocumentType, ApplicationStatus, PaymentStatus, 
  AffiliateType, StudyLevel, PaymentGateway, Currency, ValidationStatus 
} from '@prisma/client';
import { Client } from 'pg';

const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:admin@localhost:5432/bd_afiliaciones_dev?schema=public" } }
});

const oldDb = new Client({
  connectionString: "postgresql://postgres:admin@localhost:5432/bdafiliacion"
});

const BASE_S3_URL = "https://afiliaciones-iimp-documentos.s3.us-east-1.amazonaws.com/legacy_docs";

function mapDocumentType(oldType: string | null): DocumentType {
  if (!oldType) return 'OTHER';
  const type = oldType.trim().toUpperCase();
  if (type === 'DNI' || type === '1') return 'DNI';
  if (type === 'CE' || type === '2' || type === 'C.E') return 'CE';
  if (type === 'PAS' || type === 'PASSPORT' || type === '3') return 'PASSPORT';
  return 'OTHER';
}

function mapAppStatus(estado: string | null, estadopago: string | null): ApplicationStatus {
  const s = (estado || 'P').toUpperCase().trim();
  if (s === 'R') return 'REJECTED';
  if (s === 'O') return 'OBSERVED';
  if (s === 'A') {
    if (estadopago && estadopago.toUpperCase().includes('PAGADO')) return 'COMPLETED';
    return 'READY_FOR_PAYMENT';
  }
  return 'UNDER_EVALUACION'; 
}

async function rescatarFichas() {
  console.log("🚑 INICIANDO RESCATE DE FICHAS DUPLICADAS...\n");

  const univMap = new Map((await prisma.university.findMany()).map(u => [u.name.toUpperCase(), u.id]));
  const compMap = new Map((await prisma.company.findMany()).map(c => [c.name.toUpperCase(), c.id]));
  const specMap = new Map((await prisma.specialty.findMany()).map(s => [s.name.toUpperCase(), s.id]));
  const posMap = new Map((await prisma.jobPosition.findMany()).map(p => [p.name.toUpperCase(), p.id]));
  
  const peru = await prisma.country.findFirst({ where: { isoCode: 'PER' } });
  const peruId = peru ? peru.id : 1;
  const requiredDepartments = await prisma.membershipDepartment.findMany({ where: { isRequired: true } });

  const resFichas = await oldDb.query('SELECT * FROM app_ficha ORDER BY fichnro ASC');
  let countRescued = 0;
  let countSkipped = 0;

  for (const ficha of resFichas.rows) {
    const docNumber = ficha.nrodoc?.trim();
    if (!docNumber) continue;

    // 1. Verificar si ya se migró exitosamente en la corrida anterior
    const alreadyMigrated = await prisma.membershipApplication.findFirst({
      where: { documentNumber: docNumber }
    });

    if (alreadyMigrated) {
      countSkipped++;
      continue; 
    }

    // 2. Lógica para rescatar a los que fallaron
    const documentType = mapDocumentType(ficha.tipodoc);
    const affiliateType: AffiliateType = (ficha.modalidad && ficha.modalidad.toUpperCase().includes('ESTUDIANTE')) ? 'STUDENT' : 'ACTIVE';
    const finalStatus = mapAppStatus(ficha.estado, ficha.estadopago);
    
    // AQUÍ ESTÁ LA MAGIA: Solucionamos la colisión del código
    let safeApplicationCode = ficha.nroficha?.trim() || `LEGACY-${ficha.fichnro}`;
    const codeInUse = await prisma.membershipApplication.findUnique({
      where: { applicationCode: safeApplicationCode }
    });

    if (codeInUse) {
      console.log(`⚠️  Colisión detectada para la ficha ${safeApplicationCode}. Asignando sufijo -DUP-${ficha.fichnro}...`);
      safeApplicationCode = `${safeApplicationCode}-DUP-${ficha.fichnro}`;
    }

    const trackingCode = `TRK-${ficha.fichnro}-${Date.now().toString().slice(-4)}`;

    try {
      await prisma.$transaction(async (tx) => {
        const person = await tx.person.upsert({
          where: { documentType_documentNumber: { documentType, documentNumber: docNumber } },
          update: {},
          create: {
            documentType, documentNumber: docNumber,
            firstName: ficha.nombre || 'Sin Nombre', paternalLastName: ficha.apellido || 'Sin Apellido', maternalLastName: ficha.apellidom || '',
            birthDate: ficha.fechanac ? new Date(ficha.fechanac) : null,
            gender: ficha.genero === 'Masculino' ? 'MALE' : (ficha.genero === 'Femenino' ? 'FEMALE' : 'OTHER'),
            nationalityId: peruId,
            contacts: { create: [{ phoneType: 'MOBILE', phoneNumber: ficha.celular || ficha.telefono || '000000000', email: ficha.correo, isPrimary: true }] }
          }
        });

        const draftData = {
          membershipType: affiliateType,
          personalInformation: {
            documentType, documentNumber: docNumber, names: ficha.nombre, fatherLastName: ficha.apellido, motherLastName: ficha.apellidom,
            primaryEmail: ficha.correo, phone: ficha.celular || ficha.telefono, address: ficha.direccion,
            photo: ficha.fotoper ? { url: `${BASE_S3_URL}/${ficha.fotoper}`, name: ficha.fotoper, type: 'image/jpeg' } : null
          },
          academicStudies: [{
            institutionId: ficha.univ ? univMap.get(ficha.univ.trim().toUpperCase()) : null, otherInstitution: ficha.univ, degreeTitle: ficha.titulo, specialty: ficha.espe, graduationYear: ficha.anioe ? parseInt(ficha.anioe) : null,
          }],
          employmentInformation: {
            isUnemployed: !ficha.empresa, companyId: ficha.empresa ? compMap.get(ficha.empresa.trim().toUpperCase()) : null,
            companyName: ficha.empresa, positionName: ficha.cargo, area: ficha.area, companyTaxId: ficha.rucemp, workPhone: ficha.tlfemp, workEmail: ficha.correoemp
          }
        };

        const app = await tx.membershipApplication.create({
          data: {
            applicationCode: safeApplicationCode, trackingCode, personId: person.id, affiliateType, documentType, documentNumber: docNumber,
            email: ficha.correo || 'sin-correo@legacy.local', phone: ficha.celular || ficha.telefono || '000000000', status: finalStatus, currentStep: 5, draftData: draftData as any,
            createdAt: ficha.fechareg ? new Date(ficha.fechareg) : new Date(), submittedAt: ficha.fechareg ? new Date(ficha.fechareg) : new Date(),
          }
        });

        if (ficha.titulo || ficha.univ) {
          await tx.academicInfo.create({ data: { personId: person.id, studyLevel: StudyLevel.BACHELOR, universityId: ficha.univ ? univMap.get(ficha.univ.trim().toUpperCase()) : null, specialtyId: ficha.espe ? specMap.get(ficha.espe.trim().toUpperCase()) : null, degreeTitle: ficha.titulo, graduationYear: ficha.anioe ? parseInt(ficha.anioe) : null } });
        }

        if (ficha.empresa) {
          await tx.employmentInfo.create({ data: { personId: person.id, companyId: compMap.get(ficha.empresa.trim().toUpperCase()), area: ficha.area, workingAddress: ficha.direcemp, workPhone: ficha.tlfemp, workEmail: ficha.correoemp } });
        }

        const docs = [ { name: ficha.fotoper, cat: 'OTHER' }, { name: ficha.documentoadj, cat: 'ID_DOCUMENT' }, { name: ficha.cv_documento, cat: 'CV' }, { name: ficha.declaracion_jurada, cat: 'SWORN_DECLARATION' }, { name: ficha.carta, cat: 'RECOMMENDATION_LETTER' }, { name: ficha.comprobante || ficha.voucher, cat: 'PAYMENT_VOUCHER' } ];
        for (const doc of docs) {
          if (doc.name && doc.name.trim() !== '') { await tx.applicationDocument.create({ data: { applicationId: app.id, category: doc.cat as any, fileUrl: `${BASE_S3_URL}/${doc.name}`, fileName: doc.name, mimeType: doc.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg', sizeBytes: BigInt(0) } }); }
        }

        const avalesData = [ { dni: ficha.dniaval1, cod: ficha.codaval1 }, { dni: ficha.dniaval2, cod: ficha.codaval2 } ];
        for (const aval of avalesData) {
          if (aval.dni && aval.dni.trim() !== '') {
            let sponsorPerson = await tx.person.findFirst({ where: { documentNumber: aval.dni.trim() } });
            if (!sponsorPerson) { sponsorPerson = await tx.person.create({ data: { documentType: 'DNI', documentNumber: aval.dni.trim(), firstName: 'Aval Legacy', paternalLastName: 'Migrado' } }); }
            await tx.membershipApproval.create({ data: { applicationId: app.id, sponsorPersonId: sponsorPerson.id, sponsorCode: aval.cod, status: finalStatus === 'COMPLETED' || finalStatus === 'READY_FOR_PAYMENT' ? 'APPROVED' : 'PENDING' } });
          }
        }

        if (requiredDepartments.length > 0) {
          await tx.membershipValidation.createMany({ data: requiredDepartments.map(dept => ({ applicationId: app.id, departmentId: dept.id, status: finalStatus === 'COMPLETED' ? ValidationStatus.APPROVED : ValidationStatus.PENDING })) });
        }

        if (ficha.montot && parseFloat(ficha.montot) > 0) {
          await tx.payment.create({ data: { applicationId: app.id, gateway: PaymentGateway.BANK_TRANSFER, totalAmount: parseFloat(ficha.montot), currency: ficha.moneda === 'Dolares' ? Currency.USD : Currency.PEN, status: (finalStatus === 'COMPLETED') ? PaymentStatus.PAID : PaymentStatus.PENDING, paymentDate: ficha.fechapago ? new Date(ficha.fechapago) : null } });
        }
      });

      countRescued++;
    } catch (e) {
      console.log(`❌ Error final con ficha N° ${ficha.fichnro} (DNI: ${docNumber}):`, e);
    }
  }

  console.log(`\n🎉 RESCATE COMPLETADO.`);
  console.log(`- Fichas previamente migradas (saltadas): ${countSkipped}`);
  console.log(`- Fichas rescatadas e insertadas hoy: ${countRescued}`);
  console.log(`¡TU BASE DE DATOS ESTÁ 100% COMPLETA!`);
}

async function main() {
  await oldDb.connect();
  try {
    await rescatarFichas();
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

main();
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:admin@localhost:5432/bd_afiliaciones_dev?schema=public", // <--- TU BD NUEVA
    },
  },
});

// Conexión directa a la base de datos antigua
const oldDb = new Client({
  connectionString: "postgresql://postgres:admin@localhost:5432/bdafiliacion", // <--- TU BD ANTIGUA
});

// La ruta base de tu nuevo bucket S3 donde subiste la carpeta files/
const BASE_S3_URL =
  "https://afiliaciones-iimp-documentos.s3.us-east-1.amazonaws.com/legacy_docs";

// ---------------------------------------------------------
// 1. FUNCIONES AUXILIARES Y MAPEADORES
// ---------------------------------------------------------
function parseFullName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length === 0 || parts[0] === "") return { first: "Aval", paternal: "Por Definir", maternal: "" };
  if (parts.length === 1) return { first: parts[0], paternal: "", maternal: "" };
  if (parts.length === 2) return { first: parts[1], paternal: parts[0], maternal: "" };
  if (parts.length === 3) return { paternal: parts[0], maternal: parts[1], first: parts[2] };
  return {
      paternal: parts[0],
      maternal: parts[1],
      first: parts.slice(2).join(" ")
  };
}

function mapDocumentType(oldType: string | null): any {
  if (!oldType) return "OTHER";
  const type = String(oldType).trim().toUpperCase();
  if (type === "DNI" || type === "1") return "DNI";
  if (type === "CE" || type === "2" || type === "4" || type === "C.E") return "CE";
  if (type === "PAS" || type === "PASSPORT" || type === "3" || type === "7") return "PASSPORT";
  return "OTHER";
}

function mapGender(genero: string | null): any {
  if (!genero) return "OTHER";
  const g = String(genero).trim().toUpperCase();
  if (g === "M" || g === "MASCULINO") return "MALE";
  if (g === "F" || g === "FEMENINO") return "FEMALE";
  return "OTHER";
}

function determineStatuses(estadoLegacy: string | null) {
  const s = String(estadoLegacy || "P").toUpperCase().trim();

  let appStatus: any = "PENDING";
  let sponsorStatus: any = "PENDING";

  if (s === "N" || s === "A") { 
    appStatus = "REJECTED";
    sponsorStatus = "REJECTED";
  } else if (s === "P") { 
    appStatus = "PENDING";
    sponsorStatus = "PENDING";
  } else if (s === "E" || s === "VA" || s === "VL") { 
    appStatus = "UNDER_EVALUACION";
    sponsorStatus = "PENDING";
  } else if (s === "I") { 
    appStatus = "COMPLETED";
    sponsorStatus = "APPROVED";
  } else {
    appStatus = "UNDER_EVALUACION";
    sponsorStatus = "PENDING";
  }

  return { appStatus, sponsorStatus };
}

// ---------------------------------------------------------
// 2. MIGRACIÓN PRINCIPAL
// ---------------------------------------------------------
async function migrarFichas() {
  console.log("🚀 INICIANDO FASE 3: Migración Masiva de Expedientes con Diccionarios...\n");

  console.log("🧹 Vaciando tablas de expedientes anteriores (TRUNCATE CASCADE)...");
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE membership_applications CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE professional_academics CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE professional_employment CASCADE;`);
    console.log("✨ Tablas limpias.\n");
  } catch (error) {
    console.error("❌ Error al vaciar las tablas.");
    throw error;
  }

  // =========================================================
  // DICCIONARIOS EN MEMORIA (Antiguos y Nuevos)
  // =========================================================
  console.log("🔍 Cargando diccionarios geográficos y de catálogos...");
  const oldPaises = (await oldDb.query(`SELECT idpais, pais FROM app_pais`)).rows;
  const oldDepas = (await oldDb.query(`SELECT idpais, dptocod, dpto FROM app_departamento`)).rows;
  const oldProvs = (await oldDb.query(`SELECT idpais, dptocod, prvcod, prv FROM app_provincia`)).rows;
  const oldDists = (await oldDb.query(`SELECT idpais, dptocod, prvcod, discod, dis FROM app_distrito`)).rows;

  const dbCountries = await prisma.country.findMany();
  const dbDepts = await prisma.department.findMany();
  const dbProvs = await prisma.province.findMany();
  const dbDists = await prisma.district.findMany();
  const peruId = dbCountries.find(c => c.isoCode === "PER")?.id || 1;

  const univMap = new Map((await prisma.university.findMany()).map((u) => [u.name.toUpperCase(), u.id]));
  const compMap = new Map((await prisma.company.findMany()).map((c) => [c.name.toUpperCase(), c.id]));
  const specMap = new Map((await prisma.specialty.findMany()).map((s) => [s.name.toUpperCase(), s.id]));

  const requiredDepartments = await prisma.membershipDepartment.findMany({
    where: { isRequired: true },
  });

  // =========================================================
  // ✅ DICCIONARIO INTELIGENTE: BUSCANDO A LOS RESPONSABLES
  // =========================================================
  const usrAsociados = await prisma.user.findFirst({ where: { email: "liset.otoya@iimp.org.pe" } });
  const usrLogistica = await prisma.user.findFirst({ where: { email: "lesly.alvarado@iimp.org.pe" } }); // Modificado a Lesly
  const usrComunicaciones = await prisma.user.findFirst({ where: { email: "pedro.villanueva@iimp.org.pe" } }); // ⚠️ Verifica su correo exacto
  const usrLegal = await prisma.user.findFirst({ where: { email: "araceli.basurco@iimp.org.pe" } }); // ⚠️ Verifica su correo exacto
  const usrComite = await prisma.user.findFirst({ where: { email: "rgaray@rgblasting.pe" } });
  const usrDefaultAdmin = await prisma.user.findFirst({ where: { email: "max.ichajaya@iimp.org.pe" } });

  // DICCIONARIO CRUZANDO DNI CON SOCIOS APROBADOS ('I')
  const dniToNameMap = new Map<string, string>();
  const sociosRes = await oldDb.query(`
    SELECT nrodoc, nombre, apellido, apellidom
    FROM app_ficha
    WHERE nrodoc IS NOT NULL AND TRIM(nrodoc) <> '' AND estado = 'I'
  `);
  
  for (const row of sociosRes.rows) {
    const dni = String(row.nrodoc).trim();
    const fullName = `${row.nombre || ''} ${row.apellido || ''} ${row.apellidom || ''}`.replace(/\s+/g, ' ').trim();
    if (dni && fullName) {
      dniToNameMap.set(dni, fullName);
    }
  }

  // TRAER EL ÚLTIMO REGISTRO POR DNI Y MODALIDAD PARA EVITAR DUPLICADOS ABSURDOS
  const resFichas = await oldDb.query(`
    SELECT f.*
    FROM app_ficha f
    INNER JOIN (
        SELECT nrodoc, modalidad, MAX(fichnro) as max_fichnro
        FROM app_ficha
        WHERE nrodoc IS NOT NULL AND TRIM(nrodoc) <> ''
        GROUP BY nrodoc, modalidad
    ) ultimos ON f.fichnro = ultimos.max_fichnro
    ORDER BY f.fichnro ASC
  `);
  console.log(`📦 Procesando ${resFichas.rowCount} expedientes únicos...\n`);

  let countSuccess = 0;

  for (const ficha of resFichas.rows) {
    const docNumber = ficha.nrodoc ? String(ficha.nrodoc).trim() : null;
    if (!docNumber) continue;

    const documentType = mapDocumentType(ficha.tipodoc);
    
    // MEJORA: Tipo de Afiliado Correcto
    const affiliateType = ficha.modalidad === 'E' ? "STUDENT" : "ACTIVE";
    const gender = mapGender(ficha.genero);
    
    let { appStatus, sponsorStatus } = determineStatuses(ficha.estado);

    let safeApplicationCode = ficha.nroficha ? String(ficha.nroficha).trim() : `LEGACY-${ficha.fichnro}`;
    const codeInUse = await prisma.membershipApplication.findFirst({ where: { applicationCode: safeApplicationCode } });
    if (codeInUse) safeApplicationCode = `${safeApplicationCode}-DUP-${ficha.fichnro}`;

    const trackingCode = `TRK-${ficha.fichnro}-${Date.now().toString().slice(-4)}`;
    const mainPhone = (ficha.celular || ficha.telefono || "000000000").trim();

    let parsedBirthDate = null;
    let uiBirthDateString = null;
    if (ficha.fechanac) {
      const tempDate = new Date(ficha.fechanac);
      if (!isNaN(tempDate.getTime())) {
        parsedBirthDate = tempDate;
        uiBirthDateString = tempDate.toISOString().split("T")[0];
      }
    }

    const paisOld = oldPaises.find(p => String(p.idpais) === String(ficha.pais));
    const paisName = paisOld ? paisOld.pais.trim().toUpperCase() : null;
    const matchedCountry = dbCountries.find(c => c.name.toUpperCase() === paisName);
    const finalCountryId = matchedCountry ? matchedCountry.id : peruId;
    const isoCode = matchedCountry ? matchedCountry.isoCode.toLowerCase() : "pe";

    const depaOld = oldDepas.find(d => String(d.idpais) === String(ficha.pais) && String(d.dptocod) === String(ficha.depa));
    const matchedDept = depaOld ? dbDepts.find(d => d.name.toUpperCase() === depaOld.dpto.trim().toUpperCase() && d.countryId === finalCountryId) : null;

    const provOld = oldProvs.find(p => String(p.idpais) === String(ficha.pais) && String(p.dptocod) === String(ficha.depa) && String(p.prvcod) === String(ficha.prov));
    const matchedProv = (provOld && matchedDept) ? dbProvs.find(p => p.name.toUpperCase() === provOld.prv.trim().toUpperCase() && p.departmentId === matchedDept.id) : null;

    const distOld = oldDists.find(d => String(d.idpais) === String(ficha.pais) && String(d.dptocod) === String(ficha.depa) && String(d.prvcod) === String(ficha.prov) && String(d.discod) === String(ficha.dist));
    const matchedDist = (distOld && matchedProv) ? dbDists.find(d => d.name.toUpperCase() === distOld.dis.trim().toUpperCase() && d.provinceId === matchedProv.id) : null;

    const especialidadName = affiliateType === "STUDENT" ? ficha.espe2 : ficha.espe;
    const uniLegacyName = affiliateType === "STUDENT" ? ficha.univ2 : ficha.univ;
    const anioIngreso = ficha.anioi ? parseInt(ficha.anioi) : null;
    const anioEgreso = ficha.anioe ? parseInt(ficha.anioe) : null;

    const uniText = ficha.nomuni ? String(ficha.nomuni).trim().toUpperCase() : null;
    const institutionId = uniText ? (univMap.get(uniText) || null) : null;

    try {
      await prisma.$transaction(async (tx) => {
        // A. CREAR O ACTUALIZAR PERSONA PRINCIPAL
        const person = await tx.person.upsert({
          where: { documentType_documentNumber: { documentType, documentNumber: docNumber } },
          update: { gender, birthDate: parsedBirthDate, nationalityId: finalCountryId },
          create: {
            documentType,
            documentNumber: docNumber,
            firstName: ficha.nombre || "Sin Nombre",
            paternalLastName: ficha.apellido || "Sin Apellido",
            maternalLastName: ficha.apellidom || "",
            birthDate: parsedBirthDate,
            gender,
            nationalityId: finalCountryId,
            contacts: {
              create: [{ phoneType: "MOBILE", phoneNumber: mainPhone, email: ficha.correo, isPrimary: true }],
            },
          },
        });

        // B. CREAR AVALES
        let firstEndorsementObj: any = undefined;
        let secondEndorsementObj: any = undefined;
        let sponsorPerson1Id: number | null = null;
        let sponsorPerson2Id: number | null = null;
        let code1 = "", code2 = "";
        let intest1 = ficha.intestaval1 || 0;
        let intest2 = ficha.intestaval2 || 0;

        if (affiliateType === "ACTIVE") {
          // AVAL 1
          if (ficha.dniaval1 && String(ficha.dniaval1).trim() !== "") {
            const dni1 = String(ficha.dniaval1).trim();
            let name1 = ficha.nombreaval1 ? String(ficha.nombreaval1).trim() : "";
            if (!name1 || name1.length < 2) name1 = dniToNameMap.get(dni1) || "Aval Por Definir";
            
            const email1 = ficha.correoaval1 ? String(ficha.correoaval1).trim() : "sin-correo@legacy.local";
            code1 = ficha.codaval1 ? String(ficha.codaval1).trim() : "00000";
            const parsedName1 = parseFullName(name1);

            const sponsorPerson1 = await tx.person.upsert({
              where: { documentType_documentNumber: { documentType: "DNI", documentNumber: dni1 } },
              update: { firstName: parsedName1.first, paternalLastName: parsedName1.paternal, maternalLastName: parsedName1.maternal },
              create: {
                documentType: "DNI", documentNumber: dni1,
                firstName: parsedName1.first, paternalLastName: parsedName1.paternal, maternalLastName: parsedName1.maternal,
                nationalityId: peruId,
                contacts: { create: [{ phoneType: "MOBILE", phoneNumber: "000000000", email: email1, isPrimary: true }] },
              },
            });
            sponsorPerson1Id = sponsorPerson1.id;

            firstEndorsementObj = {
              sponsorDocumentNumber: dni1, sponsorPersonId: sponsorPerson1.id,
              sponsorCode: code1, sponsorFullName: name1, sponsorEmail: email1
            };
          }

          // AVAL 2
          if (ficha.dniaval2 && String(ficha.dniaval2).trim() !== "") {
            const dni2 = String(ficha.dniaval2).trim();
            let name2 = ficha.nombreaval2 ? String(ficha.nombreaval2).trim() : "";
            if (!name2 || name2.length < 2) name2 = dniToNameMap.get(dni2) || "Aval Por Definir";
            
            const email2 = ficha.correoaval2 ? String(ficha.correoaval2).trim() : "sin-correo@legacy.local";
            code2 = ficha.codaval2 ? String(ficha.codaval2).trim() : "00000";
            const parsedName2 = parseFullName(name2);

            const sponsorPerson2 = await tx.person.upsert({
              where: { documentType_documentNumber: { documentType: "DNI", documentNumber: dni2 } },
              update: { firstName: parsedName2.first, paternalLastName: parsedName2.paternal, maternalLastName: parsedName2.maternal },
              create: {
                documentType: "DNI", documentNumber: dni2,
                firstName: parsedName2.first, paternalLastName: parsedName2.paternal, maternalLastName: parsedName2.maternal,
                nationalityId: peruId,
                contacts: { create: [{ phoneType: "MOBILE", phoneNumber: "000000000", email: email2, isPrimary: true }] },
              },
            });
            sponsorPerson2Id = sponsorPerson2.id;

            secondEndorsementObj = {
              sponsorDocumentNumber: dni2, sponsorPersonId: sponsorPerson2.id,
              sponsorCode: code2, sponsorFullName: name2, sponsorEmail: email2
            };
          }
        }

        const hasAvalAprobado = (intest1 === 1 || intest2 === 1);
        const hasAreaValidada = (Number(ficha.val_asociados) === 1 || Number(ficha.val_logistica) === 1);
        
        if (appStatus === "PENDING" && (hasAvalAprobado || hasAreaValidada)) {
            appStatus = "UNDER_EVALUACION";
        }

        const endorsementsDraft: any = {
          declarationAccepted: true,
          declarationDocumentId: ficha.carta || null
        };
        if (firstEndorsementObj) endorsementsDraft.firstEndorsement = firstEndorsementObj;
        if (secondEndorsementObj) endorsementsDraft.secondEndorsement = secondEndorsementObj;

        // C. CREAR EL DRAFT FINAL
        const draftData = {
          membershipType: affiliateType,
          personalInformation: {
            documentType, documentNumber: docNumber,
            names: ficha.nombre, fatherLastName: ficha.apellido, motherLastName: ficha.apellidom,
            birthDate: uiBirthDateString, primaryEmail: ficha.correo, phone: mainPhone,
            address: ficha.direccion, gender,
            countryId: finalCountryId,
            departmentId: matchedDept?.id || null,
            provinceId: matchedProv?.id || null,
            districtId: matchedDist?.id || null,
            isoCode: isoCode, 
            photo: ficha.fotoper ? { url: `${BASE_S3_URL}/${ficha.fotoper}`, name: ficha.fotoper, type: "image/jpeg" } : null,
          },
          academicStudies: [
            {
              institutionId: institutionId,
              otherInstitution: institutionId ? null : uniText, 
              degreeTitle: ficha.titulo, 
              specialty: especialidadName,
              admissionYear: anioIngreso,
              graduationYear: anioEgreso,
            },
          ],
          employmentInformation: {
            isUnemployed: !ficha.empresa,
            companyId: ficha.empresa ? compMap.get(String(ficha.empresa).trim().toUpperCase()) : null,
            companyName: ficha.empresa, positionName: ficha.cargo, area: ficha.area,
            companyTaxId: ficha.rucemp, workPhone: ficha.tlfemp, workEmail: ficha.correoemp,
          },
          endorsements: endorsementsDraft
        };

        // D. CREAR EL EXPEDIENTE
        const app = await tx.membershipApplication.create({
          data: {
            applicationCode: safeApplicationCode,
            trackingCode, personId: person.id,
            affiliateType, documentType, documentNumber: docNumber,
            email: ficha.correo || "sin-correo@legacy.local", phone: mainPhone,
            status: appStatus, currentStep: 5,
            draftData: draftData as any,
            createdAt: ficha.fechareg ? new Date(ficha.fechareg) : new Date(),
            submittedAt: ficha.fechareg ? new Date(ficha.fechareg) : new Date(),
          },
        });

        // E. INSERTAR ESTADOS DE AVALES CON FECHA HISTÓRICA
        if (sponsorPerson1Id) {
          let indStatus1 = (intest1 === 1 || appStatus === "COMPLETED") ? "APPROVED" : sponsorStatus;
          await tx.membershipApproval.create({
            data: { 
              applicationId: app.id, 
              sponsorPersonId: sponsorPerson1Id, 
              sponsorCode: code1, 
              status: indStatus1,
              transactionDate: ficha.fectraaval1 ? new Date(ficha.fectraaval1) : null,
              createdAt: ficha.fectraaval1 ? new Date(ficha.fectraaval1) : (ficha.fechareg ? new Date(ficha.fechareg) : new Date()),
            },
          });
        }

        if (sponsorPerson2Id) {
          let indStatus2 = (intest2 === 1 || appStatus === "COMPLETED") ? "APPROVED" : sponsorStatus;
          await tx.membershipApproval.create({
            data: { 
              applicationId: app.id, 
              sponsorPersonId: sponsorPerson2Id, 
              sponsorCode: code2, 
              status: indStatus2,
              transactionDate: ficha.fectraaval2 ? new Date(ficha.fectraaval2) : null,
              createdAt: ficha.fectraaval2 ? new Date(ficha.fectraaval2) : (ficha.fechareg ? new Date(ficha.fechareg) : new Date()),
            },
          });
        }

        // F. RELACIONES ACADÉMICAS Y LABORALES
        if (ficha.titulo || uniText) {
          await tx.academicInfo.create({
            data: {
              personId: person.id, studyLevel: "BACHELOR",
              universityId: institutionId,
              specialtyId: especialidadName ? specMap.get(String(especialidadName).trim().toUpperCase()) : null,
              degreeTitle: ficha.titulo, 
              graduationYear: anioEgreso,
            },
          });
        }
        if (ficha.empresa) {
          await tx.employmentInfo.create({
            data: {
              personId: person.id,
              companyId: ficha.empresa ? compMap.get(String(ficha.empresa).trim().toUpperCase()) : null,
              area: ficha.area, workingAddress: ficha.direcemp, workPhone: ficha.tlfemp, workEmail: ficha.correoemp,
            },
          });
        }

        // G. DOCUMENTOS HACIA S3
        const docs = [
          { name: ficha.fotoper, cat: "OTHER" },
          { name: ficha.documentoadj, cat: "ID_DOCUMENT" },
          { name: ficha.cv_documento, cat: "CV" },
          { name: ficha.declaracion_jurada, cat: "SWORN_DECLARATION" },
          { name: ficha.carta, cat: "RECOMMENDATION_LETTER" },
          { name: ficha.comprobante || ficha.voucher, cat: "PAYMENT_VOUCHER" },
        ];
        for (const doc of docs) {
          if (doc.name && String(doc.name).trim() !== "") {
            await tx.applicationDocument.create({
              data: {
                applicationId: app.id, category: doc.cat as any,
                fileUrl: `${BASE_S3_URL}/${doc.name}`, fileName: doc.name,
                mimeType: String(doc.name).endsWith(".pdf") ? "application/pdf" : "image/jpeg", sizeBytes: BigInt(0),
              },
            });
          }
        }

        // H. VALIDACIONES DE ÁREAS (Historial para las Gráficas)
        if (requiredDepartments.length > 0) {
          const applyingDepartments = requiredDepartments.filter((dept) => {
            if (affiliateType === "STUDENT") return ["ASOCIADOS", "LOGISTICA", "COMITE"].includes(dept.code);
            return true; // Si es Activo, aplican todas
          });

          for (const dept of applyingDepartments) {
            let isDeptApproved = false;
            let validatedById = null;
            
            if (appStatus === "COMPLETED") {
              isDeptApproved = true;
            } else if (appStatus !== "REJECTED") {
              if (dept.code === "ASOCIADOS" && Number(ficha.val_asociados) === 1) isDeptApproved = true;
              if (dept.code === "LOGISTICA" && Number(ficha.val_logistica) === 1) isDeptApproved = true;
            }

            let finalStatus: any = appStatus === "REJECTED" ? "REJECTED" : (isDeptApproved ? "APPROVED" : "PENDING");
            
            // ✅ ASIGNACIÓN DE LOS NUEVOS RESPONSABLES POR ÁREA
            if (finalStatus === "APPROVED" || finalStatus === "REJECTED") {
              if (dept.code === "ASOCIADOS") validatedById = usrAsociados?.id;
              else if (dept.code === "LOGISTICA") validatedById = usrLogistica?.id;
              else if (dept.code === "COMUNICACIONES") validatedById = usrComunicaciones?.id; 
              else if (dept.code === "LEGAL") validatedById = usrLegal?.id; 
              else if (dept.code === "COMITE") validatedById = usrComite?.id;
              else validatedById = usrDefaultAdmin?.id; 
            }

            const historicalDate = ficha.fechaparob ? new Date(ficha.fechaparob) : (ficha.fechareg ? new Date(ficha.fechareg) : new Date());

            const validation = await tx.membershipValidation.create({
              data: {
                applicationId: app.id, departmentId: dept.id, status: finalStatus,
                validatedById: validatedById, 
                validatedAt: validatedById ? historicalDate : null,
                createdAt: ficha.fechareg ? new Date(ficha.fechareg) : new Date(), 
              },
            });

            if (validatedById) {
              await tx.membershipValidationHistory.create({
                data: {
                  validationId: validation.id, userId: validatedById, action: finalStatus,
                  comment: finalStatus === "APPROVED" ? "Aprobado en sistema Legacy." : "Rechazado en sistema Legacy.",
                  createdAt: historicalDate
                },
              });
            }
          }
        }

        // I. PAGOS CON FECHA HISTÓRICA
        if (ficha.montot && parseFloat(ficha.montot) > 0) {
          const historicalPayDate = ficha.fechapago ? new Date(ficha.fechapago) : (ficha.fechareg ? new Date(ficha.fechareg) : new Date());
          
          await tx.payment.create({
            data: {
              applicationId: app.id, gateway: "BANK_TRANSFER", totalAmount: parseFloat(ficha.montot),
              currency: ficha.moneda === "Dolares" ? "USD" : "PEN", status: appStatus === "COMPLETED" ? "PAID" : "PENDING",
              paymentDate: ficha.fechapago ? new Date(ficha.fechapago) : null,
              createdAt: historicalPayDate,
              billing: ficha.compruc ? {
                  create: { taxId: ficha.compruc, businessName: ficha.comprazon || "Legacy", billingAddress: ficha.compdirec, billingEmail: ficha.compcorreo, createdAt: historicalPayDate },
                } : undefined,
            },
          });
        }
      });

      countSuccess++;
    } catch (e) {
      console.log(`❌ Error al migrar ficha N° ${ficha.fichnro} (DNI: ${docNumber}):`, e);
    }
  }

  console.log(`\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE. Total fichas insertadas: ${countSuccess}`);
}

async function main() {
  await oldDb.connect();
  try {
    await migrarFichas();
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

main();
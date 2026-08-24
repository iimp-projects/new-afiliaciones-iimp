import { PrismaClient, StudyLevel } from '@prisma/client';
import { Client } from 'pg';

const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://postgres:admin@localhost:5432/bd_afiliaciones_dev?schema=public" }
  }
});

const oldDb = new Client({
  connectionString: "postgresql://postgres:admin@localhost:5432/bdafiliacion"
});

async function migrarCatalogos() {
  console.log("🚀 INICIANDO FASE 2: Extracción de Catálogos Dinámicos desde app_ficha...\n");

  // Asumimos país Perú (ID 1 o el que encuentre) para las entidades locales
  const defaultCountry = await prisma.country.findFirst({
    where: { OR: [{ isoCode: 'PER' }, { name: { contains: 'Per', mode: 'insensitive' } }] }
  });
  const countryId = defaultCountry ? defaultCountry.id : 1;

  // ===================================================
  // A. UNIVERSIDADES (campos: univ, nomuni)
  // ===================================================
  console.log("Extrayendo universidades únicas...");
  const resUniv = await oldDb.query(`
    SELECT DISTINCT TRIM(UPPER(COALESCE(NULLIF(nomuni, ''), univ))) as nombre_univ
    FROM app_ficha
    WHERE COALESCE(NULLIF(nomuni, ''), univ) IS NOT NULL AND TRIM(COALESCE(NULLIF(nomuni, ''), univ)) <> ''
  `);

  let countUniv = 0;
  for (const row of resUniv.rows) {
    const name = row.nombre_univ;
    if (!name) continue;

    const exists = await prisma.university.findFirst({ where: { name } });
    if (!exists) {
      await prisma.university.create({
        data: { name, countryId, isActive: true }
      });
      countUniv++;
    }
  }
  console.log(`✅ ${countUniv} nuevas universidades registradas de un total de ${resUniv.rows.length} encontradas en fichas.\n`);

  // ===================================================
  // B. ESPECIALIDADES (campos: espe, espe2)
  // ===================================================
  console.log("Extrayendo especialidades únicas...");
  const resEspe = await oldDb.query(`
    SELECT DISTINCT TRIM(UPPER(espe)) as especialidad FROM app_ficha WHERE espe IS NOT NULL AND TRIM(espe) <> ''
    UNION
    SELECT DISTINCT TRIM(UPPER(espe2)) as especialidad FROM app_ficha WHERE espe2 IS NOT NULL AND TRIM(espe2) <> ''
  `);

  let countEspe = 0;
  for (const row of resEspe.rows) {
    const name = row.especialidad;
    if (!name) continue;

    const exists = await prisma.specialty.findFirst({ where: { name } });
    if (!exists) {
      await prisma.specialty.create({ data: { name, isActive: true } });
      countEspe++;
    }
  }
  console.log(`✅ ${countEspe} nuevas especialidades registradas de ${resEspe.rows.length} encontradas.\n`);

  // ===================================================
  // C. EMPRESAS (campos: empresa, rucemp)
  // ===================================================
  console.log("Extrayendo empresas únicas...");
  const resEmpresas = await oldDb.query(`
    SELECT DISTINCT 
      TRIM(UPPER(empresa)) as nombre_empresa,
      TRIM(rucemp) as ruc
    FROM app_ficha 
    WHERE empresa IS NOT NULL AND TRIM(empresa) <> ''
  `);

  let countEmp = 0;
  for (const row of resEmpresas.rows) {
    const name = row.nombre_empresa;
    const taxId = (row.ruc && row.ruc.trim().length >= 8) ? row.ruc.trim() : null;
    if (!name) continue;

    const exists = await prisma.company.findFirst({
      where: { OR: [ ...(taxId ? [{ taxId }] : []), { name } ] }
    });

    if (!exists) {
      await prisma.company.create({
        data: { name, taxId, countryId, isActive: true }
      });
      countEmp++;
    }
  }
  console.log(`✅ ${countEmp} nuevas empresas registradas de ${resEmpresas.rows.length} encontradas.\n`);

  // ===================================================
  // D. CARGOS LABORALES (campo: cargo)
  // ===================================================
  console.log("Extrayendo cargos únicos...");
  const resCargos = await oldDb.query(`
    SELECT DISTINCT TRIM(UPPER(cargo)) as cargo 
    FROM app_ficha 
    WHERE cargo IS NOT NULL AND TRIM(cargo) <> ''
  `);

  let countCargos = 0;
  for (const row of resCargos.rows) {
    const name = row.cargo;
    if (!name) continue;

    const exists = await prisma.jobPosition.findFirst({ where: { name } });
    if (!exists) {
      await prisma.jobPosition.create({ data: { name, isActive: true } });
      countCargos++;
    }
  }
  console.log(`✅ ${countCargos} nuevos cargos registrados de ${resCargos.rows.length} encontrados.\n`);

  // ===================================================
  // E. GRADOS ACADÉMICOS (campo: titulo)
  // ===================================================
  console.log("Extrayendo grados/títulos únicos...");
  const resTitulos = await oldDb.query(`
    SELECT DISTINCT TRIM(UPPER(titulo)) as titulo 
    FROM app_ficha 
    WHERE titulo IS NOT NULL AND TRIM(titulo) <> ''
  `);

  let countTitulos = 0;
  for (const row of resTitulos.rows) {
    const name = row.titulo;
    if (!name) continue;

    const exists = await prisma.academicDegree.findFirst({ where: { name } });
    if (!exists) {
      await prisma.academicDegree.create({
        data: { name, studyLevel: StudyLevel.BACHELOR, isActive: true }
      });
      countTitulos++;
    }
  }
  console.log(`✅ ${countTitulos} nuevos grados académicos registrados de ${resTitulos.rows.length} encontrados.\n`);

  console.log("🎉 FASE 2 COMPLETADA CON ÉXITO.");
}

async function main() {
  await oldDb.connect();
  console.log("🔌 Conexión establecida con bdafiliacion (Legacy).\n");
  
  try {
    await migrarCatalogos();
  } catch (error) {
    console.error("❌ Error catastrófico durante la migración de catálogos:", error);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
    console.log("🔌 Conexiones cerradas.");
  }
}

main();
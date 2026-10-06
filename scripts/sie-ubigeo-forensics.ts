import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { AssociatesApiClient } from "../modules/afiliaciones/associates-integration/Clients/AssociatesApiClient";
import { getAssociatesApiConfig } from "../modules/afiliaciones/associates-integration/Config/AssociatesApiConfig";
import type { SanitizedSieAssociate } from "../modules/afiliaciones/associates-integration/Models/SieAssociateList";

const PAGE_SIZE = 500;
const HISTORICAL = ["T", "V", "H", "F", "R", "X", "U"];

type GeoTuple = { pais: string; paisNombre: string; departamento: string; departamentoNombre: string; provincia: string; provinciaNombre: string; distrito: string; distritoNombre: string };

function norm(value: string | null | undefined): string {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").replace(/[.,]/g, "").trim();
}

function tupleKey(t: GeoTuple): string {
  return [t.pais, t.paisNombre, t.departamento, t.departamentoNombre, t.provincia, t.provinciaNombre, t.distrito, t.distritoNombre].map(norm).join("||");
}

function geoOf(record: SanitizedSieAssociate): GeoTuple {
  return {
    pais: record.pais ?? "",
    paisNombre: record.paisNombre ?? "",
    departamento: record.departamento ?? "",
    departamentoNombre: record.departamentoNombre ?? "",
    provincia: record.provincia ?? "",
    provinciaNombre: record.provinciaNombre ?? "",
    distrito: record.distrito ?? "",
    distritoNombre: record.distritoNombre ?? "",
  };
}

async function loadCatalogs(prisma: PrismaClient) {
  const [countries, departments, provinces, districts] = await Promise.all([
    prisma.country.findMany({ select: { id: true, name: true, code: true, isoCode: true } }),
    prisma.department.findMany({ select: { id: true, name: true, code: true, ubigeoCode: true, countryId: true } }),
    prisma.province.findMany({ select: { id: true, name: true, code: true, ubigeoCode: true, departmentId: true } }),
    prisma.district.findMany({ select: { id: true, name: true, code: true, ubigeoCode: true, provinceId: true } }),
  ]);

  const countryByName = new Map<string, number>();
  const countryByIso = new Map<string, number>();
  const countryByCode = new Map<string, number>();
  for (const country of countries) {
    countryByName.set(norm(country.name), country.id);
    if (country.isoCode) countryByIso.set(norm(country.isoCode), country.id);
    if (country.code) countryByCode.set(norm(country.code), country.id);
  }

  const departmentByName = new Map<string, number>();
  const departmentByUbigeo = new Map<string, number>();
  const departmentByCode = new Map<string, number>();
  for (const department of departments) {
    departmentByName.set(`${department.countryId}|${norm(department.name)}`, department.id);
    if (department.ubigeoCode) departmentByUbigeo.set(norm(department.ubigeoCode), department.id);
    if (department.code) departmentByCode.set(norm(department.code), department.id);
  }

  const provinceByName = new Map<string, number>();
  const provinceByUbigeo = new Map<string, number>();
  const provinceByCode = new Map<string, number>();
  for (const province of provinces) {
    provinceByName.set(`${province.departmentId}|${norm(province.name)}`, province.id);
    if (province.ubigeoCode) provinceByUbigeo.set(norm(province.ubigeoCode), province.id);
    if (province.code) provinceByCode.set(norm(province.code), province.id);
  }

  const districtByName = new Map<string, number>();
  const districtByUbigeo = new Map<string, number>();
  const districtByCode = new Map<string, number>();
  for (const district of districts) {
    districtByName.set(`${district.provinceId}|${norm(district.name)}`, district.id);
    if (district.ubigeoCode) districtByUbigeo.set(norm(district.ubigeoCode), district.id);
    if (district.code) districtByCode.set(norm(district.code), district.id);
  }

  return { countryByName, countryByIso, countryByCode, departmentByName, departmentByUbigeo, departmentByCode, provinceByName, provinceByUbigeo, provinceByCode, districtByName, districtByUbigeo, districtByCode, districts };
}

type Catalogs = Awaited<ReturnType<typeof loadCatalogs>>;

function resolveGeo(geo: GeoTuple, cat: Catalogs): { method: string; districtId: number | null; countryId: number | null; departmentId: number | null; provinceId: number | null; countryMatch: boolean; departmentMatch: boolean; provinceMatch: boolean; districtMatch: boolean } {
  const paisNombre = norm(geo.paisNombre);
  const depNombre = norm(geo.departamentoNombre);
  const provNombre = norm(geo.provinciaNombre);
  const distNombre = norm(geo.distritoNombre);
  const paisCode = norm(geo.pais);
  const depCode = norm(geo.departamento);
  const provCode = norm(geo.provincia);
  const distCode = norm(geo.distrito);

  let countryId: number | null = null;
  let countryMethod = "";
  if (paisNombre) { countryId = cat.countryByName.get(paisNombre) ?? null; if (countryId) countryMethod = "NAME"; }
  if (!countryId && paisCode) { countryId = cat.countryByIso.get(paisCode) ?? cat.countryByCode.get(paisCode) ?? null; if (countryId) countryMethod = "CODE"; }

  let departmentId: number | null = null;
  let departmentMethod = "";
  if (depNombre && countryId) { departmentId = cat.departmentByName.get(`${countryId}|${depNombre}`) ?? null; if (departmentId) departmentMethod = "NAME"; }
  if (!departmentId && depCode) { departmentId = cat.departmentByUbigeo.get(depCode) ?? cat.departmentByCode.get(depCode) ?? null; if (departmentId) departmentMethod = "CODE"; }

  let provinceId: number | null = null;
  let provinceMethod = "";
  if (provNombre && departmentId) { provinceId = cat.provinceByName.get(`${departmentId}|${provNombre}`) ?? null; if (provinceId) provinceMethod = "NAME"; }
  if (!provinceId && provCode) { provinceId = cat.provinceByUbigeo.get(provCode) ?? cat.provinceByCode.get(provCode) ?? null; if (provinceId) provinceMethod = "CODE"; }

  let districtId: number | null = null;
  let districtMethod = "";
  if (distNombre && provinceId) { districtId = cat.districtByName.get(`${provinceId}|${distNombre}`) ?? null; if (districtId) districtMethod = "NAME"; }
  if (!districtId && distCode) { districtId = cat.districtByUbigeo.get(distCode) ?? cat.districtByCode.get(distCode) ?? null; if (districtId) districtMethod = "CODE"; }

  return {
    method: [countryMethod, departmentMethod, provinceMethod, districtMethod].filter(Boolean).join("/") || "NONE",
    districtId,
    countryId,
    departmentId,
    provinceId,
    countryMatch: countryId !== null,
    departmentMatch: departmentId !== null,
    provinceMatch: provinceId !== null,
    districtMatch: districtId !== null,
  };
}

function classify(geo: GeoTuple, cat: Catalogs): string {
  const hasGeo = geo.paisNombre || geo.departamentoNombre || geo.provinciaNombre || geo.distritoNombre || geo.pais || geo.departamento || geo.provincia || geo.distrito;
  if (!hasGeo) return "UBIGEO_NULL";
  const r = resolveGeo(geo, cat);
  if (r.districtMatch && r.method.includes("NAME")) return "UBIGEO_EXACT_MATCH";
  if (r.districtMatch) return "UBIGEO_NAME_MATCH";
  if (r.countryMatch || r.departmentMatch || r.provinceMatch) return "UBIGEO_PARTIAL";
  return "UBIGEO_NOT_FOUND";
}

function codeShape(value: string | null | undefined): string {
  if (!value) return "EMPTY";
  const v = value.trim();
  if (/^\d+$/.test(v)) return v.startsWith("0") && v.length > 1 ? `NUMERIC_LZ_${v.length}` : `NUMERIC_${v.length}`;
  return `ALPHA_${v.length}`;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result: Record<string, unknown> = { r69_4b_status: "FAIL", error: null };
  try {
    const client = new AssociatesApiClient(getAssociatesApiConfig());
    const firstPage = await client.listAssociates({ pagina: 1, tamanioPagina: PAGE_SIZE });
    const totalPaginas = firstPage.totalPaginas || 1;
    const pages = [firstPage];
    for (let page = 2; page <= totalPaginas; page += 1) pages.push(await client.listAssociates({ pagina: page, tamanioPagina: PAGE_SIZE }));
    const records = pages.flatMap((page) => page.associates).filter((record) => HISTORICAL.includes(record.sourceType));
    const cat = await loadCatalogs(prisma);

    const before: Record<string, number> = { UBIGEO_EXACT_MATCH: 0, UBIGEO_NAME_MATCH: 0, UBIGEO_PARTIAL: 0, UBIGEO_NOT_FOUND: 0, UBIGEO_NULL: 0 };
    const codeShapes = new Map<string, number>();
    const partialPatterns = new Map<string, { tuple: GeoTuple; count: number }>();
    const notFoundPatterns = new Map<string, { tuple: GeoTuple; count: number }>();
    const nullRecords = new Map<string, number>();

    for (const record of records) {
      const geo = geoOf(record);
      const cls = classify(geo, cat);
      before[cls] += 1;
      for (const field of [record.pais, record.departamento, record.provincia, record.distrito]) {
        const shape = codeShape(field);
        codeShapes.set(shape, (codeShapes.get(shape) ?? 0) + 1);
      }
      if (cls === "UBIGEO_PARTIAL") {
        const key = tupleKey(geo);
        const existing = partialPatterns.get(key);
        if (existing) existing.count += 1;
        else partialPatterns.set(key, { tuple: geo, count: 1 });
      } else if (cls === "UBIGEO_NOT_FOUND") {
        const key = tupleKey(geo);
        const existing = notFoundPatterns.get(key);
        if (existing) existing.count += 1;
        else notFoundPatterns.set(key, { tuple: geo, count: 1 });
      } else if (cls === "UBIGEO_NULL") {
        const key = tupleKey(geo);
        nullRecords.set(key, (nullRecords.get(key) ?? 0) + 1);
      }
    }

    const partialSorted = [...partialPatterns.values()].sort((a, b) => b.count - a.count);
    const notFoundSorted = [...notFoundPatterns.values()].sort((a, b) => b.count - a.count);

    let resolved = 0;
    let stillPartial = 0;
    let stillNotFound = 0;
    let stillNull = 0;
    const aliasCandidates = new Map<string, { count: number; candidateDistrict: string; tuple: GeoTuple }>();

    for (const record of records) {
      const geo = geoOf(record);
      const cls = classify(geo, cat);
      if (cls === "UBIGEO_EXACT_MATCH" || cls === "UBIGEO_NAME_MATCH") { resolved += 1; continue; }
      if (cls === "UBIGEO_NULL") { stillNull += 1; continue; }

      const r = resolveGeo(geo, cat);
      if (r.districtMatch) { resolved += 1; continue; }

      const provinceId = r.provinceId;
      const distNorm = norm(geo.distritoNombre);
      let aliasCandidate: string | null = null;
      if (provinceId && distNorm) {
        const candidates = cat.districts.filter((district) => district.provinceId === provinceId);
        const exact = candidates.filter((district) => norm(district.name) === distNorm);
        if (exact.length === 1) aliasCandidate = exact[0].name;
        else {
          const contained = candidates.filter((district) => distNorm.includes(norm(district.name)) || norm(district.name).includes(distNorm));
          if (contained.length === 1) aliasCandidate = contained[0].name;
        }
      }

      if (aliasCandidate) {
        resolved += 1;
        const key = tupleKey(geo);
        aliasCandidates.set(key, { count: (aliasCandidates.get(key)?.count ?? 0) + 1, candidateDistrict: aliasCandidate, tuple: geo });
      } else if (r.countryMatch || r.departmentMatch || r.provinceMatch) {
        stillPartial += 1;
      } else {
        stillNotFound += 1;
      }
    }

    result.r69_4b_status = "PASS";
    result.target_records = records.length;
    result.before = before;
    result.sie_code_shapes = Object.fromEntries([...codeShapes.entries()].sort());
    result.partial_unique_patterns = partialSorted.length;
    result.partial_records_covered = partialSorted.reduce((sum, p) => sum + p.count, 0);
    result.top_partial_patterns = partialSorted.slice(0, 50).map((p) => ({ count: p.count, geo: p.tuple, resolution: (() => { const r = resolveGeo(p.tuple, cat); return { method: r.method, countryMatch: r.countryMatch, departmentMatch: r.departmentMatch, provinceMatch: r.provinceMatch, districtMatch: r.districtMatch }; })() }));
    result.not_found_patterns = notFoundSorted.map((p) => ({ count: p.count, geo: p.tuple }));
    result.null_records = nullRecords.size;
    result.after = { resolved, still_partial: stillPartial, still_not_found: stillNotFound, null: stillNull };
    result.safe_alias_unique_patterns = aliasCandidates.size;
    result.safe_alias_records = [...aliasCandidates.values()].reduce((sum, c) => sum + c.count, 0);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();

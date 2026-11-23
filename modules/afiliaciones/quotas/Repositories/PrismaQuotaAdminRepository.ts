import { Prisma, type QuotaSyncRun } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  QuotaAdminFilters,
  QuotaAssociateDetail,
  QuotaAssociateRow,
  QuotaHistoryRow,
  QuotaIncidenceRow,
  QuotaPaginated,
  QuotaSyncRunRow,
} from "../Models/QuotaAdmin";
import type {
  IQuotaAdminRepository,
  QuotaCategoryDistributionRow,
  QuotaCoverageRow,
  QuotaGroupRow,
  QuotaYearGroupRow,
} from "./Interfaces/IQuotaAdminRepository";
import { buildConceptTotal } from "../Services/quotaConceptTotal";
import { currentQuotaYear, isUpcomingQuota } from "../Services/quotaPendingScope";

const EMPTY_META = { page: 1, pageSize: 0, total: 0, totalPages: 0 };

function toRunRow(run: QuotaSyncRun): QuotaSyncRunRow {
  return {
    id: run.id,
    status: run.status,
    scope: run.scope,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    processedAssociates: run.processedAssociates,
    syncedAssociates: run.syncedAssociates,
    noDataAssociates: run.noDataAssociates,
    failedAssociates: run.failedAssociates,
    quotasInserted: run.quotasInserted,
    quotasUpdated: run.quotasUpdated,
    quotasUnchanged: run.quotasUnchanged,
  };
}

function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0 };
}

export class PrismaQuotaAdminRepository implements IQuotaAdminRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  async getLatestFullRun(): Promise<QuotaSyncRunRow | null> {
    const run = await this.db.quotaSyncRun.findFirst({
      where: { scope: "FULL", finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
    });
    return run ? toRunRow(run) : null;
  }

  async getCoverage(runId: number): Promise<QuotaCoverageRow[]> {
    const rows = await this.db.quotaSyncItem.groupBy({ by: ["status"], where: { syncRunId: runId }, _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  }

  async getQuotaGroups(): Promise<QuotaGroupRow[]> {
    const currentYear = currentQuotaYear();
    const rows = await this.db.associateQuota.groupBy({
      by: ["concept", "currency", "accountingStatus"],
      where: { isPresentInLastSuccessfulSync: true, NOT: { accountingStatus: "PENDIENTE", year: { gt: currentYear } } },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return rows.map((row) => ({
      concept: row.concept,
      currency: row.currency,
      accountingStatus: row.accountingStatus,
      count: row._count._all,
      amount: row._sum.amount?.toFixed(2) ?? "0.00",
    }));
  }

  async getYearGroups(): Promise<QuotaYearGroupRow[]> {
    const currentYear = currentQuotaYear();
    const rows = await this.db.associateQuota.groupBy({
      by: ["year", "concept", "currency", "accountingStatus"],
      where: { isPresentInLastSuccessfulSync: true, NOT: { accountingStatus: "PENDIENTE", year: { gt: currentYear } } },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: [{ year: "asc" }, { concept: "asc" }, { currency: "asc" }, { accountingStatus: "asc" }],
    });
    return rows.map((row) => ({
      year: row.year,
      concept: row.concept,
      currency: row.currency,
      accountingStatus: row.accountingStatus,
      count: row._count._all,
      amount: row._sum.amount?.toFixed(2) ?? "0.00",
    }));
  }

  async getCategoryDistribution(): Promise<QuotaCategoryDistributionRow[]> {
    const rows = await this.db.$queryRaw<Array<{ category_code: string; category_name: string; associates: number; records: number }>>`
      WITH cat AS (
        SELECT DISTINCT ON (person_id) person_id, source_type
        FROM sie_associate_records
        WHERE provider = 'SIE' AND person_id IS NOT NULL
        ORDER BY person_id, id
      )
      SELECT COALESCE(cat.source_type, 'SIN_CATEGORIA'::text) AS category_code,
             COALESCE(mc.name, 'Sin categoría') AS category_name,
             COUNT(DISTINCT q.person_id)::int AS associates,
             COUNT(*)::int AS records
      FROM associate_quotas q
      LEFT JOIN cat ON cat.person_id = q.person_id
      LEFT JOIN membership_categories mc ON mc.code = cat.source_type
      WHERE q.is_present_in_last_successful_sync = true
      GROUP BY 1, 2
      ORDER BY 1`;
    return rows.map((row) => ({ categoryCode: row.category_code, categoryName: row.category_name, associates: row.associates, records: row.records }));
  }

  async countUniverse(runId: number): Promise<number> {
    return this.db.quotaSyncItem.count({ where: { syncRunId: runId } });
  }

  async countAssociatesWithInfo(): Promise<number> {
    const rows = await this.db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT person_id)::int AS count FROM associate_quotas WHERE is_present_in_last_successful_sync = true`;
    return rows[0]?.count ?? 0;
  }

  async countAssociatesWithPending(concept: "CUOTA" | "INSCRIPCION"): Promise<number> {
    const currentYear = currentQuotaYear();
    const rows = await this.db.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(DISTINCT person_id)::int AS count FROM associate_quotas
      WHERE concept::text = ${concept} AND accounting_status::text = 'PENDIENTE' AND year <= ${currentYear} AND is_present_in_last_successful_sync = true`;
    return rows[0]?.count ?? 0;
  }

  async countIncidences(runId: number): Promise<number> {
    return this.db.quotaSyncItem.count({ where: { syncRunId: runId, status: "FAILED" } });
  }

  async countResolvedIncidences(runId: number): Promise<number> {
    return this.db.quotaSyncItem.count({ where: { syncRunId: runId, status: "SUCCEEDED", attempts: { gt: 1 } } });
  }

  async listAssociates(filters: QuotaAdminFilters): Promise<QuotaPaginated<QuotaAssociateRow>> {
    const latest = await this.getLatestFullRun();
    if (!latest) return { data: [], meta: { ...EMPTY_META, page: filters.page, pageSize: filters.pageSize } };
    const concept = filters.concept ?? "CUOTA";
    const currentYear = currentQuotaYear();
    const offset = (filters.page - 1) * filters.pageSize;
    const hasYearFilter = filters.year != null || filters.yearFrom != null || filters.yearTo != null;
    const yearCondition = filters.year != null
      ? Prisma.sql`AND q.year = ${filters.year}`
      : filters.yearFrom != null || filters.yearTo != null
        ? Prisma.sql`AND q.year BETWEEN ${filters.yearFrom ?? 1900} AND ${filters.yearTo ?? 2100}`
        : Prisma.empty;

    const where: Prisma.Sql[] = [Prisma.sql`1 = 1`];
    if (filters.search) {
      const search = `%${filters.search}%`;
      where.push(Prisma.sql`(p.first_name ILIKE ${search} OR p.paternal_last_name ILIKE ${search} OR p.maternal_last_name ILIKE ${search} OR p.document_number ILIKE ${search} OR u.institutional_code ILIKE ${search})`);
    }
    if (filters.category) where.push(Prisma.sql`cat.source_type = ${filters.category}`);
    if (filters.membershipStatus) where.push(Prisma.sql`COALESCE(mc.mapped_affiliate_type::text, mc.name, 'SIN_CATEGORIA'::text) = ${filters.membershipStatus}`);
    if (filters.accountingStatus === "FACTURADO") where.push(Prisma.sql`COALESCE(a.facturado_count, 0) > 0`);
    if (filters.accountingStatus === "PENDIENTE") where.push(Prisma.sql`COALESCE(a.pendiente_count, 0) > 0`);
    if (filters.financialStatus === "WITH_INFO") where.push(Prisma.sql`COALESCE(a.quota_count, 0) > 0`);
    if (filters.financialStatus === "NO_INFO") where.push(Prisma.sql`COALESCE(a.quota_count, 0) = 0 AND u.coverage_status IN ('SUCCEEDED', 'NO_DATA')`);
    if (filters.financialStatus === "NOT_FOUND") where.push(Prisma.sql`u.coverage_status = 'NOT_FOUND'`);
    if (filters.financialStatus === "FAILED") where.push(Prisma.sql`u.coverage_status = 'FAILED'`);
    if (filters.financialStatus === "WITH_INCIDENCES" || filters.hasIncidences) where.push(Prisma.sql`(u.error_code IS NOT NULL OR u.coverage_status = 'FAILED')`);
    if (filters.currency) {
      where.push(Prisma.sql`EXISTS (SELECT 1 FROM associate_quotas q2 WHERE q2.person_id = p.id AND q2.concept::text = ${concept} AND q2.currency = ${filters.currency} AND q2.is_present_in_last_successful_sync = true)`);
    }
    if (filters.pendingMin != null) {
      const column = filters.currency === "US$" ? Prisma.raw("COALESCE(a.pendiente_usd::numeric, 0)") : Prisma.raw("COALESCE(a.pendiente_pen::numeric, 0)");
      where.push(Prisma.sql`${column} >= ${filters.pendingMin}::numeric`);
    }
    if (filters.pendingMax != null) {
      const column = filters.currency === "US$" ? Prisma.raw("COALESCE(a.pendiente_usd::numeric, 0)") : Prisma.raw("COALESCE(a.pendiente_pen::numeric, 0)");
      where.push(Prisma.sql`${column} <= ${filters.pendingMax}::numeric`);
    }
    if (hasYearFilter) where.push(Prisma.sql`COALESCE(a.quota_count, 0) > 0`);
    const whereSql = Prisma.join(where, " AND ");

    const base = Prisma.sql`
      WITH universe AS (
        SELECT i.person_id, i.institutional_code, i.status::text AS coverage_status, i.error_code, i.attempts
        FROM quota_sync_items i
        WHERE i.sync_run_id = ${latest.id}
      ),
      agg AS (
        SELECT q.person_id,
          COUNT(*) FILTER (WHERE q.concept::text = ${concept})::int AS quota_count,
          COUNT(*) FILTER (WHERE q.concept::text = ${concept} AND q.accounting_status::text = 'FACTURADO')::int AS facturado_count,
          COUNT(*) FILTER (WHERE q.concept::text = ${concept} AND q.accounting_status::text = 'PENDIENTE' AND q.year <= ${currentYear})::int AS pendiente_count,
          COALESCE(SUM(q.amount) FILTER (WHERE q.concept::text = ${concept} AND q.currency = 'S/' AND q.accounting_status::text = 'FACTURADO'), 0)::numeric(12,2)::text AS facturado_pen,
          COALESCE(SUM(q.amount) FILTER (WHERE q.concept::text = ${concept} AND q.currency = 'US$' AND q.accounting_status::text = 'FACTURADO'), 0)::numeric(12,2)::text AS facturado_usd,
          COALESCE(SUM(q.amount) FILTER (WHERE q.concept::text = ${concept} AND q.currency = 'S/' AND q.accounting_status::text = 'PENDIENTE' AND q.year <= ${currentYear}), 0)::numeric(12,2)::text AS pendiente_pen,
          COALESCE(SUM(q.amount) FILTER (WHERE q.concept::text = ${concept} AND q.currency = 'US$' AND q.accounting_status::text = 'PENDIENTE' AND q.year <= ${currentYear}), 0)::numeric(12,2)::text AS pendiente_usd,
          COALESCE(ARRAY_AGG(DISTINCT q.year) FILTER (WHERE q.concept::text = ${concept} AND q.accounting_status::text = 'PENDIENTE' AND q.year <= ${currentYear}), ARRAY[]::int[]) AS pending_years,
          MIN(q.year) FILTER (WHERE q.concept::text = ${concept} AND q.accounting_status::text = 'PENDIENTE' AND q.year > ${currentYear})::int AS next_payment_year,
          MAX(q.last_seen_at) AS last_quota_seen
        FROM associate_quotas q
        WHERE q.is_present_in_last_successful_sync = true ${yearCondition}
        GROUP BY q.person_id
      ),
      cat AS (
        SELECT DISTINCT ON (person_id) person_id, source_type
        FROM sie_associate_records
        WHERE provider = 'SIE' AND person_id IS NOT NULL
        ORDER BY person_id, id
      ),
      app AS (
        SELECT DISTINCT ON ("personId") "personId" AS person_id, "affiliateType"::text AS affiliate_type
        FROM membership_applications
        WHERE status = 'COMPLETED' AND "deletedAt" IS NULL AND "personId" IS NOT NULL
        ORDER BY "personId", id DESC
      )
      SELECT p.id AS person_id,
        p.first_name, p.paternal_last_name, p.maternal_last_name,
        p.document_type::text AS document_type, p.document_number,
        u.institutional_code, u.coverage_status, u.error_code,
        cat.source_type AS category_code, mc.name AS category_name,
        COALESCE(mc.mapped_affiliate_type::text, app.affiliate_type, mc.name, 'SIN_CATEGORIA'::text) AS membership_status,
        COALESCE(a.quota_count, 0)::int AS quota_count,
        COALESCE(a.facturado_count, 0)::int AS facturado_count,
        COALESCE(a.pendiente_count, 0)::int AS pendiente_count,
        COALESCE(a.facturado_pen, '0.00'::text) AS facturado_pen,
        COALESCE(a.facturado_usd, '0.00'::text) AS facturado_usd,
        COALESCE(a.pendiente_pen, '0.00'::text) AS pendiente_pen,
        COALESCE(a.pendiente_usd, '0.00'::text) AS pendiente_usd,
        COALESCE(a.pending_years, ARRAY[]::int[]) AS pending_years,
        a.next_payment_year,
        COALESCE(a.last_quota_seen, (SELECT finished_at FROM quota_sync_runs WHERE id = ${latest.id})) AS last_sync
      FROM universe u
      JOIN persons p ON p.id = u.person_id
      LEFT JOIN cat ON cat.person_id = p.id
      LEFT JOIN membership_categories mc ON mc.code = cat.source_type
      LEFT JOIN app ON app.person_id = p.id
      LEFT JOIN agg a ON a.person_id = p.id
      WHERE ${whereSql}`;

    const sortColumn = filters.sort === "institutionalCode"
      ? Prisma.raw("u.institutional_code")
      : filters.sort === "pendingPen"
        ? Prisma.raw("COALESCE(a.pendiente_pen::numeric, 0)")
        : filters.sort === "pendingUsd"
          ? Prisma.raw("COALESCE(a.pendiente_usd::numeric, 0)")
          : filters.sort === "pendingCount"
            ? Prisma.raw("COALESCE(a.pendiente_count, 0)")
            : filters.sort === "lastSync"
              ? Prisma.raw("COALESCE(a.last_quota_seen, (SELECT finished_at FROM quota_sync_runs WHERE id = " + latest.id + "))")
              : Prisma.raw("p.paternal_last_name");
    const direction = filters.direction === "desc" ? Prisma.raw("DESC") : Prisma.raw("ASC");

    const rows = await this.db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`${base} ORDER BY ${sortColumn} ${direction}, p.id ASC LIMIT ${filters.pageSize} OFFSET ${offset}`);
    const countRows = await this.db.$queryRaw<Array<{ total: number }>>(Prisma.sql`SELECT COUNT(*)::int AS total FROM (${base}) t`);
    const total = countRows[0]?.total ?? 0;

    return {
      data: rows.map((row) => {
        const quotaCount = Number(row.quota_count ?? 0);
        const coverageStatus = String(row.coverage_status ?? "FAILED") as QuotaAssociateRow["coverageStatus"];
        const errorCode = row.error_code == null ? null : String(row.error_code);
        const financialStatus: QuotaAssociateRow["financialStatus"] = quotaCount > 0
          ? "WITH_INFO"
          : coverageStatus === "FAILED"
            ? "FAILED"
            : coverageStatus === "NOT_FOUND"
              ? "NOT_FOUND"
              : errorCode
                ? "WITH_INCIDENCES"
                : "NO_INFO";
        return {
          personId: Number(row.person_id),
          institutionalCode: row.institutional_code == null ? null : String(row.institutional_code),
          fullName: [row.first_name, row.paternal_last_name, row.maternal_last_name].filter(Boolean).join(" "),
          documentType: String(row.document_type),
          documentNumber: row.document_number == null ? null : String(row.document_number),
          categoryCode: row.category_code == null ? null : String(row.category_code),
          categoryName: row.category_name == null ? null : String(row.category_name),
          membershipStatus: row.membership_status == null ? null : String(row.membership_status),
          coverageStatus,
          financialStatus,
          errorCode,
          quotaCount,
          facturadoCount: Number(row.facturado_count ?? 0),
          pendienteCount: Number(row.pendiente_count ?? 0),
          facturadoPen: String(row.facturado_pen ?? "0.00"),
          facturadoUsd: String(row.facturado_usd ?? "0.00"),
          pendientePen: String(row.pendiente_pen ?? "0.00"),
          pendienteUsd: String(row.pendiente_usd ?? "0.00"),
          pendingYears: Array.isArray(row.pending_years) ? row.pending_years.map(Number) : [],
          nextPaymentYear: row.next_payment_year == null ? null : Number(row.next_payment_year),
          lastSync: row.last_sync ? new Date(String(row.last_sync)) : null,
        };
      }),
      meta: pageMeta(filters.page, filters.pageSize, total),
    };
  }

  async getAssociateDetail(personId: number): Promise<QuotaAssociateDetail | null> {
    const latest = await this.getLatestFullRun();
    const person = await this.db.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        firstName: true,
        paternalLastName: true,
        maternalLastName: true,
        documentType: true,
        documentNumber: true,
        sieAssociateRecords: { where: { provider: "SIE" }, orderBy: { id: "asc" }, take: 1, select: { sourceType: true, externalCode: true } },
        applications: { where: { status: "COMPLETED", deletedAt: null }, orderBy: { id: "desc" }, take: 1, select: { affiliateType: true } },
        quotas: { orderBy: [{ year: "asc" }, { concept: "asc" }, { quotaNumber: "asc" }], select: {
          id: true, personId: true, institutionalCode: true, concept: true, quotaNumber: true, year: true, currency: true, amount: true,
          accountingStatus: true, paidAt: true, periodStart: true, periodEnd: true, receiptSerie: true, receiptNumber: true, provider: true,
          lastSeenAt: true, isPresentInLastSuccessfulSync: true,
        } },
      },
    });
    if (!person) return null;
    const categoryCode = person.sieAssociateRecords[0]?.sourceType ?? null;
    const category = categoryCode ? await this.db.membershipCategory.findUnique({ where: { code: categoryCode }, select: { name: true, mappedAffiliateType: true } }) : null;
    const item = latest ? await this.db.quotaSyncItem.findFirst({ where: { syncRunId: latest.id, personId: person.id } }) : null;
    const groups: QuotaGroupRow[] = [];
    const byCurrency = new Map<string, { concept: "CUOTA" | "INSCRIPCION"; count: number; amount: Prisma.Decimal }>();
    const nextPaymentByCurrency = new Map<string, { year: number; currency: string; amount: string; quotaNumber: number | null }>();
    for (const quota of person.quotas) {
      const key = `${quota.currency}|${quota.concept}`;
      const current = byCurrency.get(key) ?? { concept: quota.concept, count: 0, amount: new Prisma.Decimal(0) };
      current.count += 1;
      current.amount = current.amount.plus(quota.amount);
      byCurrency.set(key, current);
      if (isUpcomingQuota(quota.accountingStatus, quota.year)) {
        const upcoming = nextPaymentByCurrency.get(quota.currency);
        if (!upcoming || quota.year < upcoming.year) {
          nextPaymentByCurrency.set(quota.currency, { year: quota.year, currency: quota.currency, amount: quota.amount.toFixed(2), quotaNumber: quota.quotaNumber });
        }
        continue;
      }
      const group = groups.find((entry) => entry.concept === quota.concept && entry.currency === quota.currency && entry.accountingStatus === quota.accountingStatus);
      if (group) { group.count += 1; group.amount = new Prisma.Decimal(group.amount).plus(quota.amount).toFixed(2); }
      else groups.push({ concept: quota.concept, currency: quota.currency, accountingStatus: quota.accountingStatus, count: 1, amount: quota.amount.toFixed(2) });
    }
    const pendingYears = new Map<"CUOTA" | "INSCRIPCION", Set<number>>();
    for (const quota of person.quotas) {
      if (quota.accountingStatus !== "PENDIENTE" || isUpcomingQuota(quota.accountingStatus, quota.year)) continue;
      const set = pendingYears.get(quota.concept) ?? new Set<number>();
      set.add(quota.year);
      pendingYears.set(quota.concept, set);
    }
    return {
      identity: {
        personId: person.id,
        fullName: [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" "),
        documentType: person.documentType,
        documentNumber: person.documentNumber,
        institutionalCode: person.sieAssociateRecords[0]?.externalCode ?? person.quotas.find((quota) => quota.institutionalCode)?.institutionalCode ?? null,
        categoryCode,
        categoryName: category?.name ?? null,
        membershipStatus: category?.mappedAffiliateType ?? person.applications[0]?.affiliateType ?? category?.name ?? null,
      },
      synchronization: {
        status: item?.status ?? null,
        errorCode: item?.errorCode ?? null,
        attempts: item?.attempts ?? 0,
        lastSync: item?.finishedAt ?? latest?.finishedAt ?? null,
      },
      summary: {
        totalsByCurrency: [...byCurrency.entries()].map(([key, value]) => ({ currency: key.split("|")[0], concept: value.concept, count: value.count, amount: value.amount.toFixed(2) })),
        cuota: buildConceptTotal("CUOTA", groups),
        inscripcion: buildConceptTotal("INSCRIPCION", groups),
        pendingYears: (["CUOTA", "INSCRIPCION"] as const).map((concept) => ({ concept, years: [...(pendingYears.get(concept) ?? [])].sort((a, b) => a - b) })),
        nextPayments: [...nextPaymentByCurrency.values()].sort((a, b) => a.year - b.year || a.currency.localeCompare(b.currency)),
      },
      history: person.quotas.map((quota) => ({
        concept: quota.concept,
        quotaNumber: quota.quotaNumber,
        year: quota.year,
        currency: quota.currency,
        amount: quota.amount.toFixed(2),
        accountingStatus: quota.accountingStatus,
        periodStart: toIsoDate(quota.periodStart),
        periodEnd: toIsoDate(quota.periodEnd),
        paidAt: toIsoDate(quota.paidAt),
        receiptSerie: quota.receiptSerie,
        receiptNumber: quota.receiptNumber,
        provider: quota.provider,
        lastSeenAt: quota.lastSeenAt,
        isPresentInLastSuccessfulSync: quota.isPresentInLastSuccessfulSync,
      })),
      incidences: item && (item.status !== "SUCCEEDED" || item.errorCode)
        ? [{ status: item.status, errorCode: item.errorCode, attempts: item.attempts, startedAt: item.startedAt, finishedAt: item.finishedAt }]
        : [],
    };
  }

  async listHistory(filters: QuotaAdminFilters): Promise<QuotaPaginated<QuotaHistoryRow>> {
    const where: Prisma.AssociateQuotaWhereInput = {};
    if (filters.personId) where.personId = filters.personId;
    if (filters.concept) where.concept = filters.concept;
    if (filters.currency) where.currency = filters.currency;
    if (filters.accountingStatus) where.accountingStatus = filters.accountingStatus;
    if (filters.year != null) where.year = filters.year;
    else if (filters.yearFrom != null || filters.yearTo != null) where.year = { gte: filters.yearFrom ?? 1900, lte: filters.yearTo ?? 2100 };
    if (!filters.includeAbsent) where.isPresentInLastSuccessfulSync = true;
    if (filters.search) {
      const search = filters.search;
      where.OR = [
        { institutionalCode: { contains: search, mode: "insensitive" } },
        { person: { is: { OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { paternalLastName: { contains: search, mode: "insensitive" } },
          { maternalLastName: { contains: search, mode: "insensitive" } },
          { documentNumber: { contains: search, mode: "insensitive" } },
        ] } } },
      ];
    }
    const orderBy: Prisma.AssociateQuotaOrderByWithRelationInput[] = filters.sort === "institutionalCode"
      ? [{ institutionalCode: filters.direction ?? "asc" }, { year: "desc" }]
      : filters.sort === "lastSync"
        ? [{ lastSeenAt: filters.direction ?? "desc" }]
        : filters.sort === "name"
          ? [{ person: { paternalLastName: filters.direction ?? "asc" } }, { year: "desc" }]
          : [{ year: "desc" }, { concept: "asc" }, { quotaNumber: "asc" }];
    const [total, records] = await Promise.all([
      this.db.associateQuota.count({ where }),
      this.db.associateQuota.findMany({
        where,
        orderBy,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        include: { person: { select: { id: true, firstName: true, paternalLastName: true, maternalLastName: true, documentType: true, documentNumber: true } } },
      }),
    ]);
    const personIds = records.map((record) => record.personId).filter((id): id is number => id != null);
    const categoryByPerson = new Map<number, string>();
    if (personIds.length) {
      const sieRecords = await this.db.sieAssociateRecord.findMany({
        where: { provider: "SIE", personId: { in: personIds } },
        orderBy: [{ personId: "asc" }, { id: "asc" }],
        select: { personId: true, sourceType: true },
      });
      for (const record of sieRecords) if (record.personId != null && !categoryByPerson.has(record.personId)) categoryByPerson.set(record.personId, record.sourceType);
    }
    const codes = [...new Set(categoryByPerson.values())];
    const categories = codes.length ? await this.db.membershipCategory.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } }) : [];
    const categoryName = new Map(categories.map((category) => [category.code, category.name]));
    return {
      data: records.map((record) => {
        const code = record.personId != null ? categoryByPerson.get(record.personId) ?? null : null;
        return {
          id: record.id,
          personId: record.personId,
          institutionalCode: record.institutionalCode,
          personName: record.person ? [record.person.firstName, record.person.paternalLastName, record.person.maternalLastName].filter(Boolean).join(" ") : null,
          documentType: record.person?.documentType ?? null,
          documentNumber: record.person?.documentNumber ?? null,
          categoryCode: code,
          categoryName: code ? categoryName.get(code) ?? null : null,
          concept: record.concept,
          quotaNumber: record.quotaNumber,
          year: record.year,
          currency: record.currency,
          amount: record.amount.toFixed(2),
          accountingStatus: record.accountingStatus,
          paidAt: toIsoDate(record.paidAt),
          periodStart: toIsoDate(record.periodStart),
          periodEnd: toIsoDate(record.periodEnd),
          receiptSerie: record.receiptSerie,
          receiptNumber: record.receiptNumber,
          provider: record.provider,
          lastSeenAt: record.lastSeenAt,
          isPresentInLastSuccessfulSync: record.isPresentInLastSuccessfulSync,
        };
      }),
      meta: pageMeta(filters.page, filters.pageSize, total),
    };
  }

  async listIncidences(filters: QuotaAdminFilters & { includeResolved?: boolean }): Promise<QuotaPaginated<QuotaIncidenceRow>> {
    const latest = await this.getLatestFullRun();
    if (!latest) return { data: [], meta: { ...EMPTY_META, page: filters.page, pageSize: filters.pageSize } };
    const where: Prisma.QuotaSyncItemWhereInput = {
      syncRunId: latest.id,
      ...(filters.errorCode ? { errorCode: { contains: filters.errorCode, mode: "insensitive" } } : {}),
    };
    if (filters.resolvedOnly) {
      where.status = "SUCCEEDED";
      where.attempts = { gt: 1 };
    } else if (filters.incidenceStatus) where.status = filters.incidenceStatus;
    else if (filters.financialStatus === "NOT_FOUND") where.status = "NOT_FOUND";
    else if (filters.financialStatus === "NO_INFO") where.status = "NO_DATA";
    else if (filters.includeResolved) where.OR = [{ status: { in: ["FAILED", "NOT_FOUND", "NO_DATA"] } }, { status: "SUCCEEDED", attempts: { gt: 1 } }];
    else where.status = { in: ["FAILED", "NOT_FOUND", "NO_DATA"] };
    const [total, items] = await Promise.all([
      this.db.quotaSyncItem.count({ where }),
      this.db.quotaSyncItem.findMany({ where, orderBy: [{ status: "desc" }, { id: "asc" }], skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
    ]);
    const codes = items.map((item) => item.institutionalCode).filter((code): code is string => Boolean(code));
    const sieRecords = codes.length ? await this.db.sieAssociateRecord.findMany({ where: { provider: "SIE", externalCode: { in: codes } }, select: { externalCode: true, sourceType: true } }) : [];
    const categoryByCode = new Map(sieRecords.map((record) => [record.externalCode, record.sourceType]));
    return {
      data: items.map((item) => ({
        itemId: item.id,
        personId: item.personId,
        institutionalCode: item.institutionalCode,
        status: item.status,
        errorCode: item.errorCode,
        attempts: item.attempts,
        categoryCode: item.institutionalCode ? categoryByCode.get(item.institutionalCode) ?? null : null,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        resolved: item.status === "SUCCEEDED",
      })),
      meta: pageMeta(filters.page, filters.pageSize, total),
    };
  }

  async listSyncRuns(page: number, pageSize: number): Promise<QuotaPaginated<QuotaSyncRunRow>> {
    const [total, runs] = await Promise.all([
      this.db.quotaSyncRun.count(),
      this.db.quotaSyncRun.findMany({ orderBy: { startedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { data: runs.map(toRunRow), meta: pageMeta(page, pageSize, total) };
  }

  async getSyncRun(runId: number): Promise<QuotaSyncRunRow | null> {
    const run = await this.db.quotaSyncRun.findUnique({ where: { id: runId } });
    return run ? toRunRow(run) : null;
  }

  async listSyncRunItems(runId: number, page: number, pageSize: number): Promise<QuotaPaginated<QuotaIncidenceRow>> {
    const [total, items] = await Promise.all([
      this.db.quotaSyncItem.count({ where: { syncRunId: runId } }),
      this.db.quotaSyncItem.findMany({ where: { syncRunId: runId }, orderBy: { id: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return {
      data: items.map((item) => ({
        itemId: item.id,
        personId: item.personId,
        institutionalCode: item.institutionalCode,
        status: item.status,
        errorCode: item.errorCode,
        attempts: item.attempts,
        categoryCode: null,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        resolved: item.status === "SUCCEEDED",
      })),
      meta: pageMeta(page, pageSize, total),
    };
  }
}




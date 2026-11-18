import { prisma } from "@/lib/prisma/client";
import { notFound } from "@/server/errors";
import { audit, authorize, failIf, loadVendor, num, pageParams, requireId, type Db, type MaybeActor } from "./common";
import { EVAL_CRITERIA, clean, parseDate, performanceBand, validateEvaluationPayload, type Input } from "./fields";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Recompute the denormalised performance columns on Vendor from its evaluations. */
export async function recomputeVendorPerformance(db: Db, vendorId: string) {
  const agg = await db.vendorEvaluation.aggregate({ where: { vendorId }, _avg: { overallScore: true }, _count: { _all: true }, _max: { evaluationDate: true } });
  const count = agg._count._all;
  const avg = num(agg._avg.overallScore);
  const data = { evaluationCount: count, performanceScore: count && avg != null ? round2(avg) : null, lastEvaluatedAt: count ? agg._max.evaluationDate : null };
  await db.vendor.update({ where: { id: vendorId }, data });
  return { evaluationCount: data.evaluationCount, overallScore: data.performanceScore, lastEvaluatedAt: data.lastEvaluatedAt, band: performanceBand(data.performanceScore) };
}

const present = <T extends { overallScore: { toString(): string } }>(e: T): Omit<T, "overallScore"> & { overallScore: number } => ({ ...e, overallScore: num(e.overallScore) as number });

export async function listEvaluations(actor: MaybeActor, vendorId: string, query: { page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.view");
  const v = await loadVendor(vendorId);
  const { page, limit, skip } = pageParams(query, 50);
  const [rows, total, vendor] = await Promise.all([
    prisma.vendorEvaluation.findMany({ where: { vendorId: v.id }, orderBy: { evaluationDate: "desc" }, skip, take: limit }),
    prisma.vendorEvaluation.count({ where: { vendorId: v.id } }),
    prisma.vendor.findUniqueOrThrow({ where: { id: v.id }, select: { performanceScore: true, evaluationCount: true, lastEvaluatedAt: true } }),
  ]);
  // Per-criterion averages (the MERN performance block).
  const crit = await prisma.vendorEvaluation.aggregate({ where: { vendorId: v.id }, _avg: { quality: true, delivery: true, leadTime: true, pricing: true, responsiveness: true, compliance: true } });
  const criteria = Object.fromEntries(EVAL_CRITERIA.map((c) => [c, crit._avg[c] == null ? null : round2(crit._avg[c] as number)]));
  const score = num(vendor.performanceScore);
  return {
    evaluations: rows.map(present), total, page, pages: Math.max(1, Math.ceil(total / limit)),
    performance: { overallScore: score, evaluationCount: vendor.evaluationCount, lastEvaluatedAt: vendor.lastEvaluatedAt, band: performanceBand(score), criteria },
  };
}

export async function addEvaluation(actor: MaybeActor, vendorId: string, input: Input) {
  const a = authorize(actor, "vendor.performance");
  const v = await loadVendor(vendorId);
  failIf(validateEvaluationPayload(input));
  const s = Object.fromEntries(EVAL_CRITERIA.map((k) => [k, Number(input[k])])) as Record<(typeof EVAL_CRITERIA)[number], number>;
  const overall = round2(EVAL_CRITERIA.reduce((sum, k) => sum + s[k], 0) / EVAL_CRITERIA.length);
  return prisma.$transaction(async (tx) => {
    const e = await tx.vendorEvaluation.create({
      data: { ...s, overallScore: overall, vendorId: v.id, comments: String(input.comments ?? "").trim(), periodLabel: clean(input.periodLabel)?.slice(0, 60) ?? "", evaluationDate: parseDate(input.evaluationDate) ?? new Date(), evaluatedById: a.id, evaluatedByName: a.name },
    });
    const performance = await recomputeVendorPerformance(tx, v.id);
    await audit(tx, a, "vendor.evaluation_recorded", v, { overallScore: overall });
    return { evaluation: present(e), performance };
  });
}

export async function deleteEvaluation(actor: MaybeActor, vendorId: string, evaluationId: string) {
  const a = authorize(actor, "vendor.performance");
  const v = await loadVendor(vendorId);
  const e = await prisma.vendorEvaluation.findUnique({ where: { id: requireId(evaluationId, "evaluation") } });
  if (!e || e.vendorId !== v.id) throw notFound("Evaluation not found for this vendor");
  return prisma.$transaction(async (tx) => {
    await tx.vendorEvaluation.delete({ where: { id: e.id } });
    const performance = await recomputeVendorPerformance(tx, v.id);
    await audit(tx, a, "vendor.evaluation_deleted", v, { evaluationId: e.id });
    return { performance };
  });
}

/** Leaderboard across all (non-archived) vendors. Requires vendor.performance (admin). */
export async function leaderboard(actor: MaybeActor, query: { page?: unknown; limit?: unknown } = {}) {
  authorize(actor, "vendor.performance");
  const { page, limit, skip } = pageParams(query, 50);
  const where = { archivedAt: null, performanceScore: { not: null } };
  const [rows, total, unevaluated] = await Promise.all([
    prisma.vendor.findMany({
      where, orderBy: [{ performanceScore: "desc" }, { name: "asc" }], skip, take: limit,
      select: { id: true, vendorCode: true, name: true, status: true, performanceScore: true, evaluationCount: true, lastEvaluatedAt: true, category: { select: { name: true } } },
    }),
    prisma.vendor.count({ where }),
    prisma.vendor.count({ where: { archivedAt: null, performanceScore: null } }),
  ]);
  const vendors = rows.map(({ performanceScore, ...r }) => ({ ...r, performanceScore: num(performanceScore), performanceBand: performanceBand(num(performanceScore)) }));
  return { vendors, total, unevaluated, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

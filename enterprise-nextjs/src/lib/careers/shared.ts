import "server-only";
import type { ApplicationStatus, CareerApplication, CareerJob, JobStatus } from "@/generated/prisma/client";

// The original API (and the migrated CareersAdmin/Careers pages) use the Mongo
// labels; Postgres stores enums. Translate in both directions.
export const jobStatusLabels: Record<JobStatus, string> = { ACTIVE: "Active", CLOSED: "Closed", DRAFT: "Draft" };
export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  SHORTLISTED: "Shortlisted",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  HIRED: "Hired",
};

const invert = <K extends string>(map: Record<K, string>) => Object.fromEntries(Object.entries(map).map(([key, label]) => [label, key])) as Record<string, K>;
export const jobStatusFromLabel = invert(jobStatusLabels);
export const applicationStatusFromLabel = invert(applicationStatusLabels);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

export const text = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export const pageOptions = (url: URL) => ({
  page: Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1)),
  limit: Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 20)),
});

// Response shape of the original CareerJob documents.
export function legacyJob(job: CareerJob) {
  const rest: Partial<CareerJob> = { ...job };
  delete rest.id;
  delete rest.legacyId;
  return { _id: job.id, ...rest, status: jobStatusLabels[job.status] };
}

// Response shape of the original CareerApplication documents (resume and
// submission key are never returned, as in the original `.select('-resume -submissionKey')`).
export function legacyApplication(application: CareerApplication) {
  const rest: Partial<CareerApplication> = { ...application };
  delete rest.id;
  delete rest.legacyId;
  delete rest.resumePath;
  delete rest.submissionKey;
  return { _id: application.id, ...rest, status: applicationStatusLabels[application.status] };
}

export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

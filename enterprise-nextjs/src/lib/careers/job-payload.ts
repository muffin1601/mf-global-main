import "server-only";
import { z } from "zod";
import type { CareerJob, JobStatus } from "@/generated/prisma/client";
import { jobStatusFromLabel, jobStatusLabels } from "./shared";

// Fields the original API accepted (jobFields in careersRoutes.js).
const jobFields = ["title", "department", "location", "employmentType", "workMode", "experience", "salaryRange", "vacancies", "displayOrder", "description", "responsibilities", "qualifications", "skills", "benefits", "opensAt", "deadline", "status", "isPublished"] as const;

const required = (max: number) => z.string().trim().min(1, "is required").max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const date = z.preprocess((value) => (value === "" || value === undefined ? null : value), z.coerce.date().nullable());

// Same constraints as the original Mongoose CareerJob schema.
const jobSchema = z.object({
  title: required(160),
  department: required(100),
  location: required(120),
  employmentType: z.enum(["Full-time", "Part-time", "Contract", "Internship"]),
  workMode: z.enum(["On-site", "Remote", "Hybrid"]),
  experience: required(100),
  salaryRange: optional(100),
  vacancies: z.coerce.number().int().min(1).max(10000),
  displayOrder: z.coerce.number().int().min(1).max(10000).default(1000),
  description: required(20000),
  responsibilities: required(10000),
  qualifications: required(10000),
  skills: required(10000),
  benefits: optional(10000),
  opensAt: date.optional(),
  deadline: date.refine((value) => value !== null, "is required"),
  status: z.enum(["Active", "Closed", "Draft"]).default("Draft"),
  isPublished: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
});

// Date-only inputs from the admin form are interpreted in IST, as in the original.
const normaliseDates = (body: Record<string, unknown>) => {
  const out = { ...body };
  if (typeof out.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.deadline)) out.deadline = `${out.deadline}T23:59:59.999+05:30`;
  if (typeof out.opensAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.opensAt)) out.opensAt = `${out.opensAt}T00:00:00+05:30`;
  return out;
};

export const pickJobFields = (body: unknown) => {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return normaliseDates(Object.fromEntries(jobFields.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]])));
};

export const existingJobInput = (job: CareerJob) => ({ ...job, status: jobStatusLabels[job.status] });

export type JobData = Omit<z.infer<typeof jobSchema>, "status" | "opensAt" | "deadline"> & { status: JobStatus; opensAt: Date | null; deadline: Date };

export function validateJob(input: Record<string, unknown>): { ok: true; data: JobData } | { ok: false; message: string } {
  const parsed = jobSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ");
    return { ok: false, message: `CareerJob validation failed: ${message}` };
  }
  const { status, opensAt, deadline, ...rest } = parsed.data;
  return { ok: true, data: { ...rest, status: jobStatusFromLabel[status] as JobStatus, opensAt: opensAt ?? null, deadline: deadline as Date } };
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { withCareerAdmin } from "@/lib/careers/admin-session";
import { applicationFilter } from "@/lib/careers/application-filter";
import { applicationStatusLabels } from "@/lib/careers/shared";

export const dynamic = "force-dynamic";

// Same columns, order, BOM and formula-injection guard as the original json2csv export.
const fields = ["applicationId", "jobId", "jobTitle", "department", "fullName", "email", "phone", "location", "jobDesignation", "qualification", "stream", "experience", "keyResponsibilities", "currentCompany", "designation", "expectedSalary", "noticePeriod", "coverLetter", "comments", "consent", "status", "adminNotes", "createdAt", "updatedAt"] as const;

const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
const guard = (value: string) => (/^[=+@\-\t\r]/.test(value) ? `'${value}` : value);
const cell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return quote(value.toISOString());
  if (typeof value === "string") return quote(guard(value));
  return String(value);
};

export async function GET(request: Request) {
  return withCareerAdmin(request, async () => {
    const items = await prisma.careerApplication.findMany({ where: applicationFilter(new URL(request.url)), orderBy: { createdAt: "desc" } });
    const rows = items.map((item) => {
      const record: Record<(typeof fields)[number], unknown> = {
        applicationId: item.id, jobId: item.jobId, jobTitle: item.jobTitle, department: item.department,
        fullName: item.fullName, email: item.email, phone: item.phone, location: item.location, jobDesignation: item.jobDesignation,
        qualification: item.qualification, stream: item.stream, experience: item.experience, keyResponsibilities: item.keyResponsibilities,
        currentCompany: item.currentCompany, designation: item.designation, expectedSalary: item.expectedSalary, noticePeriod: item.noticePeriod,
        coverLetter: item.coverLetter, comments: item.comments, consent: item.consent, status: applicationStatusLabels[item.status],
        adminNotes: item.adminNotes, createdAt: item.createdAt, updatedAt: item.updatedAt,
      };
      return fields.map((field) => cell(record[field])).join(",");
    });
    const csv = `﻿${[fields.map(quote).join(","), ...rows].join("\n")}`;
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="career-applications.csv"' } });
  });
}

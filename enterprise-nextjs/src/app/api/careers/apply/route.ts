import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyCareerApplication } from "@/lib/careers/notify";
import { publicJobFilter } from "@/lib/careers/public-jobs";
import { isUuid, text } from "@/lib/careers/shared";

// Port of POST /careers/apply from backend/routes/main/careersRoutes.js. Field
// limits, allowed values, file checks and every user-visible message match the
// original. Resumes are stored in the private Supabase bucket `career-resumes`
// (the original stored them inside the Mongo document).
const stringFields = ["fullName", "email", "phone", "location", "jobDesignation", "qualification", "stream", "experience", "keyResponsibilities", "currentCompany", "designation", "expectedSalary", "noticePeriod", "coverLetter", "comments"] as const;
const limits: Record<(typeof stringFields)[number], number> = { fullName: 120, email: 254, phone: 30, location: 120, jobDesignation: 80, qualification: 30, stream: 160, experience: 80, keyResponsibilities: 2000, currentCompany: 120, designation: 120, expectedSalary: 100, noticePeriod: 100, coverLetter: 3000, comments: 3000 };
const jobDesignations = new Set(["Telemarketing", "Telesales", "Digital Marketing Sr. Executive", "Account Executive", "Content Writer", "Graphics Designing", "E-Commerce Sales Executive", "Sales Executive", "Sales Sr Executive", "Sales Manager", "Sales Support Coordinator"]);
const qualifications = new Set(["Diploma", "12th", "Graduate", "Post Graduate"]);
const mimeTypes: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

const startsWith = (buffer: Buffer, bytes: number[]) => buffer.subarray(0, bytes.length).equals(Buffer.from(bytes));
const signatureValid = (buffer: Buffer, ext: string) =>
  ext === "pdf" ? buffer.subarray(0, 5).toString() === "%PDF-"
    : ext === "doc" ? startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
      : startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && buffer.includes(Buffer.from("[Content_Types].xml")) && buffer.includes(Buffer.from("word/document.xml"));

const bad = (message: string, status = 400) => NextResponse.json({ message }, { status });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad("Invalid resume upload.");
  }
  const raw = (key: string) => form.get(key);
  if (stringFields.some((key) => { const value = raw(key); return typeof value === "string" && value.length > limits[key]; })) return bad("Application field is too long.");
  const data = Object.fromEntries(stringFields.map((key) => [key, text(raw(key), limits[key])])) as Record<(typeof stringFields)[number], string>;
  const jobId = raw("jobId");
  const submissionKey = raw("submissionKey");
  const digits = data.phone.replace(/\D/g, "").length;
  if (!isUuid(jobId) || !data.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || digits < 10 || digits > 15 || !data.location || !jobDesignations.has(data.jobDesignation) || !qualifications.has(data.qualification) || !data.experience || !data.noticePeriod || raw("consent") !== "true") {
    return bad("Please complete all required application fields.");
  }
  if (typeof submissionKey !== "string" || !/^[a-f0-9-]{20,80}$/i.test(submissionKey)) return bad("Invalid submission key.");

  const resume = raw("resume");
  if (resume instanceof File && resume.size > 5 * 1024 * 1024) return bad("Invalid resume upload.", 413);
  const ext = resume instanceof File ? (resume.name.split(".").pop() ?? "").toLowerCase() : "";
  const buffer = resume instanceof File ? Buffer.from(await resume.arrayBuffer()) : null;
  if (!(resume instanceof File) || !buffer || !mimeTypes[ext] || ![mimeTypes[ext], "application/octet-stream"].includes(resume.type) || !signatureValid(buffer, ext)) {
    return bad("Upload a valid PDF, DOC, or DOCX resume.");
  }

  const job = await prisma.careerJob.findFirst({ where: { id: jobId, ...publicJobFilter() }, select: { id: true, title: true, department: true, opensAt: true } });
  if (!job) return bad("This job is no longer accepting applications.", 409);
  if (job.opensAt && job.opensAt > new Date()) return bad("Applications for this job have not opened yet.", 409);

  const existing = await prisma.careerApplication.findUnique({ where: { submissionKey }, select: { id: true } });
  if (existing) return NextResponse.json({ success: true, applicationId: existing.id, message: "Application already received." });

  const storagePath = `${job.id}/${randomUUID()}.${ext}`;
  const supabase = createSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage.from("career-resumes").upload(storagePath, buffer, { contentType: mimeTypes[ext], upsert: false });
  if (uploadError) {
    console.error("careers: resume upload failed", { errorName: uploadError.name });
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }

  try {
    const application = await prisma.careerApplication.create({
      data: { ...data, jobId: job.id, jobTitle: job.title, department: job.department, consent: true, submissionKey, resumePath: storagePath, resumeFileName: `resume.${ext}` },
    });
    try {
      await notifyCareerApplication(application);
    } catch (error) {
      console.error("Careers email notification failed:", error instanceof Error ? error.message : String(error));
    }
    return NextResponse.json({ success: true, applicationId: application.id, message: "Your application has been submitted." }, { status: 201 });
  } catch (error) {
    await supabase.storage.from("career-resumes").remove([storagePath]);
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return bad("Application already received.", 409);
    throw error;
  }
}

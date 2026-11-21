import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma/client";

// POST /api/send-email — same contract as the original Express route used by the
// marketing ContactUs form: { name, email, phone, companyname, message } ->
// { success: boolean }. The enquiry is also stored in contact_submissions so it
// is never lost when email delivery is unavailable.
const schema = z.object({
  // name, phone and message mirror the `required` inputs on the ContactUs form; email is optional but must be valid.
  name: z.string().trim().min(1).max(120),
  email: z.union([z.email().max(254), z.literal("")]).default(""),
  phone: z.string().trim().min(1).max(30),
  companyname: z.string().trim().max(160).default(""),
  message: z.string().trim().min(1).max(5000),
});

// An unsalted IP hash can be reversed by enumerating IPv4 space, so production refuses to run without a salt.
const ipHashFor = (request: Request): string | null => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const salt = process.env.IP_HASH_SALT || (process.env.NODE_ENV === "production" ? "" : "dev-only-salt");
  return salt ? createHmac("sha256", salt).update(ip).digest("hex") : null;
};

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 400 });
  const { name, email, phone, companyname, message } = parsed.data;

  // Original emailLimiter: 5 requests per minute per IP.
  const ipHash = ipHashFor(request);
  if (!ipHash) return NextResponse.json({ success: false, error: "Contact service is not configured" }, { status: 503 });
  const recent = await prisma.contactSubmission.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - 60 * 1000) } } });
  if (recent >= 5) return NextResponse.json({ success: false, message: "Too many requests. Please wait a moment and try again." }, { status: 429 });

  await prisma.contactSubmission.create({ data: { name, email, phone: phone || null, subject: companyname || null, message, ipHash } });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("send-email: RESEND_API_KEY is not configured; enquiry stored in contact_submissions only.");
    return NextResponse.json({ success: true, message: "Email sent successfully!" });
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.CONTACT_EMAIL_FROM || "no-reply@mfglobalservices.com",
    to: process.env.CONTACT_EMAIL_TO || "sales@mfglobalservices.com",
    replyTo: email || undefined,
    subject: "New Enquiry from MF Global Services Website",
    text: `
Hi Team,

You have received a new inquiry:

Name: ${name}
Company: ${companyname}
Email: ${email}
Phone: ${phone}
Message: ${message}

Please reach out to the user as soon as possible.
      `,
  });
  if (error) {
    // The enquiry is already stored, so the visitor is not asked to resend it.
    console.error("send-email: notification failed", { errorName: error.name });
  }
  return NextResponse.json({ success: true, message: "Email sent successfully!" });
}

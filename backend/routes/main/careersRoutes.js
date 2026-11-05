const express = require("express");
const multer = require("multer");
const { Resend } = require("resend");
const { emailLimiter } = require("../../middleware/rateLimiters");

const router = express.Router();
const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const allowedPositions = new Set([
  "Telemarketing Executive",
  "E-commerce Executive",
  "E-commerce Sales Executive",
]);
const allowedExtensions = new Set(["pdf", "doc", "docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_SIZE,
    files: 1,
    fields: 7,
    fieldNameSize: 100,
    fieldSize: 3000,
  },
});

const parseApplication = (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge
          ? "Your resume must be 5 MB or smaller."
          : "The application form contains an invalid upload.",
      });
    }
    if (error) return next(error);
    next();
  });
};

const hasValidSignature = (file, extension) => {
  if (extension === "pdf") return file.buffer.subarray(0, 5).toString() === "%PDF-";
  if (extension === "doc") {
    return file.buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  return file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    && file.buffer.includes(Buffer.from("[Content_Types].xml"))
    && file.buffer.includes(Buffer.from("word/document.xml"));
};

router.post("/careers/apply", emailLimiter, parseApplication, async (req, res) => {
  const opensAt = new Date("2026-11-10T00:00:00+05:30");
  const closesAt = new Date("2026-11-30T23:59:59.999+05:30");
  const now = new Date();
  if (now < opensAt || now > closesAt) {
    return res.status(403).json({
      success: false,
      message: now < opensAt
        ? "Applications open on 10 November 2026."
        : "The application period ended on 30 November 2026.",
    });
  }

  const fields = ["fullName", "email", "mobile", "position", "location", "experience", "coverLetter"];
  const values = Object.fromEntries(fields.map((field) => [
    field,
    typeof req.body?.[field] === "string" ? req.body[field].trim() : "",
  ]));
  const { fullName, email, mobile, position, location, experience, coverLetter } = values;
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const mobileDigits = mobile.replace(/\D/g, "");

  if (
    !fullName || fullName.length > 120 ||
    !emailIsValid || email.length > 254 ||
    mobileDigits.length < 10 || mobileDigits.length > 15 ||
    !allowedPositions.has(position) ||
    !location || location.length > 120 ||
    !experience || experience.length > 80 ||
    coverLetter.length > 3000
  ) {
    return res.status(400).json({ success: false, message: "Please check the application details and try again." });
  }

  const resume = req.file;
  if (!resume) {
    return res.status(400).json({ success: false, message: "Please attach your resume." });
  }
  const extension = resume.originalname.split(".").pop()?.toLowerCase();
  if (
    !allowedExtensions.has(extension) ||
    !allowedMimeTypes.has(resume.mimetype) ||
    !hasValidSignature(resume, extension)
  ) {
    return res.status(400).json({
      success: false,
      message: "Upload a valid PDF, DOC, or DOCX resume.",
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({
      success: false,
      message: "The application email service is not configured. Please try again later.",
    });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: "no-reply@mfglobalservices.com",
      to: "sales@mfglobalservices.com",
      reply_to: email,
      subject: `Job application: ${position}`,
      text: [
        "A new careers application was submitted.",
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Mobile: ${mobile}`,
        `Position: ${position}`,
        `Location: ${location}`,
        `Experience: ${experience}`,
        `Cover letter / additional information: ${coverLetter || "Not provided"}`,
      ].join("\n"),
      attachments: [{
        filename: `resume.${extension}`,
        content: resume.buffer.toString("base64"),
      }],
    });
    if (result.error) {
      console.error("Error sending careers application:", result.error);
      return res.status(502).json({ success: false, message: "We couldn’t submit your application. Please try again later." });
    }
    return res.status(200).json({
      success: true,
      message: "Your application has been submitted. Thank you for your interest.",
    });
  } catch (error) {
    console.error("Error sending careers application:", error);
    return res.status(502).json({ success: false, message: "We couldn’t submit your application. Please try again later." });
  }
});

module.exports = router;

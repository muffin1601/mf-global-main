const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { Resend } = require("resend");

const originalApiKey = process.env.RESEND_API_KEY;
process.env.RESEND_API_KEY = "re_careers_test";

const resendEmailPrototype = Object.getPrototypeOf(new Resend("re_careers_test").emails);
const originalSend = resendEmailPrototype.send;
let sentEmail;
resendEmailPrototype.send = async (email) => {
  sentEmail = email;
  return { data: { id: "test-email-id" }, error: null };
};

const app = express();
app.use("/api", require("../routes/main/careersRoutes"));

const withApplicationWindowOpen = async (run) => {
  const RealDate = global.Date;
  const applicationDate = new RealDate("2026-11-15T12:00:00+05:30");
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [applicationDate]));
    }

    static now() {
      return applicationDate.getTime();
    }
  };
  try {
    await run();
  } finally {
    global.Date = RealDate;
  }
};

test("emails a valid careers application with its resume attached", async () => {
  await withApplicationWindowOpen(async () => {
    sentEmail = null;
    const response = await request(app)
      .post("/api/careers/apply")
      .field("fullName", "Asha Applicant")
      .field("email", "asha@example.com")
      .field("mobile", "+91 98765 43210")
      .field("position", "Telemarketing Executive")
      .field("location", "New Delhi")
      .field("experience", "2 years")
      .field("coverLetter", "I am interested in the position.")
      .attach("resume", Buffer.from("%PDF-1.7\nresume"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(sentEmail.to, "sales@mfglobalservices.com");
    assert.equal(sentEmail.reply_to, "asha@example.com");
    assert.equal(sentEmail.attachments[0].filename, "resume.pdf");
    assert.equal(Buffer.from(sentEmail.attachments[0].content, "base64").toString(), "%PDF-1.7\nresume");
  });
});

test("rejects a resume whose contents do not match its file type", async () => {
  await withApplicationWindowOpen(async () => {
    sentEmail = null;
    const response = await request(app)
      .post("/api/careers/apply")
      .field("fullName", "Asha Applicant")
      .field("email", "asha@example.com")
      .field("mobile", "9876543210")
      .field("position", "Telemarketing Executive")
      .field("location", "New Delhi")
      .field("experience", "2 years")
      .attach("resume", Buffer.from("not a PDF"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.equal(sentEmail, null);
  });
});

test.after(() => {
  resendEmailPrototype.send = originalSend;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
});

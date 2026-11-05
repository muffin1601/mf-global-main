# Careers application endpoint setup

The careers page submits applications to the CRM API's dedicated email route.
The route emails application details and the attached resume to
`sales@mfglobalservices.com`; it does not store applications in the CRM
database.

## Frontend configuration

Configure `VITE_API_URL` in the frontend build environment to the API base URL
(for example, `https://mfglobalservices.com/api`) and deploy the frontend. The
backend must also be deployed with `RESEND_API_KEY` set and the marketing
frontend origin included in `CORS_ORIGINS`. Never put the Resend key in a
`VITE_` variable.

## Request contract

The browser sends a `POST` request to `/careers/apply` using
`multipart/form-data` with these fields:

| Field | Value |
| --- | --- |
| `fullName` | Applicant's full name |
| `email` | Email address |
| `mobile` | Mobile number |
| `position` | One of the three listed job titles |
| `location` | Current location |
| `experience` | Total experience |
| `resume` | PDF, DOC, or DOCX file (maximum 5 MB) |
| `coverLetter` | Optional cover letter / additional information |

The browser sets the multipart boundary automatically. The backend validates
the application and resume, then emails the application to
`sales@mfglobalservices.com` with the resume attached. It returns JSON with
HTTP 2xx and `{ "success": true }` only after the email service accepts the
message. Failures use a non-2xx response with `{ "success": false, "message":
"..." }`.

## Endpoint security requirements

The backend validates field lengths and values, limits uploads to 5 MB, checks
the resume signature and format, and applies the public email rate limiter.
Client-side checks are for usability, not a security boundary. Keep HTTPS
enabled, allow only the marketing frontend origin in `CORS_ORIGINS`, and
configure the mail provider to deliver attachments securely. Applications are
emailed only; resumes are not stored in the CRM database or public uploads.

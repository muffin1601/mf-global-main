# Careers management setup

The public page is `/careers`; the PIN-protected dashboard is `/careers/admin`. Both use the existing MongoDB connection and `/api` backend.

## Configure the first PIN

For local setup, run `node scripts/setupCareersPin.js` from `backend` in an interactive terminal. Choose and confirm a six-digit PIN when prompted; the script saves only its bcrypt hash to `backend/.env`. Restart the backend before logging in. For a hosted deployment, run `node scripts/hashCareersPin.js <your-six-digit-PIN>` and place the resulting `CAREERS_ADMIN_PIN_HASH=...` value in the backend deployment environment. Do not commit the PIN or hash to source control. Administrators can subsequently change the PIN from the dashboard; the new hash is saved in MongoDB and other sessions are revoked. If that record is removed, the deployment hash becomes the fallback PIN.

The backend also needs its existing `MONGO_URI` and `JWT_SECRET`. Set `CORS_ORIGINS` or `FRONTEND_URL` to the exact frontend origin. The frontend's `VITE_API_URL` should point to the backend `/api` root (for example, `https://api.example.com/api`). If the frontend and API are on different sites, set `CAREERS_COOKIE_SAMESITE=none` and serve both over HTTPS. In production, cookies are `Secure` and HTTP-only.

Application notifications use the backend `RESEND_API_KEY` and send to `sales@mfglobalservices.com` and `faruk@mfglobalservices.com` by default. Set `CAREERS_NOTIFICATION_EMAILS` to a comma-separated list to change recipients, and optionally set `CAREERS_NOTIFICATION_FROM` to a verified sender. Notifications include application details and a dashboard reference; resumes remain in private storage and are not attached to email. A notification failure is logged while the saved application remains available in the admin dashboard.

The three careers positions shown on the original page were added to MongoDB with applications opening 10 November 2026 and closing 30 November 2026. `node scripts/seedCareersOpenings.js` previews the seed, and `node scripts/seedCareersOpenings.js --apply` adds any missing positions without duplicating existing titles. Review the assumed location, work mode, vacancies, experience, qualifications, and skills in the admin dashboard. New jobs can be added and published there. Job form dates use India time; scheduled jobs remain visible before the opening date, but cannot accept applications until then. Uploaded resumes are stored in MongoDB and served only by the authenticated admin resume endpoint.

Review candidate retention with your privacy policy. Administrators can delete applications and their stored resumes from the dashboard. Archived jobs retain their linked application records. Admin actions and failed PIN attempts are written to the server log; retain those logs according to your deployment policy.

For a deployment with multiple backend instances, use a shared store for the HTTP rate limiter. The PIN lockout and sessions already use MongoDB.

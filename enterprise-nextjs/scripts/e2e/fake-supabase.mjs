// Local stand-in for the Supabase Auth (GoTrue) and Storage HTTP APIs, for E2E browser tests ONLY.
// It never talks to a real Supabase project. Users come from E2E_USERS_FILE (written by seed.ts).
// Implements only the endpoints the CRM calls: password sign-in, refresh, getUser, update user,
// logout, recover, admin create/update user, and storage upload/download/remove/sign/public.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { randomUUID, createHmac } from "node:crypto";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const usersFile = process.env.E2E_USERS_FILE;
const users = new Map(); // email -> { id, email, password, user_metadata }
if (usersFile && existsSync(usersFile)) {
  for (const u of JSON.parse(readFileSync(usersFile, "utf8"))) users.set(u.email, { ...u, user_metadata: u.user_metadata ?? {} });
}
const sessions = new Map(); // access_token -> userId
const refreshTokens = new Map(); // refresh_token -> userId
const objects = new Map(); // `${bucket}/${path}` -> { body, contentType }
export const sentRecoveryEmails = [];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: randomUUID() };
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", "fake").update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
const publicUser = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: { provider: "email" }, user_metadata: u.user_metadata, created_at: "2026-01-01T00:00:00Z", updated_at: new Date().toISOString() });
function issue(u) {
  const access_token = jwt(u);
  const refresh_token = randomUUID();
  sessions.set(access_token, u.id);
  refreshTokens.set(refresh_token, u.id);
  return { access_token, refresh_token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: publicUser(u) };
}
const byId = (id) => [...users.values()].find((u) => u.id === id);
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body));
};
const authErr = (res, status, msg, code) => send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });
const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
const readBody = (req) => new Promise((resolve) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); });
const json = (buf) => { try { return JSON.parse(buf.toString("utf8") || "{}"); } catch { return {}; } };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const raw = await readBody(req);
  try {
    // ---------- Auth ----------
    if (p === "/auth/v1/token" && req.method === "POST") {
      const body = json(raw);
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = users.get(String(body.email ?? "").toLowerCase());
        if (!u || u.password !== body.password) return authErr(res, 400, "Invalid login credentials", "invalid_credentials");
        return send(res, 200, issue(u));
      }
      if (grant === "refresh_token") {
        const id = refreshTokens.get(body.refresh_token);
        if (!id) return authErr(res, 400, "Invalid Refresh Token", "refresh_token_not_found");
        refreshTokens.delete(body.refresh_token);
        return send(res, 200, issue(byId(id)));
      }
      return authErr(res, 400, "unsupported grant", "validation_failed");
    }
    if (p === "/auth/v1/user") {
      const id = sessions.get(bearer(req));
      const u = id && byId(id);
      if (!u) return authErr(res, 401, "invalid JWT", "bad_jwt");
      if (req.method === "PUT") {
        const body = json(raw);
        if (body.password) { if (String(body.password).length < 6) return authErr(res, 422, "Password should be at least 6 characters.", "weak_password"); u.password = body.password; }
        if (body.data) u.user_metadata = { ...u.user_metadata, ...body.data };
      }
      return send(res, 200, publicUser(u));
    }
    if (p === "/auth/v1/logout") {
      const token = bearer(req);
      const id = sessions.get(token);
      for (const [t, uid] of sessions) if (uid === id) sessions.delete(t);
      return send(res, 204);
    }
    if (p === "/auth/v1/recover" && req.method === "POST") {
      sentRecoveryEmails.push(json(raw).email); // captured, never sent
      return send(res, 200, {});
    }
    if (p === "/auth/v1/admin/users" && req.method === "POST") {
      const body = json(raw);
      const email = String(body.email).toLowerCase();
      if (users.has(email)) return authErr(res, 422, "A user with this email address has already been registered", "email_exists");
      const u = { id: randomUUID(), email, password: body.password, user_metadata: body.user_metadata ?? {} };
      users.set(email, u);
      return send(res, 200, publicUser(u));
    }
    const adminUser = p.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
    if (adminUser) {
      const u = byId(adminUser[1]);
      if (!u) return authErr(res, 404, "User not found", "user_not_found");
      if (req.method === "PUT") {
        const body = json(raw);
        if (body.password) u.password = body.password;
        if (body.email) { users.delete(u.email); u.email = String(body.email).toLowerCase(); users.set(u.email, u); }
        if (body.user_metadata) u.user_metadata = { ...u.user_metadata, ...body.user_metadata };
      }
      if (req.method === "DELETE") { users.delete(u.email); return send(res, 200, {}); }
      return send(res, 200, publicUser(u));
    }
    if (p === "/__e2e/recovery-emails") return send(res, 200, sentRecoveryEmails);

    // ---------- Storage ----------
    const sign = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (sign && req.method === "POST") {
      const key = `${sign[1]}/${decodeURIComponent(sign[2])}`;
      if (!objects.has(key)) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return send(res, 200, { signedURL: `/object/sign/${sign[1]}/${sign[2]}?token=${randomUUID()}` });
    }
    const getObj = p.match(/^\/storage\/v1\/object\/(?:sign\/|public\/|authenticated\/)?([^/]+)\/(.+)$/);
    if (getObj && req.method === "GET") {
      const o = objects.get(`${getObj[1]}/${decodeURIComponent(getObj[2])}`);
      if (!o) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      res.writeHead(200, { "content-type": o.contentType });
      return res.end(o.body);
    }
    const putObj = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (putObj && (req.method === "POST" || req.method === "PUT")) {
      const key = `${putObj[1]}/${decodeURIComponent(putObj[2])}`;
      if (req.method === "POST" && objects.has(key) && req.headers["x-upsert"] !== "true") return send(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      let body = raw;
      let contentType = req.headers["content-type"] ?? "application/octet-stream";
      if (contentType.startsWith("multipart/form-data")) {
        // supabase-js sends Buffers as raw bodies; multipart is only used for Blob/FormData. Store as-is.
        contentType = "application/octet-stream";
      }
      objects.set(key, { body, contentType });
      return send(res, 200, { Key: key, Id: randomUUID() });
    }
    const delObj = p.match(/^\/storage\/v1\/object\/([^/]+)$/);
    if (delObj && req.method === "DELETE") {
      for (const prefix of json(raw).prefixes ?? []) objects.delete(`${delObj[1]}/${prefix}`);
      return send(res, 200, []);
    }
    return send(res, 404, { message: `fake-supabase: no handler for ${req.method} ${p}` });
  } catch (error) {
    return send(res, 500, { message: String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`fake-supabase listening on ${PORT} with ${users.size} users`));

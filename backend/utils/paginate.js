// P0 performance helpers — shared pagination + cache utilities.
// Pure helpers: no business logic, no auth, no schema changes.

// Parse ?page= & ?limit= with safe bounds (default 50, max 200).
const getPaging = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
};

// Expose pagination metadata via response headers so existing response
// BODY shapes stay unchanged (backward compatible with the current UI).
const setPageHeaders = (res, total, page, limit) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  res.set("X-Total-Count", String(total));
  res.set("X-Page", String(page));
  res.set("X-Pages", String(pages));
  res.set("X-Limit", String(limit));
  res.set("Access-Control-Expose-Headers", "X-Total-Count, X-Page, X-Pages, X-Limit");
  return pages;
};

// Minimal in-process TTL cache (5 min). For multi-instance deploys swap for Redis.
const createTTLCache = (ttlMs = 5 * 60 * 1000) => {
  let store = { data: null, ts: 0 };
  return {
    get() {
      if (store.data && Date.now() - store.ts < ttlMs) return store.data;
      return null;
    },
    set(data) {
      store = { data, ts: Date.now() };
      return data;
    },
    clear() {
      store = { data: null, ts: 0 };
    },
  };
};

module.exports = { getPaging, setPageHeaders, createTTLCache };

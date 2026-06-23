// Shared in-process cache for the dashboard /counts payload.
// Lives in its own module so any route that mutates assignment / status data
// can invalidate it (call countsCache.clear()) without creating a circular
// dependency on the dashboard router.
const { createTTLCache } = require("./paginate");

const countsCache = createTTLCache(5 * 60 * 1000); // global admin data

module.exports = countsCache;

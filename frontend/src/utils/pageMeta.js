// Normalize a paginated lead response into { rows, total, pages }.
// Handles all three backend shapes uniformly:
//   - bare array body (e.g. /overview/new-clients)        -> rows = body
//   - envelope { data, total, pages } (/overview/all-clients)
//   - filter envelope { data, pagination:{total,pages} } (/clients/filter)
// Pagination metadata is also exposed via response headers
// (X-Total-Count / X-Pages), which we prefer when present.
export const extractPage = (res) => {
  const body = res?.data ?? [];
  const rows = Array.isArray(body) ? body : (body.data || []);

  const h = res?.headers || {};
  const headerTotal = h["x-total-count"];
  const headerPages = h["x-pages"];

  const total = Number(
    headerTotal ?? body.total ?? body.pagination?.total ?? rows.length
  );
  const pages = Math.max(
    1,
    Number(headerPages ?? body.pages ?? body.pagination?.pages ?? 1)
  );

  return { rows, total: Number.isFinite(total) ? total : rows.length, pages };
};

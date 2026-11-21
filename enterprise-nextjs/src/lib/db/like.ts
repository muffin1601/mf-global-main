/**
 * Prisma's `contains` / `startsWith` do NOT escape LIKE wildcards on PostgreSQL, so a user typing
 * "%" or "_" would match everything (proven in tests/search.global.test.ts). Wrap every user-supplied
 * term with escapeLike(). PostgreSQL's default LIKE escape character is the backslash.
 */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Escaped `%term%` pattern for raw-SQL ILIKE. */
export const likePattern = (q: string) => `%${escapeLike(q)}%`;

/** Case-insensitive, literal `contains` filter. */
export const literalContains = (q: string) => ({ contains: escapeLike(q), mode: "insensitive" as const });

import "server-only";
import type { Prisma } from "@/generated/prisma/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID.test(value);

// Blog URLs may carry the new UUID, the original MongoDB ObjectId (legacyId) or
// a slug. Only compare against the UUID column when the value is a UUID, since
// Postgres rejects malformed UUID literals.
export function blogLookup(value: string): Prisma.BlogPostWhereInput {
  return { OR: [...(isUuid(value) ? [{ id: value }] : []), { legacyId: value }, { slug: value }] };
}

type LegacyPost = { id: string; legacyId: string | null; title: string; content: string; mediaPath: string | null; author: string; createdAt: Date };

// Response shape of the original Mongo `Blog` documents.
export const legacyBlog = (post: LegacyPost) => ({
  _id: post.legacyId ?? post.id,
  title: post.title,
  content: post.content,
  media: post.mediaPath ?? undefined,
  author: post.author,
  createdAt: post.createdAt,
});

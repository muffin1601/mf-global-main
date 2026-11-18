import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/server/catalog/categories";
import { listProducts } from "@/server/catalog/products";
import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE_SIZES = [10, 20, 50, 100];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const actor = { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
  const limit = PAGE_SIZES.includes(Number(one(sp.limit))) ? Number(one(sp.limit)) : 20;
  const filters = { query: one(sp.query), categoryId: one(sp.category), status: one(sp.status) || "active", sort: one(sp.sort) || "updated_desc", limit };
  const [result, categories] = await Promise.all([
    listProducts(actor, { ...filters, page: Number(one(sp.page)) || 1 }),
    listCategories(actor),
  ]);
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Catalogue</div>
          <h1>Products</h1>
        </div>
      </div>
      <CatalogClient
        isAdmin={user.role === "ADMIN"}
        products={result.products}
        categories={categories}
        total={result.total}
        page={result.page}
        pages={result.pages}
        filters={filters}
      />
    </main>
  );
}

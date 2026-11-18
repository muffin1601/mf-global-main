import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { listCategories } from "@/server/vendors/categories";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "../actions";
import { ModalForm, type Field } from "../_components/modal-form";
import s from "../_components/vendors.module.css";
import { getActor, permsOf } from "../_lib";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor categories" };

export default async function VendorCategoriesPage() {
  const actor = await getActor();
  const perms = permsOf(actor);
  const categories = await listCategories(actor);
  const newFields: Field[] = [{ name: "name", label: "Category name", required: true }, { name: "description", kind: "textarea", label: "Description" }];

  return (
    <main className="page">
      <div className="page-head">
        <div><div className="eyebrow">Supply network</div><h1>Vendor categories</h1></div>
        {perms.categories ? <ModalForm trigger="Add category" title="Add category" fields={newFields} action={createCategoryAction} submitLabel="Create category" /> : null}
      </div>
      <p className={s.muted}>Categories group vendors for filtering and reporting. A category that is in use cannot be removed until its vendors are moved to another category.</p>
      <section className="table-card">
        <div className={s.scroll}>
          <table>
            <thead><tr><th>Name</th><th>Description</th><th>Vendors</th><th>Status</th><th /></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.description || "-"}</td>
                  <td><Link href={`/crm/vendors?category=${c.id}` as Route} className={s.linkBtn}>{c.vendorCount}</Link></td>
                  <td><span className={`badge ${c.isActive ? "" : s.badgeNeutral}`}>{c.isActive ? "Active" : "Inactive"}</span></td>
                  <td>
                    {perms.categories ? (
                      <div className={s.rowActions}>
                        <ModalForm
                          trigger="Edit" triggerClass={s.linkBtn} title={`Edit ${c.name}`} submitLabel="Save"
                          fields={[{ name: "name", label: "Category name", required: true, defaultValue: c.name }, { name: "description", kind: "textarea", label: "Description", defaultValue: c.description }, { name: "isActive", kind: "checkbox", label: "Active (offered for new vendors)", defaultValue: c.isActive }]}
                          action={updateCategoryAction.bind(null, c.id)}
                        />
                        <ModalForm
                          trigger="Delete" triggerClass={`${s.linkBtn} ${s.linkDanger}`} title={`Delete ${c.name}`} submitLabel="Delete category"
                          fields={[
                            ...(c.vendorCount > 0
                              ? ([{ name: "reassignTo", kind: "select", label: `Move ${c.vendorCount} vendor(s) to`, required: true, options: [["", "Choose a category"], ...categories.filter((x) => x.id !== c.id).map((x) => [x.id, x.name] as const)], help: "Required because this category is in use. You can also deactivate it instead." }] as Field[])
                              : ([{ kind: "section", label: "This category has no vendors and will be removed." }] as Field[])),
                          ]}
                          action={deleteCategoryAction.bind(null, c.id)}
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {categories.length === 0 ? <tr><td colSpan={5} className={s.empty}>No categories yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

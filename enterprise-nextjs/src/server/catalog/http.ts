import "server-only";
import { badRequest } from "@/server/errors";
import { MAX_IMAGE_BYTES, type ImageUpload } from "./images";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Parse the multipart product form shared by create and update. */
export async function parseProductForm(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Invalid form submission.");
  }
  let price: unknown;
  try {
    price = JSON.parse(str(form.get("price")) || "null");
  } catch {
    throw badRequest("Price details must be valid JSON.");
  }
  const file = form.get("image");
  let image: ImageUpload | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw badRequest("Product image must be 5 MB or smaller.");
    image = { bytes: Buffer.from(await file.arrayBuffer()) };
  }
  return {
    input: {
      name: str(form.get("name")),
      secondaryCode: str(form.get("secondaryCode")),
      categoryId: str(form.get("categoryId")),
      description: str(form.get("description")),
      type: str(form.get("type")),
      color: str(form.get("color")),
      hsnCode: str(form.get("hsnCode")),
      dimension: str(form.get("dimension")),
      price,
    },
    expectedUpdatedAt: str(form.get("expectedUpdatedAt")),
    removeImage: str(form.get("removeImage")) === "true",
    image,
  };
}

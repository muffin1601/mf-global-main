// Price maths shared by the services, the tests and (via the API) the UI preview.
// Parity: backend/routes/Products/product.js parseAndValidatePrice and AddProductModal.jsx.
import { z } from "zod";
import { badRequest } from "@/server/errors";
import { round2 } from "@/server/quotations/calc";

// Same decimal half-up rounding as quotations (toFixed(2) rounds the binary value: 1.575 -> "1.57").
export { round2 } from "@/server/quotations/calc";

/** net = basic + basic * gst / 100, rounded to 2 dp. */
export const computeNetAmount = (basicAmount: number, gstRate: number) => round2(basicAmount + (basicAmount * gstRate) / 100);

const optionalMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number({ error: "Amounts must be valid numbers." }).finite().min(0, "Amounts must be non-negative.").optional(),
);
const requiredMoney = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? NaN : v),
  z.coerce.number({ error: "Basic amount and GST rate must be valid non-negative numbers." }).finite("Basic amount and GST rate must be valid non-negative numbers.").min(0, "Basic amount and GST rate must be valid non-negative numbers."),
);

export const priceInputSchema = z.object({
  purchasePrice: optionalMoney,
  basicAmount: requiredMoney,
  gstRate: requiredMoney,
  sales5To50: optionalMoney,
  sales50To100: optionalMoney,
  sales100Above: optionalMoney,
});
export type PriceInput = z.input<typeof priceInputSchema>;

export function parsePrice(input: unknown) {
  if (!input || typeof input !== "object") throw badRequest("Price details are required.");
  const parsed = priceInputSchema.safeParse(input);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid price details.");
  const p = parsed.data;
  return { ...p, netAmount: computeNetAmount(p.basicAmount, p.gstRate) };
}

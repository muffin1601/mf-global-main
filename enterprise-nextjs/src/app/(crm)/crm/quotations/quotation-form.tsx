"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { calculateLineItem, calculateQuotationTotals } from "@/server/quotations/calc";
import type { QuotationDto } from "@/server/quotations/service";
import { saveQuotationAction } from "./actions";
import { ArrowLeft, FileDown, Plus, Save, Search, Trash2, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import styles from "./quotation-form.module.css";

type Ship = { name: string; address: string; state: string };
type Party = { name: string; company: string; phone: string; billToAddress: string; state: string; pan: string; shippingAddresses: Ship[]; selectedShippingAddress: Ship | null };
type Item = { name: string; description: string; hsn: string; image: string; qty: string; price: string; discount: string; tax: string };
type ClientHit = { id: string; name: string | null; company: string | null; phone: string | null; contact: string | null; party: Party };
type ProductHit = { id: string; code: string; name: string; gstRate?: number; imagePath?: string | null; category?: string; price?: { basicAmount?: number; netAmount?: number } };
type Defaults = { prefix: string; pan: string; companyName: string; bankDetails: Record<string, string> };

const DEFAULT_TERMS = "Payment Terms: 70% Advance at the time of order, Rest Amount at the time of Delivery.\nDelivery Time: 7-10 days.\nLogistic Cost extra as per transportation.";
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const inr = (n: number) => n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
const sv = (v: unknown) => (v === undefined || v === null ? "" : String(v));

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function QuotationForm({ mode, defaults, quotation }: { mode: "create" | "edit"; defaults: Defaults; quotation?: QuotationDto }) {
  const inv = quotation?.invoiceDetails ?? {};
  const sum = quotation?.summary ?? {};
  const bank = quotation?.bankDetails ?? {};
  const [savedId, setSavedId] = useState<string | null>(quotation?.id ?? null);
  const [savedNumber, setSavedNumber] = useState<string>(quotation ? `${sv(inv.prefix)}${sv(inv.number)}` : "");
  const [pending, startSave] = useTransition();

  const [party, setParty] = useState<Party | null>(quotation ? (quotation.party as unknown as Party) : null);
  const [items, setItems] = useState<Item[]>(
    (quotation?.items ?? []).map((i) => ({ name: i.name, description: i.description, hsn: i.hsn, image: i.image, qty: sv(i.qty), price: sv(i.price), discount: sv(i.discount), tax: sv(i.tax) })),
  );
  const [prefix, setPrefix] = useState(sv(inv.prefix) || defaults.prefix);
  const [date, setDate] = useState(sv(inv.date).slice(0, 10) || today());
  const [validityDays, setValidityDays] = useState(sv(inv.validityDays) || "30");
  const [validityDate, setValidityDate] = useState(sv(inv.validityDate).slice(0, 10) || addDays(today(), 30));
  const [poNo, setPoNo] = useState(sv(inv.poNo));
  const [placeOfSupply, setPlaceOfSupply] = useState(sv(inv.placeOfSupply) || party?.state || "");
  const [terms, setTerms] = useState(quotation ? quotation.terms : DEFAULT_TERMS);
  const [notes, setNotes] = useState(quotation?.notes ?? "");
  const [bankDetails, setBankDetails] = useState({
    accountHolder: sv(bank.accountHolder ?? defaults.bankDetails.accountHolder), accountNumber: sv(bank.accountNumber ?? defaults.bankDetails.accountNumber),
    ifscCode: sv(bank.ifscCode ?? defaults.bankDetails.ifscCode), bankName: sv(bank.bankName ?? defaults.bankDetails.bankName), upiId: sv(bank.upiId ?? defaults.bankDetails.upiId),
  });
  const [summary, setSummary] = useState({
    discount: sv(sum.discount ?? "0"), discountType: sv(sum.discountType) === "%" || !sum.discountType ? "%" : "₹", additionalCharges: sv(sum.additionalCharges ?? "0"),
    applyTCS: Boolean(sum.applyTCS), autoRoundOff: Boolean(sum.autoRoundOff), roundOffSign: sv(sum.roundOffSign) === "-" ? "-" : "+", roundOffAmount: sv(sum.roundOffAmount ?? "0"),
    amountReceived: sv(sum.amountReceived ?? "0"), paymentMethod: sv(sum.paymentMethod) || "Cash",
  });

  // Live preview uses the exact same calc module as the server.
  const totals = useMemo(() => calculateQuotationTotals(items, summary), [items, summary]);
  // Migrated quotations show their stored totals until the user edits something.
  const [touched, setTouched] = useState(mode === "create");
  const shown = !touched && quotation ? quotation.totals : totals;
  const touch = () => setTouched(true);

  // ---- client picker ----
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clientQ, setClientQ] = useState("");
  const dq = useDebounced(clientQ, 250);
  const [clientRes, setClientRes] = useState<{ q: string; data: ClientHit[] } | null>(null);
  const clients = clientRes?.data ?? [];
  const clientsLoading = clientRes?.q !== dq;
  useEffect(() => {
    if (!pickerOpen) return;
    const ctl = new AbortController();
    fetch(`/api/quotations/clients?limit=10&q=${encodeURIComponent(dq)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((j: { data: ClientHit[] }) => setClientRes({ q: dq, data: j.data }))
      .catch((e: Error) => { if (e.name !== "AbortError") { setClientRes({ q: dq, data: [] }); toast.error("Could not load client list."); } });
    return () => ctl.abort();
  }, [pickerOpen, dq]);
  const pickClient = (c: ClientHit) => { setParty({ ...c.party, pan: c.party.pan || defaults.pan }); setPlaceOfSupply(c.party.state); setPickerOpen(false); touch(); };

  // ---- ship to ----
  const [shipOpen, setShipOpen] = useState(false);
  const [newShip, setNewShip] = useState<Ship>({ name: "", address: "", state: "" });
  const selectShip = (s: Ship) => { setParty((p) => (p ? { ...p, selectedShippingAddress: s } : p)); setShipOpen(false); touch(); };
  const addShip = () => {
    if (!newShip.address.trim()) { toast.error("Enter the shipping address."); return; }
    const s = { name: newShip.name.trim() || "Shipping Address", address: newShip.address.trim(), state: newShip.state.trim() || party?.state || "" };
    setParty((p) => (p ? { ...p, shippingAddresses: [...(p.shippingAddresses ?? []), s], selectedShippingAddress: s } : p));
    setNewShip({ name: "", address: "", state: "" }); setShipOpen(false); touch();
  };

  // ---- product search ----
  const [productQ, setProductQ] = useState("");
  const dp = useDebounced(productQ, 250);
  const [productRes, setProductRes] = useState<{ q: string; data: ProductHit[] } | null>(null);
  const products = productQ.trim() && productRes?.q === dp.trim() && dp.trim() === productQ.trim() ? productRes.data : [];
  useEffect(() => {
    const q = dp.trim();
    if (!q) return;
    const ctl = new AbortController();
    fetch(`/api/products/search?query=${encodeURIComponent(q)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((j: { products: ProductHit[] }) => setProductRes({ q, data: j.products ?? [] }))
      .catch((e: Error) => { if (e.name !== "AbortError") setProductRes({ q, data: [] }); });
    return () => ctl.abort();
  }, [dp]);
  const addProduct = (p: ProductHit) => {
    setItems((prev) => [...prev, { name: p.name, description: p.code ? `Code: ${p.code}` : "", hsn: "", image: p.imagePath ?? "", qty: "1", price: sv(p.price?.basicAmount ?? p.price?.netAmount ?? 0), discount: "0", tax: sv(p.gstRate ?? 0) }]);
    setProductQ(""); touch();
  };
  const addCustom = () => { setItems((prev) => [...prev, { name: "", description: "", hsn: "", image: "", qty: "1", price: "0", discount: "0", tax: "0" }]); touch(); };
  const setItem = (i: number, patch: Partial<Item>) => { setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it))); touch(); };

  const setInvoiceDate = (d: string) => { setDate(d); const n = Number.parseInt(validityDays, 10); if (d && Number.isFinite(n) && n >= 0) setValidityDate(addDays(d, n)); touch(); };
  const setDays = (v: string) => { setValidityDays(v); const n = Number.parseInt(v, 10); if (date && Number.isFinite(n) && n >= 0) setValidityDate(addDays(date, n)); touch(); };

  const pdfUrl = savedId ? `/api/quotations/${savedId}/pdf` : null;

  const save = () => {
    if (pending) return;
    if (!party) { toast.error("Please select a client first."); return; }
    if (items.length === 0) { toast.error("Please add at least one item."); return; }
    startSave(async () => {
      const payload = {
        party, items, terms, notes, bankDetails, summary,
        invoiceDetails: { prefix, date, validityDays, validityDate, poNo, placeOfSupply },
      };
      const r = await saveQuotationAction(savedId, payload);
      if (!r.ok) { toast.error(r.error); return; }
      setSavedId(r.id); setSavedNumber(r.number);
      toast.success(`Quotation ${r.number} saved`);
      // MERN generated the PDF right after saving: start the download now.
      const a = document.createElement("a");
      a.href = `/api/quotations/${r.id}/pdf`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  };

  const lineTotals = items.map((i) => calculateLineItem(i));
  const isEdit = Boolean(savedId);

  return (
    <main className="page">
      <PageHeader
        eyebrow={isEdit && savedNumber ? <span style={{ fontFamily: "var(--font-mono)" }}>{savedNumber}</span> : "Sales document"}
        title={mode === "edit" ? "Edit quotation" : "New quotation"}
        description="Saving downloads the PDF automatically. Totals use the same calculation as the server."
        actions={<>
          <Link className="button ghost" href="/crm/quotations"><ArrowLeft size={15} aria-hidden="true" />Quotations</Link>
          {pdfUrl && <a className="button secondary" href={pdfUrl}><FileDown size={15} aria-hidden="true" />PDF</a>}
          <button type="button" className="button" onClick={save} disabled={pending}><Save size={15} aria-hidden="true" />{pending ? "Saving…" : isEdit ? "Save changes" : "Save quotation"}</button>
        </>}
      />
      {savedNumber && isEdit && mode === "create" && <div className="callout tone-success" role="status"><span>Saved as <strong>{savedNumber}</strong>. Further saves update this quotation.</span></div>}

      <section className="card">
        <h2 className="card-title">Quotation details</h2>
        <p className="card-desc">The number is assigned when the quotation is first saved.</p>
        <div className="form-grid cols-3">
          <div className="field"><label htmlFor="q-prefix">Prefix</label><input id="q-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} disabled={isEdit} /></div>
          <div className="field"><label htmlFor="q-number">Number</label><input id="q-number" value={isEdit ? savedNumber.slice(prefix.length) : "Assigned on save"} readOnly disabled /></div>
          <div className="field"><label htmlFor="q-date">Date</label><input id="q-date" type="date" value={date} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
          <div className="field"><label htmlFor="q-vdays">Validity (days)</label><input id="q-vdays" type="number" min={0} value={validityDays} onChange={(e) => setDays(e.target.value)} /></div>
          <div className="field"><label htmlFor="q-vdate">Valid till</label><input id="q-vdate" type="date" value={validityDate} onChange={(e) => { setValidityDate(e.target.value); touch(); }} /></div>
          <div className="field"><label htmlFor="q-po">PO No.</label><input id="q-po" value={poNo} onChange={(e) => { setPoNo(e.target.value); touch(); }} /></div>
          <div className="field"><label htmlFor="q-pos">Place of supply</label><input id="q-pos" value={placeOfSupply} onChange={(e) => { setPlaceOfSupply(e.target.value); touch(); }} /></div>
        </div>
      </section>

      <section className="card">
        <div className={styles.cardHead}>
          <div><h2 className="card-title">Bill to</h2><p className="card-desc">Pick a client from your leads, then adjust details for this document.</p></div>
          <div className={styles.row} style={{ margin: 0 }}>
            <button type="button" className="button secondary small" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen}><Search size={14} aria-hidden="true" />{party ? "Change client" : "Select client"}</button>
            {party && <button type="button" className="button secondary small" onClick={() => setShipOpen((o) => !o)} aria-expanded={shipOpen}><Truck size={14} aria-hidden="true" />Ship to</button>}
          </div>
        </div>
        {party ? (
          <div className="form-grid cols-3">
            <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" value={party.name} onChange={(e) => { setParty({ ...party, name: e.target.value }); touch(); }} /></div>
            <div className="field"><label htmlFor="p-company">Company</label><input id="p-company" value={party.company} onChange={(e) => { setParty({ ...party, company: e.target.value }); touch(); }} /></div>
            <div className="field"><label htmlFor="p-phone">Phone</label><input id="p-phone" value={party.phone} onChange={(e) => { setParty({ ...party, phone: e.target.value }); touch(); }} /></div>
            <div className="field"><label htmlFor="p-state">State</label><input id="p-state" value={party.state} onChange={(e) => { setParty({ ...party, state: e.target.value }); touch(); }} /></div>
            <div className="field"><label htmlFor="p-pan">PAN</label><input id="p-pan" value={party.pan} onChange={(e) => { setParty({ ...party, pan: e.target.value }); touch(); }} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="p-addr">Billing address</label><textarea id="p-addr" rows={2} value={party.billToAddress} onChange={(e) => { setParty({ ...party, billToAddress: e.target.value }); touch(); }} /></div>
          </div>
        ) : <div className="callout"><span>No client selected yet. Use <strong>Select client</strong> to search your leads.</span></div>}
        {party && <p className={styles.shipLine}><Truck size={14} aria-hidden="true" /><span><strong>Ship to:</strong> {party.selectedShippingAddress?.address || party.billToAddress || "Same as billing"}</span></p>}
        {pickerOpen && (
          <div className={styles.panel}>
            <input type="search" aria-label="Search clients" placeholder="Search by name, company or phone" value={clientQ} onChange={(e) => setClientQ(e.target.value)} autoFocus />
            {clientsLoading && <p className="muted" style={{ margin: "8px 0 0" }}>Searching…</p>}
            <ul className={styles.list}>
              {clients.map((c) => (
                <li key={c.id}><button type="button" onClick={() => pickClient(c)}>{c.name || c.company || c.contact || "Unnamed"} <small>{[c.company, c.phone || c.contact].filter(Boolean).join(" · ")}</small></button></li>
              ))}
              {!clientsLoading && clients.length === 0 && <li>No clients found.</li>}
            </ul>
          </div>
        )}
        {party && shipOpen && (
          <div className={styles.panel}>
            <strong style={{ fontSize: ".8125rem" }}>Select a shipping address or add a new one</strong>
            <ul className={styles.list}>
              {(party.shippingAddresses ?? []).map((s, i) => (
                <li key={`${s.name}-${i}`}><button type="button" onClick={() => selectShip(s)}>{s.name} <small>{s.address}{s.state ? `, ${s.state}` : ""}</small></button></li>
              ))}
            </ul>
            <div className="form-grid cols-3" style={{ marginTop: 10 }}>
              <div className="field"><label htmlFor="s-name">Label</label><input id="s-name" value={newShip.name} onChange={(e) => setNewShip({ ...newShip, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="s-addr">Address</label><input id="s-addr" value={newShip.address} onChange={(e) => setNewShip({ ...newShip, address: e.target.value })} /></div>
              <div className="field"><label htmlFor="s-state">State</label><input id="s-state" value={newShip.state} onChange={(e) => setNewShip({ ...newShip, state: e.target.value })} /></div>
            </div>
            <button type="button" className="button small" style={{ marginTop: 10 }} onClick={addShip}><Plus size={14} aria-hidden="true" />Add address</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Line items</h2>
        <p className="card-desc">Search the catalogue to add a product, or add a custom line.</p>
        <div className={styles.row}>
          <div className="search-input" style={{ flex: "1 1 260px" }}>
            <Search size={15} aria-hidden="true" />
            <input type="search" aria-label="Search products" placeholder="Search products by name, code or HSN" value={productQ} onChange={(e) => setProductQ(e.target.value)} />
          </div>
          <button type="button" className="button secondary" onClick={addCustom}><Plus size={15} aria-hidden="true" />Custom item</button>
        </div>
        {products.length > 0 && (
          <ul className={`${styles.list} ${styles.panel}`}>
            {products.map((p) => (
              <li key={p.id}><button type="button" onClick={() => addProduct(p)}>{p.name} <small>{p.code} · {inr(p.price?.basicAmount ?? p.price?.netAmount ?? 0)} · GST {p.gstRate ?? 0}%</small></button></li>
            ))}
          </ul>
        )}
        <div className="table-card" style={{ marginTop: 12 }}>
          <div className="table-scroll">
          <table className={styles.items}>
            <thead><tr><th style={{ width: 36 }}>#</th><th>Item</th><th>HSN</th><th className="num">Qty</th><th className="num">Rate (₹)</th><th className="num">Disc %</th><th className="num">GST %</th><th className="num">Amount</th><th style={{ width: 1 }}><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><div className={styles.itemCell}><input aria-label={`Item ${i + 1} name`} placeholder="Item name" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} /><input aria-label={`Item ${i + 1} description`} placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} /></div></td>
                  <td><input aria-label={`Item ${i + 1} HSN`} className={styles.narrow} value={it.hsn} onChange={(e) => setItem(i, { hsn: e.target.value })} /></td>
                  <td><input aria-label={`Item ${i + 1} quantity`} className={styles.narrow} type="number" min={0} step="any" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
                  <td><input aria-label={`Item ${i + 1} rate`} className={styles.narrow} type="number" min={0} step="any" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} /></td>
                  <td><input aria-label={`Item ${i + 1} discount`} className={styles.narrow} type="number" min={0} max={100} step="any" value={it.discount} onChange={(e) => setItem(i, { discount: e.target.value })} /></td>
                  <td><input aria-label={`Item ${i + 1} GST`} className={styles.narrow} type="number" min={0} max={100} step="any" value={it.tax} onChange={(e) => setItem(i, { tax: e.target.value })} /></td>
                  <td className="num" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{inr((lineTotals[i]?.total ?? 0))}</td>
                  <td><button type="button" className="icon-btn" style={{ color: "var(--danger)" }} aria-label={`Remove item ${i + 1}`} title="Remove item" onClick={() => { setItems((p) => p.filter((_, k) => k !== i)); touch(); }}><Trash2 size={15} /></button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={9} className="cell-empty">No items yet. Search a product above or add a custom item.</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Summary</h2>
        <p className="card-desc">Document-level discount, charges, round-off and payment received.</p>
        <div className={styles.summaryGrid}>
        <div className="form-grid cols-2">
          <div className="field"><label htmlFor="s-disc">Discount</label>
            <div className={styles.row}>
              <input id="s-disc" type="number" min={0} step="any" value={summary.discount} onChange={(e) => { setSummary({ ...summary, discount: e.target.value }); touch(); }} />
              <select aria-label="Discount type" value={summary.discountType} onChange={(e) => { setSummary({ ...summary, discountType: e.target.value }); touch(); }}><option value="%">%</option><option value={"₹"}>Amount</option></select>
            </div></div>
          <div className="field"><label htmlFor="s-charges">Additional charges</label><input id="s-charges" type="number" min={0} step="any" value={summary.additionalCharges} onChange={(e) => { setSummary({ ...summary, additionalCharges: e.target.value }); touch(); }} /></div>
          <div className="field"><label className="check-row"><input type="checkbox" checked={summary.applyTCS} onChange={(e) => { setSummary({ ...summary, applyTCS: e.target.checked }); touch(); }} /> Apply TCS</label></div>
          <div className="field"><label className="check-row"><input type="checkbox" checked={summary.autoRoundOff} onChange={(e) => { setSummary({ ...summary, autoRoundOff: e.target.checked }); touch(); }} /> Auto round off</label>
            {summary.autoRoundOff && (
              <div className={styles.row}>
                <select aria-label="Round off sign" value={summary.roundOffSign} onChange={(e) => { setSummary({ ...summary, roundOffSign: e.target.value }); touch(); }}><option value="+">+</option><option value="-">-</option></select>
                <input aria-label="Round off amount" type="number" min={0} step="any" value={summary.roundOffAmount} onChange={(e) => { setSummary({ ...summary, roundOffAmount: e.target.value }); touch(); }} />
              </div>)}
          </div>
          <div className="field"><label htmlFor="s-recv">Amount received</label><input id="s-recv" type="number" min={0} step="any" value={summary.amountReceived} onChange={(e) => { setSummary({ ...summary, amountReceived: e.target.value }); touch(); }} /></div>
          <div className="field"><label htmlFor="s-pay">Payment method</label>
            <select id="s-pay" value={summary.paymentMethod} onChange={(e) => { setSummary({ ...summary, paymentMethod: e.target.value }); touch(); }}>
              {["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"].map((m) => <option key={m}>{m}</option>)}
              {!["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Other"].includes(summary.paymentMethod) && <option>{summary.paymentMethod}</option>}
            </select></div>
        </div>
        <dl className={styles.totals} aria-label="Totals preview">
          <dt>Subtotal</dt><dd>{inr(shown.subtotal)}</dd>
          <dt>Tax / GST</dt><dd>{inr(shown.totalTax)}</dd>
          <dt>Discount</dt><dd>-{inr(shown.totalDiscount)}</dd>
          <dt>Additional charges</dt><dd>{inr(shown.additionalCharges)}</dd>
          <dt>Round off</dt><dd>{inr(shown.roundOff)}</dd>
          <dt className={styles.grand}>Grand total</dt><dd className={styles.grand}>{inr(shown.grandTotal)}</dd>
          <dt>Amount received</dt><dd>{inr(shown.amountReceived)}</dd>
          <dt>Balance</dt><dd>{inr(shown.balanceAmount)}</dd>
        </dl>
        </div>
        {!touched && <p className="hint" style={{ marginTop: 10 }}>Showing the totals stored with this quotation. They are recalculated when you save changes.</p>}
      </section>

      <section className="card">
        <h2 className="card-title">Terms, notes and bank details</h2>
        <p className="card-desc">Printed at the foot of the PDF.</p>
        <div className="form-grid cols-2">
          <div className="field"><label htmlFor="t-terms">Terms and conditions</label><textarea id="t-terms" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
          <div className="field"><label htmlFor="t-notes">Notes</label><textarea id="t-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <h3 className="card-title" style={{ marginTop: 18 }}>Bank details</h3>
        <div className="form-grid cols-3" style={{ marginTop: 8 }}>
          <div className="field"><label htmlFor="b-holder">Account holder</label><input id="b-holder" value={bankDetails.accountHolder} onChange={(e) => setBankDetails({ ...bankDetails, accountHolder: e.target.value })} /></div>
          <div className="field"><label htmlFor="b-bank">Bank name</label><input id="b-bank" value={bankDetails.bankName} onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })} /></div>
          <div className="field"><label htmlFor="b-acc">Account number</label><input id="b-acc" value={bankDetails.accountNumber} onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })} /></div>
          <div className="field"><label htmlFor="b-ifsc">IFSC</label><input id="b-ifsc" value={bankDetails.ifscCode} onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })} /></div>
          <div className="field"><label htmlFor="b-upi">UPI ID</label><input id="b-upi" value={bankDetails.upiId} onChange={(e) => setBankDetails({ ...bankDetails, upiId: e.target.value })} /></div>
        </div>
      </section>
      <div className={styles.saveBar}>
        <span className="muted">Grand total <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{inr(shown.grandTotal)}</strong> · {items.length} item{items.length === 1 ? "" : "s"}</span>
        <div className={styles.row} style={{ margin: 0 }}>
          {pdfUrl && <a className="button secondary" href={pdfUrl}><FileDown size={15} aria-hidden="true" />Download PDF</a>}
          <button type="button" className="button" onClick={save} disabled={pending}><Save size={15} aria-hidden="true" />{pending ? "Saving…" : isEdit ? "Save changes" : "Save quotation"}</button>
        </div>
      </div>
    </main>
  );
}

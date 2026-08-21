import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Package,
  Pencil,
  Trash2,
  Plus,
  Printer,
  Check,
  X,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  fmt,
  num,
  computePrice,
  fetchVendors,
  COLORS,
  pageStyle,
  cardStyle,
  labelStyle,
  NumField,
  TextField,
  SelectField,
  Toggle,
  titleStyle,
  subtitleStyle,
  backBtnStyle,
  primaryBtn,
  secondaryBtn,
  dangerBtn,
  COLORS_UI,
  useConfirm,
} from "./shared.jsx";
import { buildOrderPdf } from "./pdf.js";
const PdfPreviewDialog = React.lazy(() => import("./PdfPreviewDialog.jsx"));

function vendorRate(vendors, vendorId, fallback) {
  const v = vendors.find((v) => v.id === vendorId);
  if (v && v.default_rate !== null && v.default_rate !== undefined)
    return v.default_rate;
  return fallback;
}

function vendorAcrylicRate(vendors, vendorId, fallback) {
  const v = vendors.find((v) => v.id === vendorId);
  if (
    v &&
    v.default_acrylic_rate !== null &&
    v.default_acrylic_rate !== undefined
  )
    return v.default_acrylic_rate;
  return fallback;
}

function toEditRow(item) {
  return {
    id: item.id, // real DB id — present means this row already exists in the database
    height: item.height,
    length: item.length,
    width: item.width,
    qty: item.qty,
    hasAcrylic: item.has_acrylic,
    description: item.description || "",
    color: item.color || "Blue",
    vendor: item.vendor_id,
    rate: item.rate,
    acrylicRate: item.acrylic_rate ?? 0.6,
  };
}

// An "order" here is identified by (vendorId, batchDate) — not a single
// batches row — since one box scan can hold boxes for several vendors and
// each vendor's boxes need to group/print separately regardless of which
// physical batch row they were inserted under.
export default function BatchDetail({
  vendorId,
  batchDate,
  onBack,
  onDeleted,
}) {
  const { confirm, dialog } = useConfirm();
  const [vendorName, setVendorName] = useState("");
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editRows, setEditRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const tempIdRef = useRef(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [vendorRes, itemsRes, vs] = await Promise.all([
        supabase.from("vendors").select("name").eq("id", vendorId).single(),
        supabase
          .from("box_items")
          .select("*")
          .eq("vendor_id", vendorId)
          .eq("batch_date", batchDate)
          .order("created_at"),
        fetchVendors(),
      ]);
      if (vendorRes.error) throw vendorRes.error;
      if (itemsRes.error) throw itemsRes.error;
      setVendorName(vendorRes.data.name);
      setItems(itemsRes.data);
      setVendors(vs);
    } catch (err) {
      setError(err.message || "Couldn't load this order.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, batchDate]);

  function startEditing() {
    setEditRows(items.map(toEditRow));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditRows([]);
  }

  function updateEditRow(id, patch) {
    setEditRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function changeRowVendor(id, newVendorId) {
    const rate = vendorRate(
      vendors,
      newVendorId,
      editRows.find((r) => r.id === id)?.rate,
    );
    const acrylicRate = vendorAcrylicRate(
      vendors,
      newVendorId,
      editRows.find((r) => r.id === id)?.acrylicRate,
    );
    updateEditRow(id, { vendor: newVendorId, rate, acrylicRate });
  }

  function addBlankRow() {
    const tempId = `new-${tempIdRef.current++}`;
    const rate = vendorRate(vendors, vendorId, 2.5);
    const acrylicRate = vendorAcrylicRate(vendors, vendorId, 0.6);
    setEditRows((rs) => [
      ...rs,
      {
        id: tempId,
        height: "",
        length: "",
        width: "",
        qty: "",
        hasAcrylic: false,
        description: "",
        color: "Blue",
        vendor: vendorId,
        rate,
        acrylicRate,
      },
    ]);
  }

  async function deleteRow(id) {
    const isNew = String(id).startsWith("new-");
    if (isNew) {
      setEditRows((rs) => rs.filter((r) => r.id !== id));
      return;
    }
    const ok = await confirm({
      title: "Delete this box?",
      message: "This can't be undone.",
      confirmLabel: "Delete box",
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from("box_items").delete().eq("id", id);
      if (error) throw error;
      setEditRows((rs) => rs.filter((r) => r.id !== id));
      setItems((its) => its.filter((it) => it.id !== id));
    } catch (err) {
      setError("Couldn't delete box: " + err.message);
    }
  }

  // A box moved to a different vendor here leaves this order's view (it now
  // belongs to that vendor's own order for this date instead).
  async function saveChanges() {
    setSaving(true);
    setError("");
    try {
      // Every row needs a real batches container row to attach to. Reuse one
      // for this date if it exists, otherwise create one.
      const { data: existingBatch, error: findErr } = await supabase
        .from("batches")
        .select("id")
        .eq("batch_date", batchDate)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      let containerBatchId = existingBatch?.id;
      if (!containerBatchId) {
        const { data: newBatch, error: createErr } = await supabase
          .from("batches")
          .insert({ vendor_id: vendorId, batch_date: batchDate })
          .select("id")
          .single();
        if (createErr) throw createErr;
        containerBatchId = newBatch.id;
      }

      for (const row of editRows) {
        const price = computePrice(row);
        const rowVendorId = row.vendor || vendorId;
        const payload = {
          vendor_id: rowVendorId,
          batch_date: batchDate,
          height: num(row.height),
          length: num(row.length),
          width: num(row.width),
          qty: num(row.qty),
          has_acrylic: row.hasAcrylic,
          color: row.color,
          description: row.description || null,
          rate: num(row.rate),
          acrylic_rate: row.hasAcrylic ? num(row.acrylicRate) : null,
          unit_price: price.unit,
          total_price: price.total,
        };
        const isNew = String(row.id).startsWith("new-");
        if (isNew) {
          const { error } = await supabase
            .from("box_items")
            .insert({ ...payload, batch_id: containerBatchId });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("box_items")
            .update(payload)
            .eq("id", row.id);
          if (error) throw error;
        }
      }
      await load();
      setIsEditing(false);
      setEditRows([]);
    } catch (err) {
      setError("Couldn't save changes: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrder() {
    const boxCount = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);
    const total = items.reduce(
      (sum, it) => sum + Number(it.total_price || 0),
      0,
    );
    const ok = await confirm({
      title: "Delete this order?",
      message: `This will delete ${boxCount} box${boxCount === 1 ? "" : "es"} worth ${fmt(total)} for ${vendorName || "this vendor"}. This can't be undone.`,
      confirmLabel: "Delete order",
    });
    if (!ok) return;
    setDeletingOrder(true);
    try {
      const { error } = await supabase
        .from("box_items")
        .delete()
        .eq("vendor_id", vendorId)
        .eq("batch_date", batchDate);
      if (error) throw error;
      onDeleted();
    } catch (err) {
      setError("Couldn't delete order: " + err.message);
      setDeletingOrder(false);
    }
  }

  function handlePrint() {
    try {
      const doc = buildOrderPdf({ vendorName, batchDate, items });
      setPdfBlob(doc.output("blob"));
    } catch (err) {
      setError("Couldn't generate PDF: " + err.message);
    }
  }

  const total = items.reduce((sum, it) => sum + Number(it.total_price || 0), 0);
  const boxCount = items.reduce((sum, it) => sum + Number(it.qty || 0), 0);

  return (
    <div style={{ ...pageStyle, paddingTop: 0 }} className="page-root">
      <div style={{ maxWidth: 460, margin: "0 auto" }} className="content-wrap">
        <div
          className="no-print"
          style={{
            position: "sticky",
            top: 60,
            zIndex: 20,
            marginTop: 60,
            paddingTop: "env(safe-area-inset-top)",
            background: "var(--card-bg)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid var(--card-border)",
            borderRadius: 20,
          }}
        >
          <div style={{ padding: "22px 18px 6px" }}>
            <button onClick={onBack} style={backBtnStyle}>
              <ArrowLeft size={14} /> back to dashboard
            </button>
          </div>
          <div
            style={{
              padding: "0 18px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div>
              <h1 style={titleStyle}>{vendorName || "Order"}</h1>
              <p style={subtitleStyle}>{batchDate}</p>
            </div>
            {!isEditing && !loading && (
              <div style={{ display: "flex", gap: 8 }}>
                <IconBtn onClick={handlePrint} aria-label="Print">
                  <Printer size={16} />
                </IconBtn>
                <IconBtn onClick={startEditing} aria-label="Edit">
                  <Pencil size={16} />
                </IconBtn>
              </div>
            )}
          </div>
        </div>

        {/* Print-only header — the sticky bar above is hidden on paper, so the
            receipt still needs its own plain vendor name + date up top. */}
        <div className="print-only" style={{ padding: "10px 6px 18px" }}>
          <h1 style={titleStyle}>{vendorName || "Order"}</h1>
          <p style={subtitleStyle}>{batchDate}</p>
        </div>

        {error && (
          <div
            style={{
              ...cardStyle,
              border: `1.5px solid ${COLORS_UI.accent}`,
              fontSize: 13,
            }}
            className="no-print"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              color: COLORS_UI.inkSoft,
              marginTop: 14,
            }}
          >
            Loading…
          </div>
        ) : isEditing ? (
          <>
            <div style={{ paddingTop: 14 }} />
            {editRows.map((row, idx) => (
              <div key={row.id} style={cardStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: COLORS_UI.accentDark,
                      letterSpacing: 1,
                    }}
                  >
                    BOX {idx + 1}
                    {row.description && (
                      <span
                        style={{
                          color: "var(--ink)",
                          fontWeight: 600,
                          marginLeft: 6,
                        }}
                      >
                        — {row.description}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteRow(row.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: COLORS_UI.accent,
                      cursor: "pointer",
                    }}
                    aria-label="Delete box"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 0.8fr",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <NumField
                    label="Height"
                    value={row.height}
                    placeholder="in"
                    onChange={(v) => updateEditRow(row.id, { height: v })}
                  />
                  <NumField
                    label="Length"
                    value={row.length}
                    placeholder="in"
                    onChange={(v) => updateEditRow(row.id, { length: v })}
                  />
                  <NumField
                    label="Width"
                    value={row.width}
                    placeholder="in"
                    onChange={(v) => updateEditRow(row.id, { width: v })}
                  />
                  <NumField
                    label="Qty"
                    value={row.qty}
                    placeholder="1"
                    onChange={(v) => updateEditRow(row.id, { qty: v })}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <TextField
                    label="Description (optional)"
                    value={row.description}
                    onChange={(v) => updateEditRow(row.id, { description: v })}
                    placeholder="e.g. Silver glasses box"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--input-bg)",
                      border: "1px solid var(--input-border)",
                      borderRadius: 12,
                      padding: "9px 11px",
                      height: 41,
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                      Acrylic
                    </span>
                    <Toggle
                      checked={row.hasAcrylic}
                      onChange={(v) => updateEditRow(row.id, { hasAcrylic: v })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Color</label>
                    <SelectField
                      value={row.color}
                      onChange={(v) => updateEditRow(row.id, { color: v })}
                      options={COLORS}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>Vendor</label>
                  <SelectField
                    value={row.vendor}
                    onChange={(v) => changeRowVendor(row.id, v)}
                    options={vendors.map((v) => ({
                      value: v.id,
                      label: v.name,
                    }))}
                  />
                  {row.vendor && row.vendor !== vendorId && (
                    <div
                      style={{
                        fontSize: 11,
                        color: COLORS_UI.accentDark,
                        marginTop: 4,
                      }}
                    >
                      Moving to another vendor's order for this date on save.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <NumField
                    label="Rate / sq.in"
                    value={row.rate}
                    onChange={(v) => updateEditRow(row.id, { rate: v })}
                  />
                  <NumField
                    label="Acrylic rate"
                    value={row.acrylicRate}
                    onChange={(v) => updateEditRow(row.id, { acrylicRate: v })}
                    disabled={!row.hasAcrylic}
                  />
                </div>

                <div
                  style={{
                    borderTop: "1px dashed var(--input-border)",
                    paddingTop: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "'DM Mono', monospace",
                  }}
                >
                  {(() => {
                    const p = computePrice(row);
                    return (
                      <>
                        <span
                          style={{ fontSize: 11.5, color: COLORS_UI.inkSoft }}
                        >
                          {fmt(p.unit)} &times; {num(row.qty)}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>
                          {fmt(p.total)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}

            <button
              onClick={addBlankRow}
              style={{ ...secondaryBtn, marginBottom: 12 }}
            >
              <Plus size={17} /> Add box
            </button>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={cancelEditing}
                style={{ ...secondaryBtn, flex: 1 }}
                disabled={saving}
              >
                <X size={16} /> Cancel
              </button>
              <button
                onClick={saveChanges}
                style={{ ...primaryBtn, flex: 1.4 }}
                disabled={saving}
              >
                {saving ? (
                  "Saving…"
                ) : (
                  <>
                    <Check size={16} /> Save changes
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleDeleteOrder}
              style={dangerBtn}
              disabled={deletingOrder}
            >
              <Trash2 size={16} />{" "}
              {deletingOrder ? "Deleting…" : "Delete entire order"}
            </button>
          </>
        ) : (
          <>
            <div className="screen-only" style={{ paddingTop: 14 }}>
              <div
                style={{
                  ...cardStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Package size={16} color={COLORS_UI.inkSoft} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {boxCount} boxes
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 19,
                    fontWeight: 700,
                    color: COLORS_UI.accentDark,
                  }}
                >
                  {fmt(total)}
                </div>
              </div>

              {items.map((it, idx) => (
                <div key={it.id} style={cardStyle}>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: COLORS_UI.accentDark,
                      letterSpacing: 1,
                      marginBottom: 8,
                    }}
                  >
                    BOX {idx + 1}
                    {it.description && (
                      <span
                        style={{
                          color: COLORS_UI.ink,
                          fontWeight: 600,
                          marginLeft: 6,
                          letterSpacing: 0,
                        }}
                      >
                        — {it.description}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                    <div>
                      <b>{it.height}</b>H &times; <b>{it.length}</b>L &times;{" "}
                      <b>{it.width}</b>W in, qty <b>{it.qty}</b>
                    </div>
                    <div style={{ color: COLORS_UI.inkSoft, fontSize: 12.5 }}>
                      {it.color || "—"} &middot;{" "}
                      {it.has_acrylic ? "Acrylic" : "No acrylic"}
                      <span className="no-print">
                        {it.has_acrylic && ` @ ${it.acrylic_rate}/sq.in`}{" "}
                        &middot; Rate {it.rate}/sq.in
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      borderTop: "1px dashed var(--input-border)",
                      marginTop: 8,
                      paddingTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: COLORS_UI.inkSoft }}>
                      {fmt(it.unit_price)} &times; {it.qty}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {fmt(it.total_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Print-only: compact row-per-box receipt, laid out for handing to the vendor */}
            <div className="print-only">
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Box</th>
                    <th className="print-num">Qty</th>
                    <th className="print-num">Unit ₹</th>
                    <th className="print-num">Total ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id}>
                      <td>
                        <div className="print-desc">
                          {it.description || `Box ${idx + 1}`}
                        </div>
                        <div className="print-dims">
                          {it.height}H &times; {it.length}L &times; {it.width}W
                          in
                          {it.color ? ` · ${it.color}` : ""}
                          {it.has_acrylic ? " · Acrylic" : ""}
                        </div>
                      </td>
                      <td className="print-num">{it.qty}</td>
                      <td className="print-num">{fmt(it.unit_price)}</td>
                      <td className="print-num">{fmt(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="print-grand-total">
                <span>Total ({boxCount} boxes)</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          </>
        )}
      </div>
      {dialog}
      {pdfBlob && (
        <React.Suspense fallback={null}>
          <PdfPreviewDialog
            blob={pdfBlob}
            filename={`${(vendorName || "order").replace(/\s+/g, "-")}-${batchDate}.pdf`}
            onClose={() => setPdfBlob(null)}
          />
        </React.Suspense>
      )}
    </div>
  );
}

function IconBtn({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid var(--card-border)",
        background: "var(--card-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        color: "var(--ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

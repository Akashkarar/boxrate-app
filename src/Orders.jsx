import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Package,
  Calendar,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  fmt,
  fetchVendors,
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  SelectField,
  DateField,
  COLORS_UI,
  titleStyle,
  subtitleStyle,
  backBtnStyle,
  sectionLabelStyle,
  useConfirm,
} from "./shared.jsx";

export default function Orders({ onBack, onOpenOrder }) {
  const { confirm, dialog } = useConfirm();
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [vs, ordersRes] = await Promise.all([
        fetchVendors(),
        supabase
          .from("order_summary")
          .select("*")
          .order("batch_date", { ascending: false }),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      setVendors(vs);
      setOrders(ordersRes.data);
    } catch (err) {
      setError(err.message || "Couldn't load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDeleteOrder(
    vendorId,
    batchDate,
    vendorName,
    boxCount,
    totalPrice,
  ) {
    if (!vendorId) return;
    const ok = await confirm({
      title: "Delete this order?",
      message: `This will delete ${boxCount} box${boxCount === 1 ? "" : "es"} for ${vendorName || "this vendor"} worth ${fmt(totalPrice)}. This can't be undone.`,
      confirmLabel: "Delete order",
    });
    if (!ok) return;
    setError("");
    try {
      const { error } = await supabase
        .from("box_items")
        .delete()
        .eq("vendor_id", vendorId)
        .eq("batch_date", batchDate);
      if (error) throw error;
      await load();
    } catch (err) {
      setError("Couldn't delete order: " + err.message);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (vendorFilter !== "all" && o.vendor_id !== vendorFilter) return false;
      if (fromDate && o.batch_date < fromDate) return false;
      if (toDate && o.batch_date > toDate) return false;
      return true;
    });
  }, [orders, vendorFilter, fromDate, toDate]);

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ padding: "10px 6px 18px" }}>
          {onBack && (
            <button onClick={onBack} style={backBtnStyle}>
              <ArrowLeft size={14} /> back
            </button>
          )}
          <h1 style={titleStyle}>Orders</h1>
          <p style={subtitleStyle}>browse &amp; print by vendor</p>
        </div>

        {error && (
          <div
            style={{
              ...cardStyle,
              border: `1.5px solid ${COLORS_UI.accent}`,
              fontSize: 13,
            }}
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
            }}
          >
            Loading…
          </div>
        ) : (
          <>
            <div style={cardStyle}>
              <div style={sectionLabelStyle}>
                <Calendar size={13} /> Filter
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Vendor</label>
                <SelectField
                  value={vendorFilter}
                  onChange={setVendorFilter}
                  options={[
                    { value: "all", label: "All vendors" },
                    ...vendors.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>From</label>
                  <DateField value={fromDate} onChange={setFromDate} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>To</label>
                  <DateField value={toDate} onChange={setToDate} />
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionLabelStyle}>
                <Package size={13} /> Order history
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: COLORS_UI.inkSoft,
                  marginTop: -6,
                  marginBottom: 8,
                }}
              >
                Tap an order to view, edit, or print it.
              </div>
              {filteredOrders.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS_UI.inkSoft }}>
                  No orders match this filter.
                </div>
              ) : (
                filteredOrders.map((o) => (
                  <div
                    key={`${o.vendor_id}-${o.batch_date}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 0",
                      borderTop: "1px dashed rgba(28,28,30,0.14)",
                    }}
                  >
                    <button
                      onClick={() => onOpenOrder(o.vendor_id, o.batch_date)}
                      style={{
                        flex: 1,
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: 0,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: COLORS_UI.ink,
                          }}
                        >
                          {o.vendor_name || "Unknown vendor"}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS_UI.inkSoft }}>
                          {o.batch_date} &middot; {o.box_count} boxes
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: COLORS_UI.ink,
                          }}
                        >
                          {fmt(o.total_price)}
                        </div>
                        <ChevronRight size={15} color={COLORS_UI.inkSoft} />
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteOrder(
                          o.vendor_id,
                          o.batch_date,
                          o.vendor_name,
                          o.box_count,
                          o.total_price,
                        )
                      }
                      aria-label="Delete order"
                      style={{
                        background: "none",
                        border: "none",
                        color: COLORS_UI.accent,
                        cursor: "pointer",
                        padding: "4px 2px 4px 6px",
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {dialog}
    </div>
  );
}

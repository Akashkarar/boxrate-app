import React, { useEffect, useState, useMemo } from "react";
import { ArrowLeft, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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
} from "./shared.jsx";

function compactNumber(n) {
  if (n >= 100000) return (n / 100000).toFixed(n % 100000 === 0 ? 0 : 1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
}

export default function Dashboard({ onBack }) {
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]); // rows from order_summary (per vendor+date)
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
        supabase.from("order_summary").select("*"),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      setVendors(vs);
      setOrders(ordersRes.data);
    } catch (err) {
      setError(err.message || "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (vendorFilter !== "all" && o.vendor_id !== vendorFilter) return false;
      if (fromDate && o.batch_date < fromDate) return false;
      if (toDate && o.batch_date > toDate) return false;
      return true;
    });
  }, [orders, vendorFilter, fromDate, toDate]);

  // Totals by vendor — respects the filter above, unlike a static all-time view.
  const vendorTotals = useMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) {
      const key = o.vendor_id;
      const entry = map.get(key) || {
        vendor_id: o.vendor_id,
        vendor_name: o.vendor_name || "Unknown vendor",
        order_count: 0,
        total_boxes: 0,
        total_sales: 0,
      };
      entry.order_count += 1;
      entry.total_boxes += Number(o.box_count) || 0;
      entry.total_sales += Number(o.total_price) || 0;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total_sales - a.total_sales);
  }, [filteredOrders]);

  const grandTotal = useMemo(
    () =>
      vendorTotals.reduce(
        (acc, v) => {
          acc.boxes += v.total_boxes;
          acc.amount += v.total_sales;
          return acc;
        },
        { boxes: 0, amount: 0 },
      ),
    [vendorTotals],
  );

  const chartData = useMemo(
    () =>
      vendorTotals.map((v) => ({
        name:
          v.vendor_name.length > 10
            ? v.vendor_name.slice(0, 9) + "…"
            : v.vendor_name,
        fullName: v.vendor_name,
        boxes: v.total_boxes,
        amount: Math.round(v.total_sales),
      })),
    [vendorTotals],
  );

  return (
    <div style={pageStyle}>
      <div className="dash-wrap" style={{ margin: "0 auto" }}>
        <div style={{ padding: "10px 6px 18px" }}>
          {onBack && (
            <button onClick={onBack} style={backBtnStyle}>
              <ArrowLeft size={14} /> back
            </button>
          )}
          <h1 style={titleStyle}>Dashboard</h1>
          <p style={subtitleStyle}>sales by vendor</p>
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
            <div className="dash-grid">
              <div style={cardStyle}>
                <div style={sectionLabelStyle}>
                  <TrendingUp size={13} /> Totals by vendor
                </div>
                {vendorTotals.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS_UI.inkSoft }}>
                    No orders match this filter.
                  </div>
                ) : (
                  vendorTotals.map((v) => (
                    <div
                      key={v.vendor_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderTop: "1px dashed rgba(28,28,30,0.14)",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {v.vendor_name}
                        </div>
                        <div
                          style={{ fontSize: 11.5, color: COLORS_UI.inkSoft }}
                        >
                          {v.order_count} order{v.order_count === 1 ? "" : "s"}{" "}
                          &middot; {v.total_boxes} boxes
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 17,
                          fontWeight: 700,
                          color: COLORS_UI.accentDark,
                        }}
                      >
                        {fmt(v.total_sales)}
                      </div>
                    </div>
                  ))
                )}
                {vendorTotals.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      paddingTop: 10,
                      marginTop: 4,
                      borderTop: "1.5px solid rgba(28,28,30,0.25)",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    <span>{grandTotal.boxes} boxes total</span>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {fmt(grandTotal.amount)}
                    </span>
                  </div>
                )}
              </div>

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

              <div style={cardStyle} className="dash-span-2">
                <div style={sectionLabelStyle}>
                  <BarChart3 size={13} /> Boxes &amp; sales by vendor
                </div>
                {chartData.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS_UI.inkSoft }}>
                    No orders match this filter.
                  </div>
                ) : (
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(28,28,30,0.1)"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                          axisLine={{ stroke: "rgba(28,28,30,0.15)" }}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                          allowDecimals={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          tickFormatter={compactNumber}
                        />
                        <Tooltip
                          formatter={(value, name, props) =>
                            props.dataKey === "amount"
                              ? [fmt(value), name]
                              : [value, name]
                          }
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.fullName || ""
                          }
                          contentStyle={{
                            background: "rgba(255,255,255,0.97)",
                            border: "1px solid rgba(28,28,30,0.15)",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{
                            color: "#1A1A1A",
                            fontWeight: 700,
                            marginBottom: 4,
                          }}
                          itemStyle={{ color: "#1A1A1A" }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="boxes"
                          fill="#B23A2E"
                          radius={[4, 4, 0, 0]}
                          name="Boxes"
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="amount"
                          fill="#8E6A3E"
                          radius={[4, 4, 0, 0]}
                          name="Amount"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    marginTop: 8,
                    fontSize: 11,
                    color: COLORS_UI.inkSoft,
                  }}
                >
                  <span>
                    <span style={{ color: "#B23A2E", fontWeight: 700 }}>■</span>{" "}
                    Boxes
                  </span>
                  <span>
                    <span style={{ color: "#8E6A3E", fontWeight: 700 }}>■</span>{" "}
                    Amount (₹)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

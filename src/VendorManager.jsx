import React, { useEffect, useState } from "react";
import { Trash2, Plus, ArrowLeft, Store, Check } from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  fetchVendors,
  createVendor,
  deleteVendor,
  updateVendorRates,
  fmt,
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  primaryBtn,
  COLORS_UI,
  titleStyle,
  subtitleStyle,
  backBtnStyle,
  useConfirm,
} from "./shared.jsx";

export default function VendorManager({ onBack }) {
  const { confirm, dialog } = useConfirm();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newAcrylicRate, setNewAcrylicRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingRates, setEditingRates] = useState({}); // vendorId -> { rate, acrylicRate } draft
  const [savedFlash, setSavedFlash] = useState(null); // vendorId briefly shown as saved

  async function load() {
    setLoading(true);
    try {
      setVendors(await fetchVendors());
    } catch (err) {
      setError("Couldn't load vendors: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    try {
      const v = await createVendor(
        name,
        newRate === "" ? null : parseFloat(newRate),
        newAcrylicRate === "" ? null : parseFloat(newAcrylicRate),
      );
      setVendors((vs) =>
        [...vs, v].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewName("");
      setNewRate("");
      setNewAcrylicRate("");
    } catch (err) {
      setError(
        err.message?.includes("duplicate")
          ? "That vendor already exists."
          : "Couldn't add vendor: " + err.message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v) {
    try {
      const { data, error: sumErr } = await supabase
        .from("box_items")
        .select("qty, total_price")
        .eq("vendor_id", v.id);
      if (sumErr) throw sumErr;
      const boxCount = data.reduce((sum, it) => sum + Number(it.qty || 0), 0);
      const total = data.reduce(
        (sum, it) => sum + Number(it.total_price || 0),
        0,
      );

      const message =
        boxCount > 0
          ? `${v.name} has ${boxCount} box${boxCount === 1 ? "" : "es"} worth ${fmt(total)} across its orders. Deleting this vendor will delete all of that history too. This can't be undone.`
          : `Delete ${v.name}? This can't be undone.`;

      const ok = await confirm({
        title: "Delete this vendor?",
        message,
        confirmLabel: "Delete vendor",
      });
      if (!ok) return;

      await deleteVendor(v.id);
      setVendors((vs) => vs.filter((x) => x.id !== v.id));
    } catch (err) {
      setError("Couldn't delete: " + err.message);
    }
  }

  function draftFor(v) {
    return (
      editingRates[v.id] ?? {
        rate: v.default_rate ?? "",
        acrylicRate: v.default_acrylic_rate ?? "",
      }
    );
  }

  function isDirty(v) {
    const d = draftFor(v);
    return (
      String(d.rate) !== String(v.default_rate ?? "") ||
      String(d.acrylicRate) !== String(v.default_acrylic_rate ?? "")
    );
  }

  async function handleRateSave(id) {
    const v = vendors.find((v) => v.id === id);
    const d = draftFor(v);
    const rate = d.rate === "" ? null : parseFloat(d.rate);
    const acrylicRate = d.acrylicRate === "" ? null : parseFloat(d.acrylicRate);
    try {
      const updated = await updateVendorRates(id, {
        defaultRate: rate,
        defaultAcrylicRate: acrylicRate,
      });
      setVendors((vs) => vs.map((v) => (v.id === id ? updated : v)));
      setSavedFlash(id);
      setTimeout(() => setSavedFlash(null), 1000);
    } catch (err) {
      setError("Couldn't update rates: " + err.message);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ padding: "10px 6px 18px" }}>
          {onBack && (
            <button onClick={onBack} style={backBtnStyle}>
              <ArrowLeft size={14} /> back
            </button>
          )}
          <h1 style={titleStyle}>Vendors</h1>
          <p style={subtitleStyle}>who your boxes come from</p>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>New vendor</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Vendor name"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Default rate / sq.in</label>
              <input
                type="number"
                inputMode="decimal"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="e.g. 2"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Default acrylic rate</label>
              <input
                type="number"
                inputMode="decimal"
                value={newAcrylicRate}
                onChange={(e) => setNewAcrylicRate(e.target.value)}
                placeholder="e.g. 0.6"
                style={inputStyle}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            style={primaryBtn}
          >
            <Plus size={18} /> Add vendor
          </button>
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
        ) : vendors.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              color: COLORS_UI.inkSoft,
            }}
          >
            <Store size={22} style={{ marginBottom: 6 }} />
            <div>No vendors yet. Add your first one above.</div>
          </div>
        ) : (
          vendors.map((v) => {
            const draft = draftFor(v);
            const dirty = isDirty(v);
            return (
              <div key={v.id} style={{ ...cardStyle, padding: "13px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {v.name}
                  </span>
                  <button
                    onClick={() => handleDelete(v)}
                    style={{
                      background: "none",
                      border: "none",
                      color: COLORS_UI.accent,
                      cursor: "pointer",
                    }}
                    aria-label={`Delete ${v.name}`}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: dirty || savedFlash === v.id ? 8 : 0,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Default rate / sq.in</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={draft.rate}
                      onChange={(e) =>
                        setEditingRates((r) => ({
                          ...r,
                          [v.id]: { ...draft, rate: e.target.value },
                        }))
                      }
                      placeholder="not set"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Default acrylic rate</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={draft.acrylicRate}
                      onChange={(e) =>
                        setEditingRates((r) => ({
                          ...r,
                          [v.id]: { ...draft, acrylicRate: e.target.value },
                        }))
                      }
                      placeholder="not set"
                      style={inputStyle}
                    />
                  </div>
                </div>
                {dirty && (
                  <button
                    onClick={() => handleRateSave(v.id)}
                    style={{ ...primaryBtn, padding: "10px" }}
                  >
                    <Check size={16} /> Save rates
                  </button>
                )}
                {savedFlash === v.id && !dirty && (
                  <span
                    style={{
                      fontSize: 11,
                      color: COLORS_UI.ok,
                      fontWeight: 700,
                    }}
                  >
                    saved
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {dialog}
    </div>
  );
}

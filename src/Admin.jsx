import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "./supabaseClient.js";
import {
  pageStyle,
  cardStyle,
  labelStyle,
  inputStyle,
  primaryBtn,
  titleStyle,
  subtitleStyle,
  backBtnStyle,
  COLORS_UI,
  useConfirm,
} from "./shared.jsx";

export default function Admin({ onBack, currentUserId }) {
  const { confirm, dialog } = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .order("created_at");
      if (error) throw error;
      setUsers(data);
    } catch (err) {
      setError("Couldn't load users: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function callAdmin(payload) {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: payload,
    });
    if (error) {
      let detail = error.message;
      try {
        if (error.context?.json) {
          const body = await error.context.json();
          detail = body?.error || detail;
        }
      } catch {
        /* fall back to error.message */
      }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await callAdmin({
        action: "create",
        email: newEmail.trim(),
        password: newPassword,
      });
      setNewEmail("");
      setNewPassword("");
      await load();
    } catch (err) {
      setError("Couldn't add user: " + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleRole(user) {
    const newRole = user.role === "admin" ? "staff" : "admin";
    try {
      await callAdmin({ action: "updateRole", userId: user.id, role: newRole });
      await load();
    } catch (err) {
      setError("Couldn't update role: " + err.message);
    }
  }

  async function handleDelete(user) {
    const ok = await confirm({
      title: "Remove this user?",
      message: `${user.email} will no longer be able to sign in. This can't be undone.`,
      confirmLabel: "Remove user",
    });
    if (!ok) return;
    try {
      await callAdmin({ action: "delete", userId: user.id });
      await load();
    } catch (err) {
      setError("Couldn't remove user: " + err.message);
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
          <h1 style={titleStyle}>Users</h1>
          <p style={subtitleStyle}>who can sign in</p>
        </div>

        <form onSubmit={handleCreate} style={cardStyle}>
          <label style={labelStyle}>New user's email</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <label style={labelStyle}>Temporary password</label>
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="they can change it later"
            required
            minLength={6}
            style={{ ...inputStyle, marginBottom: 12 }}
          />
          <button
            type="submit"
            disabled={creating}
            style={{ ...primaryBtn, opacity: creating ? 0.7 : 1 }}
          >
            <UserPlus size={16} /> {creating ? "Adding…" : "Add user"}
          </button>
        </form>

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
          users.map((u) => (
            <div
              key={u.id}
              style={{
                ...cardStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {u.role === "admin" ? (
                  <Shield
                    size={16}
                    color={COLORS_UI.accent}
                    style={{ flexShrink: 0 }}
                  />
                ) : (
                  <UserIcon
                    size={16}
                    color={COLORS_UI.inkSoft}
                    style={{ flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.email}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS_UI.inkSoft,
                      textTransform: "capitalize",
                    }}
                  >
                    {u.role}
                  </div>
                </div>
              </div>
              {u.id !== currentUserId && (
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleToggleRole(u)}
                    style={smallBtnStyle}
                  >
                    {u.role === "admin" ? "Make staff" : "Make admin"}
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    style={{ ...smallBtnStyle, color: COLORS_UI.accent }}
                    aria-label="Remove user"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {dialog}
    </div>
  );
}

const smallBtnStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--ink)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

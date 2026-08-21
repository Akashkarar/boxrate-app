import React, { useState } from "react";
import { Lock } from "lucide-react";
import {
  pageStyle,
  cardStyle,
  labelStyle,
  inputStyle,
  primaryBtn,
  titleStyle,
  subtitleStyle,
  COLORS_UI,
} from "./shared.jsx";

export default function Login({ signIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message || "Couldn't sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        ...pageStyle,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 380, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={titleStyle}>BoxRate</h1>
          <p style={subtitleStyle}>sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} style={cardStyle}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 12.5,
                color: COLORS_UI.accent,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...primaryBtn, opacity: loading ? 0.7 : 1 }}
          >
            <Lock size={16} /> {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

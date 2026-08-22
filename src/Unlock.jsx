import React, { useState, useEffect, useCallback } from "react";
import { Fingerprint, KeyRound } from "lucide-react";
import {
  pageStyle,
  cardStyle,
  primaryBtn,
  secondaryBtn,
  titleStyle,
  subtitleStyle,
  COLORS_UI,
} from "./shared.jsx";
import { verifyBiometric } from "./webauthn.js";

export default function Unlock({ onUnlocked, onUsePassword }) {
  const [status, setStatus] = useState("idle"); // idle | verifying | error
  const [error, setError] = useState("");

  const attempt = useCallback(async () => {
    setStatus("verifying");
    setError("");
    try {
      await verifyBiometric();
      onUnlocked();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't verify. Try again.");
    }
  }, [onUnlocked]);

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        ...pageStyle,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 360, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={titleStyle}>BoxRate</h1>
          <p style={subtitleStyle}>unlock to continue</p>
        </div>

        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--input-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "4px auto 14px",
            }}
          >
            <Fingerprint size={28} color={COLORS_UI.accent} />
          </div>

          <div
            style={{
              fontSize: 13.5,
              color: "var(--ink-soft)",
              marginBottom: 16,
            }}
          >
            {status === "verifying" && "Waiting for fingerprint / Face ID…"}
            {status === "idle" && "Ready to unlock"}
            {status === "error" && error}
          </div>

          <button
            onClick={attempt}
            disabled={status === "verifying"}
            style={{
              ...primaryBtn,
              opacity: status === "verifying" ? 0.7 : 1,
              marginBottom: 10,
            }}
          >
            <Fingerprint size={16} /> Try again
          </button>
          <button onClick={onUsePassword} style={secondaryBtn}>
            <KeyRound size={16} /> Use password instead
          </button>
        </div>
      </div>
    </div>
  );
}

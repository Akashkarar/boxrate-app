import React, { useState } from "react";
import { Fingerprint } from "lucide-react";
import { cardStyle, primaryBtn, secondaryBtn, COLORS_UI } from "./shared.jsx";
import { registerBiometric } from "./webauthn.js";

export default function BiometricPrompt({ onDone, onSkip }) {
  const [status, setStatus] = useState("idle"); // idle | working | error
  const [error, setError] = useState("");

  async function handleEnable() {
    setStatus("working");
    setError("");
    try {
      await registerBiometric(navigator.platform || "This device");
      onDone();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Couldn't set that up.");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 150,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          ...cardStyle,
          maxWidth: 360,
          width: "100%",
          margin: 0,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--input-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "4px auto 14px",
          }}
        >
          <Fingerprint size={26} color={COLORS_UI.accent} />
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            marginBottom: 8,
            color: "var(--ink)",
          }}
        >
          Use fingerprint or Face ID?
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.5,
            marginBottom: 18,
          }}
        >
          Skip typing your password next time you open the app on this device.
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
          onClick={handleEnable}
          disabled={status === "working"}
          style={{
            ...primaryBtn,
            opacity: status === "working" ? 0.7 : 1,
            marginBottom: 10,
          }}
        >
          <Fingerprint size={16} />{" "}
          {status === "working" ? "Setting up…" : "Enable"}
        </button>
        <button onClick={onSkip} style={secondaryBtn}>
          Not now
        </button>
      </div>
    </div>
  );
}

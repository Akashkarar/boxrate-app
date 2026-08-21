import React, { useState, useEffect } from "react";
import {
  Camera,
  LayoutDashboard,
  ClipboardList,
  Store,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import CapturePhoto from "./CapturePhoto.jsx";
import VerifyGrid from "./VerifyGrid.jsx";
import VendorManager from "./VendorManager.jsx";
import Dashboard from "./Dashboard.jsx";
import Orders from "./Orders.jsx";
import BatchDetail from "./BatchDetail.jsx";
import Login from "./Login.jsx";
import Admin from "./Admin.jsx";
import { useAuth } from "./auth.js";

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("boxrate-theme");
    if (saved) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("boxrate-theme", theme);
  }, [theme]);

  return [theme, setTheme];
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const { session, profile, loading, signIn, signOut } = useAuth();
  const [screen, setScreen] = useState("capture"); // capture | verify | vendors | dashboard | orders | batchDetail | admin
  const [extraction, setExtraction] = useState({ rows: null, vendor: null });
  const [openOrder, setOpenOrder] = useState(null); // { vendorId, batchDate } | null
  const [returnScreen, setReturnScreen] = useState("orders"); // where batchDetail's back button goes

  if (loading) {
    return <div style={{ minHeight: "100vh", background: "var(--page-bg)" }} />;
  }

  if (!session) {
    return <Login signIn={signIn} />;
  }

  function handleExtracted(rows, vendor) {
    setExtraction({ rows, vendor });
    setScreen("verify");
  }

  function openOrderDetail(vendorId, batchDate, from) {
    setOpenOrder({ vendorId, batchDate });
    setReturnScreen(from);
    setScreen("batchDetail");
  }

  let body;
  if (screen === "admin") {
    body = (
      <Admin
        onBack={() => setScreen("capture")}
        currentUserId={session.user.id}
      />
    );
  } else if (screen === "vendors") {
    body = <VendorManager onBack={() => setScreen("capture")} />;
  } else if (screen === "batchDetail") {
    body = (
      <BatchDetail
        vendorId={openOrder?.vendorId}
        batchDate={openOrder?.batchDate}
        onBack={() => setScreen(returnScreen)}
        onDeleted={() => setScreen(returnScreen)}
      />
    );
  } else if (screen === "orders") {
    body = (
      <Orders
        onBack={() => setScreen("capture")}
        onOpenOrder={(vendorId, batchDate) =>
          openOrderDetail(vendorId, batchDate, "orders")
        }
      />
    );
  } else if (screen === "dashboard") {
    body = <Dashboard onBack={() => setScreen("capture")} />;
  } else if (screen === "verify") {
    body = (
      <VerifyGrid
        initialRows={extraction.rows}
        initialVendor={extraction.vendor}
        onBack={() => setScreen("capture")}
        onSaved={() => {
          setExtraction({ rows: null, vendor: null });
          setScreen("capture");
        }}
      />
    );
  } else {
    body = (
      <CapturePhoto
        onExtracted={handleExtracted}
        onManageVendors={() => setScreen("vendors")}
      />
    );
  }

  const showNav = screen !== "verify";
  const isAdmin = profile?.role === "admin";

  return (
    <>
      {body}

      <div className="no-print" style={topRightStackStyle}>
        {isAdmin && (
          <button
            onClick={() => setScreen("admin")}
            aria-label="Manage users"
            style={iconStackBtnStyle}
          >
            <ShieldCheck size={16} />
          </button>
        )}
        <button
          onClick={signOut}
          aria-label="Sign out"
          style={iconStackBtnStyle}
        >
          <LogOut size={16} />
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
          style={iconStackBtnStyle}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {showNav && (
        <nav className="no-print" style={navWrapStyle}>
          <NavBtn
            icon={<Camera size={18} />}
            label="Scan"
            active={screen === "capture"}
            onClick={() => setScreen("capture")}
          />
          <NavBtn
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={screen === "dashboard"}
            onClick={() => setScreen("dashboard")}
          />
          <NavBtn
            icon={<ClipboardList size={18} />}
            label="Orders"
            active={screen === "orders" || screen === "batchDetail"}
            onClick={() => setScreen("orders")}
          />
          <NavBtn
            icon={<Store size={18} />}
            label="Vendors"
            active={screen === "vendors"}
            onClick={() => setScreen("vendors")}
          />
        </nav>
      )}
    </>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active ? "rgba(255,255,255,0.14)" : "transparent",
        border: "none",
        borderRadius: 22,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "9px 2px 8px",
        cursor: "pointer",
        color: active ? "#FF6B54" : "rgba(255,255,255,0.55)",
        transition: "background 0.18s, color 0.18s",
      }}
    >
      {icon}
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3 }}>
        {label}
      </span>
    </button>
  );
}

const navWrapStyle = {
  position: "fixed",
  left: 14,
  right: 14,
  bottom: "calc(14px + env(safe-area-inset-bottom))",
  background: "rgba(22,20,17,0.72)",
  backdropFilter: "blur(26px) saturate(180%)",
  WebkitBackdropFilter: "blur(26px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 30,
  display: "flex",
  padding: 6,
  gap: 4,
  boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  maxWidth: 460,
  margin: "0 auto",
};

const topRightStackStyle = {
  position: "fixed",
  top: "calc(14px + env(safe-area-inset-top))",
  right: 14,
  display: "flex",
  flexDirection: "row",
  gap: 8,
  zIndex: 50,
};

const iconStackBtnStyle = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(22,20,17,0.55)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
};

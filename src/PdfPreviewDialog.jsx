import React, { useEffect, useRef, useState } from "react";
import { X, Share2, Download } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cardStyle, COLORS_UI } from "./shared.jsx";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export default function PdfPreviewDialog({ blob, filename, onClose }) {
  const containerRef = useRef(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      setCanShareFiles(
        !!(navigator.canShare && navigator.canShare({ files: [file] })),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, [blob, filename]);

  // Android's WebView can't reliably show a PDF blob inline via <iframe> — it
  // just offers to "Open" the file externally. Rendering each page onto a
  // canvas ourselves (via pdf.js) gives a real in-app preview everywhere.
  useEffect(() => {
    let cancelled = false;
    async function render() {
      setLoading(true);
      setError("");
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        const containerWidth = containerRef.current.clientWidth || 340;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const unscaled = page.getViewport({ scale: 1 });
          const scale = (containerWidth / unscaled.width) * 2; // 2x for a crisp render
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.display = "block";
          canvas.style.marginBottom = i < pdf.numPages ? "10px" : "0";
          canvas.style.borderRadius = "8px";
          canvas.style.boxShadow = "0 2px 10px rgba(0,0,0,0.18)";
          if (cancelled) return;
          containerRef.current.appendChild(canvas);

          const ctx = canvas.getContext("2d");
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setError("Couldn't preview this PDF: " + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  async function handleShare() {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      await navigator.share({ files: [file], title: filename });
    } catch {
      // user cancelled the share sheet — nothing to do
    }
  }

  function handleDownload() {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={columnStyle}
        className="pdf-dialog-col"
      >
        <div style={{ ...cardStyle, ...dialogCardStyle }}>
          <div style={headerStyle}>
            <span
              style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}
            >
              Order PDF
            </span>
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
              <X size={18} color="var(--ink-soft)" />
            </button>
          </div>
          <div style={previewAreaStyle}>
            {loading && (
              <div
                style={{
                  padding: 30,
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  fontSize: 13,
                }}
              >
                Preparing preview…
              </div>
            )}
            {error && (
              <div
                style={{ padding: 20, color: COLORS_UI.accent, fontSize: 13 }}
              >
                {error}
              </div>
            )}
            <div ref={containerRef} />
          </div>
        </div>

        <div style={floatingRowStyle}>
          {canShareFiles && (
            <button
              onClick={handleShare}
              style={floatingBtnStyle}
              aria-label="Share"
            >
              <Share2 size={18} />
            </button>
          )}
          <button
            onClick={handleDownload}
            style={floatingBtnStyle}
            aria-label="Download"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 200,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const columnStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: 420,
};

const dialogCardStyle = {
  width: "100%",
  maxHeight: "calc(100vh - 200px)",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--card-border)",
  flexShrink: 0,
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "flex",
};

const previewAreaStyle = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
};

const floatingRowStyle = {
  display: "flex",
  gap: 20,
  marginTop: 18,
};

const floatingBtnStyle = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "1px solid var(--card-border)",
  background: "var(--card-bg)",
  backdropFilter: "blur(16px) saturate(160%)",
  WebkitBackdropFilter: "blur(16px) saturate(160%)",
  color: "var(--ink)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(0,0,0,0.3)",
};

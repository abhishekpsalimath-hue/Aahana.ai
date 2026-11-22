"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Aahana workspace render error", {
      message: error?.message || "Unknown workspace error",
      digest: error?.digest || null,
    });
  }, [error]);

  const details = [
    "Aahana workspace failed to load.",
    `Message: ${error?.message || "No message supplied"}`,
    `Reference: ${error?.digest || "not available"}`,
  ].join("\n");

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(details);
    } catch {}
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#090711", color: "#f4efff", fontFamily: "system-ui, sans-serif" }}>
      <section style={{ width: "min(100%, 520px)", padding: "28px", border: "1px solid rgba(196, 171, 255, .22)", borderRadius: "20px", background: "#14101f" }}>
        <p style={{ color: "#c7b3f4", marginTop: 0 }}>AAHANA AI · WORKSPACE</p>
        <h1 style={{ fontSize: "26px", marginBottom: "10px" }}>Your workspace hit an error</h1>
        <p style={{ color: "#c9c2d6", lineHeight: 1.6 }}>Your sign-in is separate from this loading issue. Your account and saved data have not been changed.</p>
        <div role="alert" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", padding: "12px", borderRadius: "10px", background: "#0c0913", color: "#e3d9f6", fontSize: "13px", lineHeight: 1.5 }}>{details}</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
          <button onClick={() => reset()} style={buttonStyle}>Try again</button>
          <button onClick={copyDetails} style={secondaryButtonStyle}>Copy error details</button>
          <a href="/login" style={{ color: "#c7b3f4", alignSelf: "center" }}>Back to sign in</a>
        </div>
      </section>
    </main>
  );
}

const buttonStyle = { border: 0, borderRadius: "10px", padding: "11px 16px", background: "#b9a0ef", color: "#170f25", fontWeight: 700 };
const secondaryButtonStyle = { border: "1px solid rgba(196, 171, 255, .35)", borderRadius: "10px", padding: "11px 16px", background: "transparent", color: "#f4efff" };

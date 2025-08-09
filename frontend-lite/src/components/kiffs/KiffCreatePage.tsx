"use client";
import React from "react";

// KiffCreatePage: minimal page to create a new Kiff via a single clickable tile
// Mirrors Storybook light version styling without touching global theme.

type Mode = "auto" | "light" | "dark";

export type KiffCreatePageProps = {
  onCreate?: () => void;
  isSubmitting?: boolean;
  mode?: Mode; // default "auto"; pass "light" to match Storybook ref
};

export const KiffCreatePage: React.FC<KiffCreatePageProps> = ({
  onCreate,
  isSubmitting = false,
  mode = "auto",
}) => {
  const isLight = mode === "light";
  const isDark = mode === "dark";

  const background = isLight
    ? "#ffffff"
    : isDark
    ? "#0B1220"
    : "var(--page-bg, transparent)";

  const surface = isLight ? "#ffffff" : "rgba(255,255,255,0.03)";
  const border = isLight ? "#E5E7EB" : "rgba(255,255,255,0.12)";
  const textMuted = isLight ? "#4B5563" : "rgba(255,255,255,0.75)";
  const brandStart = "var(--brand-500, #5B8CFF)";
  const brandEnd = "var(--brand-600, #4A78E7)";

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: 24,
        background,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Kiffs</h2>
        <p style={{ margin: "6px 0 0", color: textMuted, fontSize: 14 }}>
          Kiffs are integrations that combine Knowledge, APIs, and Agents built with Tools and MCPs.
        </p>
      </div>

      <button
        onClick={() => (isSubmitting ? null : onCreate?.())}
        disabled={isSubmitting}
        style={{
          appearance: "none",
          background: surface,
          color: "inherit",
          width: "100%",
          borderRadius: 12,
          border: `2px dashed ${border}`,
          padding: "36px 20px",
          display: "grid",
          placeItems: "center",
          cursor: isSubmitting ? "wait" : "pointer",
          transition: "border-color 0.2s ease, transform 0.06s ease",
        }}
      >
        <div style={{ display: "grid", placeItems: "center", gap: 10 }}>
          <div
            aria-hidden
            style={{
              height: 56,
              width: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${brandStart}, ${brandEnd})`,
              boxShadow: isLight
                ? "0 6px 24px rgba(91,140,255,0.25)"
                : "0 6px 24px rgba(91,140,255,0.35)",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            +
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>New Kiff</div>
            <div style={{ fontSize: 14, color: textMuted, marginTop: 4 }}>
              Click to create a Kiff integration. We’ll wire together your knowledge, APIs,
              agents, tools, and MCPs.
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default KiffCreatePage;

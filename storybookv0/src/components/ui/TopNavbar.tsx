import React from "react";

type NavLink = { id: string; label: string; href?: string; onClick?: () => void };

type TopNavbarProps = {
  brand?: React.ReactNode;
  links?: NavLink[];
  menus?: { id: string; label: string; items: NavLink[] }[]; // left dropdown menus
  rightMenus?: { id: string; label: string; items: NavLink[] }[]; // right dropdown menus
  onBurgerClick?: () => void;
};

export const TopNavbar: React.FC<TopNavbarProps> = ({ brand, links = [], menus = [], rightMenus = [], onBurgerClick }) => {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: isDark
          ? "1px solid #334155" // slate-700
          : "1px solid rgba(0,0,0,0.08)",
        background: isDark
          ? "#0f172a" // slate-900 solid
          : "#ffffff",
        backdropFilter: undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
        <button
          aria-label="Open menu"
          onClick={onBurgerClick}
          style={{
            height: 36,
            width: 36,
            borderRadius: 8,
            border: isDark
              ? "1px solid #334155" // slate-700
              : "1px solid rgba(0,0,0,0.08)",
            background: isDark
              ? "#1f2937" // slate-800
              : "#ffffff",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          ☰
        </button>
        <div style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>{brand}</div>
        <nav style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
          {links.map((l) => (
            <a
              key={l.id}
              href={l.href}
              onClick={l.onClick}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                opacity: 0.9,
              }}
            >
              {l.label}
            </a>
          ))}

          {menus.map((m) => (
            <details key={m.id} style={{ position: "relative" }}>
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 8,
                }}
              >
                {m.label} ▾
              </summary>
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  left: 0,
                  minWidth: 180,
                  borderRadius: 12,
                  border: isDark
                    ? "1px solid #334155" // slate-700
                    : "1px solid rgba(0,0,0,0.08)",
                  background: isDark
                    ? "#0f172a" // slate-900 solid
                    : "#ffffff",
                  padding: 8,
                  boxShadow: isDark
                    ? "0 10px 30px rgba(0,0,0,0.45)"
                    : "0 12px 28px rgba(0,0,0,0.12)",
                  backdropFilter: undefined,
                  zIndex: 60,
                }}
              >
                {m.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={it.onClick}
                    className={`w-full text-left px-3 py-2 rounded-[10px] transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-gray-100'}`}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: 'center' }}>
          {rightMenus.map((m) => (
            <details key={m.id} style={{ position: "relative" }}>
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: "8px 10px",
                  borderRadius: 8,
                }}
              >
                {m.label} ▾
              </summary>
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  minWidth: 180,
                  borderRadius: 12,
                  border: isDark
                    ? "1px solid #334155"
                    : "1px solid rgba(0,0,0,0.08)",
                  background: isDark
                    ? "#0f172a"
                    : "#ffffff",
                  padding: 8,
                  boxShadow: isDark
                    ? "0 10px 30px rgba(0,0,0,0.45)"
                    : "0 12px 28px rgba(0,0,0,0.12)",
                  backdropFilter: undefined,
                  zIndex: 60,
                }}
              >
                {m.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={it.onClick}
                    className={`w-full text-left px-3 py-2 rounded-[10px] transition-colors ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-gray-100'}`}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;

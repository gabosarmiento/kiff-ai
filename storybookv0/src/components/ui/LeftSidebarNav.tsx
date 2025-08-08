import React from "react";

export type NavItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  children?: NavItem[];
};

type LeftSidebarNavProps = {
  items: NavItem[];
  logo?: React.ReactNode;
  onSelect?: (id: string) => void;
  // Controlled collapsed state (for desktop)
  collapsed?: boolean;
  onToggleCollapsed?: (next: boolean) => void;
};

export const LeftSidebarNav: React.FC<LeftSidebarNavProps> = ({
  items,
  logo,
  onSelect,
  collapsed,
  onToggleCollapsed,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const isCollapsed = !!collapsed;

  // Flat, sectioned rendering (no nested collapsibles) to match reference
  const renderSectioned = (items: NavItem[]) => {
    return items.map((item) => {
      const hasChildren = !!(item.children && item.children.length > 0);
      if (hasChildren) {
        return (
          <div key={item.id} style={{ marginBottom: 10 }}>
            {/* Section header */}
            {!isCollapsed && (
              <div
                style={{
                  padding: "8px 12px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  color: isDark ? "rgba(226,232,240,0.65)" : "#475569", // slate-600 in light
                }}
              >
                {item.label}
              </div>
            )}
            {/* Section items (flat) */}
            <div>
              {item.children!.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelect?.(c.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: isCollapsed ? "10px 10px" : "10px 12px",
                    border: "none",
                    background: !isCollapsed && c.active ? "rgba(37,99,235,0.22)" : "transparent",
                    borderRadius: 8,
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  title={isCollapsed ? c.label : undefined}
                >
                  {!isCollapsed && <span style={{ flex: 1 }}>{c.label}</span>}
                </button>
              ))}
            </div>
          </div>
        );
      }
      // Single item (no children)
      return (
        <div key={item.id} style={{ marginBottom: 6 }}>
          <button
            onClick={() => onSelect?.(item.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isCollapsed ? "10px 10px" : "10px 12px",
              border: "none",
              background: !isCollapsed && item.active ? "rgba(37,99,235,0.22)" : "transparent",
              borderRadius: 8,
              color: "inherit",
              cursor: "pointer",
            }}
            title={isCollapsed ? item.label : undefined}
          >
            {!isCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
          </button>
        </div>
      );
    });
  };

  return (
    <aside
      style={{
        position: "relative",
        borderRight: isDark ? "1px solid #334155" : "1px solid rgba(0,0,0,0.08)",
        background: isDark ? "#0b1324" : "#ffffff",
        minWidth: isCollapsed ? 64 : 248,
        width: isCollapsed ? 64 : 248,
      }}
    >
      {/* Top bar with burger & logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: "12px 12px",
        }}
      >
        <button
          aria-label="Toggle navigation"
          onClick={() => onToggleCollapsed?.(!isCollapsed)}
          style={{
            height: 36,
            width: 36,
            borderRadius: 8,
            border: isDark ? "1px solid #334155" : "1px solid rgba(0,0,0,0.08)",
            background: isDark ? "#1f2937" : "#ffffff",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          ☰
        </button>
        {!isCollapsed && <div style={{ marginLeft: 8, flex: 1 }}>{logo}</div>}
        {/* Mobile menu button (separate state) */}
        <button
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          style={{
            height: 36,
            width: 36,
            borderRadius: 8,
            border: isDark ? "1px solid #334155" : "1px solid rgba(0,0,0,0.08)",
            background: isDark ? "#1f2937" : "#ffffff",
            color: "inherit",
            cursor: "pointer",
            display: "none",
          }}
        >
          ☰
        </button>
      </div>

      <div style={{ padding: "8px 10px" }}>{renderSectioned(items)}</div>

      {mobileOpen && (
        <div
          role="dialog"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "grid",
            gridTemplateColumns: "280px 1fr",
          }}
        >
          <div style={{ background: isDark ? "#111827" : "#ffffff", padding: 12 }}>
            {renderSectioned(items)}
          </div>
          <div />
        </div>
      )}
    </aside>
  );
};

export default LeftSidebarNav;

import React from "react";

type Section = {
  id: string;
  title: string;
  content?: React.ReactNode;
  defaultOpen?: boolean;
};

type RightStickySidebarProps = {
  sections?: Section[];
  topOffset?: number; // sticky offset from top
  width?: number; // px
};

export const RightStickySidebar: React.FC<RightStickySidebarProps> = ({
  sections = [],
  topOffset = 12,
  width = 300,
}) => {
  return (
    <aside
      style={{
        position: "sticky",
        top: topOffset,
        alignSelf: "start",
        width,
        padding: 12,
        borderLeft: "1px solid var(--border, rgba(255,255,255,0.08))",
      }}
    >
      {sections.map((s) => (
        <details key={s.id} open={s.defaultOpen} style={{ marginBottom: 10 }}>
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--surface, rgba(255,255,255,0.03))",
              border: "1px solid var(--border, rgba(255,255,255,0.12))",
              fontWeight: 600,
            }}
          >
            {s.title}
          </summary>
          <div style={{ padding: 10 }}>
            {s.content ?? (
              <div
                style={{
                  border: "1px dashed var(--border, rgba(127,127,127,0.35))",
                  borderRadius: 10,
                  padding: 12,
                  color: "inherit",
                  opacity: 0.85,
                }}
              >
                Empty
              </div>
            )}
          </div>
        </details>
      ))}
    </aside>
  );
};

export default RightStickySidebar;

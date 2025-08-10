import React from "react";

export type SlimNavItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  children?: SlimNavItem[];
};

type SlimLeftSidebarNavProps = {
  items: SlimNavItem[];
  logo?: React.ReactNode;
  onSelect?: (id: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: (next: boolean) => void;
  className?: string;
};

export const SlimLeftSidebarNav: React.FC<SlimLeftSidebarNavProps> = ({
  items,
  logo,
  onSelect,
  collapsed = false,
  onToggleCollapsed,
  className,
}) => {
  const isCollapsed = !!collapsed;

  const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
    </div>
  );

  const ItemButton: React.FC<{
    id: string;
    label: string;
    icon?: React.ReactNode;
    active?: boolean;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ id, label, icon, active, ...rest }) => (
    <button
      onClick={() => onSelect?.(id)}
      title={isCollapsed ? label : undefined}
      className={[
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        active ? "bg-blue-50 ring-1 ring-inset ring-blue-500/20 text-slate-900" : "hover:bg-slate-50 text-slate-700",
        isCollapsed ? "justify-center" : "justify-start"
      ].join(" ")}
      {...rest}
    >
      {icon && (
        <span
          className={[
            "inline-flex h-5 w-5 items-center justify-center text-slate-500",
            active ? "text-blue-600" : "group-hover:text-slate-700",
          ].join(" ")}
        >
          {icon}
        </span>
      )}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const renderSectioned = (items: SlimNavItem[]) => (
    <div className="space-y-3">
      {items.map((item) => {
        const hasChildren = !!(item.children && item.children.length > 0);
        if (hasChildren) {
          return (
            <div key={item.id} className="space-y-1">
              {!isCollapsed && <SectionHeader label={item.label} />}
              <div className="px-2">
                {item.children!.map((c) => (
                  <ItemButton key={c.id} id={c.id} label={c.label} icon={c.icon} active={c.active} />
                ))}
              </div>
            </div>
          );
        }
        return (
          <div key={item.id} className="px-2">
            <ItemButton id={item.id} label={item.label} icon={item.icon} active={item.active} />
          </div>
        );
      })}
    </div>
  );

  return (
    <aside
      className={[
        "h-full border-r border-slate-200 bg-white dark:bg-slate-900",
        "overflow-hidden",
        className || "",
      ].join(" ")}
    >
      {/* Sticky container so it doesn’t scroll away */}
      <div className="sticky top-0 h-screen overflow-auto">
        {/* Header with collapse toggle */}
        <div className={["flex items-center", isCollapsed ? "justify-center" : "justify-between", "px-3 py-3"].join(" ")}
        >
          <button
            aria-label="Toggle navigation"
            onClick={() => onToggleCollapsed?.(!isCollapsed)}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          >
            ☰
          </button>
          {!isCollapsed && <div className="ml-2 flex-1 truncate">{logo}</div>}
        </div>

        {/* Items */}
        <div className="px-0 pb-3 pt-1">
          {renderSectioned(items)}
        </div>
      </div>
    </aside>
  );
};

export default SlimLeftSidebarNav;

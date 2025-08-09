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
  const isCollapsed = !!collapsed;

  const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
      {label}
    </div>
  );

  const ItemButton: React.FC<{ id: string; label: string; icon?: React.ReactNode; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ id, label, icon, active, ...rest }) => (
    <button
      onClick={() => onSelect?.(id)}
      title={isCollapsed ? label : undefined}
      className={[
        'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
        active ? 'bg-blue-50 ring-1 ring-inset ring-blue-500/20 text-slate-900' : 'hover:bg-slate-50 text-slate-700',
        isCollapsed ? 'justify-center' : 'justify-start'
      ].join(' ')}
      {...rest}
    >
      {icon && (
        <span className={[
          'inline-flex h-5 w-5 items-center justify-center text-slate-500',
          active ? 'text-blue-600' : 'group-hover:text-slate-700'
        ].join(' ')}>
          {icon}
        </span>
      )}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  const renderSectioned = (items: NavItem[]) => (
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
        'fixed left-4 top-4 z-40 flex flex-col overflow-hidden border border-slate-200 bg-white/80 backdrop-blur shadow-lg',
        'rounded-2xl',
        isCollapsed ? 'w-[72px]' : 'w-[280px]',
        'h-[calc(100vh-2rem)]'
      ].join(' ')}
    >

      <div className={['flex items-center', isCollapsed ? 'justify-center' : 'justify-between', 'px-3 py-3'].join(' ')}>
        <button
          aria-label="Toggle navigation"
          onClick={() => onToggleCollapsed?.(!isCollapsed)}
          className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ☰
        </button>
        {!isCollapsed && <div className="ml-2 flex-1 truncate">{logo}</div>}
        <button
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="hidden h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ☰
        </button>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-slate-200/80 scrollbar-track-transparent flex-1 overflow-auto px-0 pb-3 pt-1">
        {renderSectioned(items)}
      </div>

      {mobileOpen && (
        <div
          role="dialog"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 grid grid-cols-[280px_1fr] bg-black/30"
        >
          <div className="bg-white p-3">{renderSectioned(items)}</div>
          <div />
        </div>
      )}
    </aside>
  );
};

export default LeftSidebarNav;

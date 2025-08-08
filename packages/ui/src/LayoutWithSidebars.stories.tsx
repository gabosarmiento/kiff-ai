import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { LeftSidebarNav, type NavItem } from "./LeftSidebarNav";
import { TopNavbar } from "./TopNavbar";
import { RightStickySidebar } from "./RightStickySidebar";

const meta: Meta = {
  title: "UI/Layout",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const sampleItems: NavItem[] = [
  { id: "home", label: "Home", active: true },
  {
    id: "kiffs",
    label: "Kiffs",
    children: [
      { id: "all", label: "All" },
      { id: "new", label: "Create" },
    ],
  },
  { id: "agents", label: "Agents" },
  { id: "knowledge", label: "Knowledge" },
];

// Helpers: Minimal, system-aligned UI blocks used inside the right sidebar
function SidebarTabs() {
  const [tab, setTab] = React.useState<"filters" | "lists" | "cards">("filters");
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-sm border-b border-gray-200/70 dark:border-white/10">
        {([
          { id: "filters", label: "Filters" },
          { id: "lists", label: "Lists" },
          { id: "cards", label: "Cards" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 -mb-px border-b-2 text-xs transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "filters" && (
        <div className="grid gap-3">
          {/* Dropdowns */}
          <label className="grid gap-1 text-sm">
            <span className="text-xs opacity-80">Type</span>
            <select className="p-2 rounded-md bg-transparent border border-gray-200/70 dark:border-white/10">
              <option>All</option>
              <option>Kiffs</option>
              <option>Agents</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs opacity-80">Sort</span>
            <select className="p-2 rounded-md bg-transparent border border-gray-200/70 dark:border-white/10">
              <option>Relevance</option>
              <option>Newest</option>
              <option>Updated</option>
            </select>
          </label>

          {/* Toggles */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Show archived</span>
            <input type="checkbox" className="accent-blue-600" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Only favorites</span>
            <input type="checkbox" className="accent-blue-600" />
          </div>

          {/* Accordions */}
          <details className="rounded-md border border-gray-200/70 dark:border-white/10">
            <summary className="cursor-pointer px-3 py-2 text-sm">Advanced filters</summary>
            <div className="px-3 pb-3 text-sm text-gray-600 dark:text-gray-400 grid gap-2">
              <label className="flex items-center justify-between">
                <span>Has errors</span>
                <input type="checkbox" className="accent-blue-600" />
              </label>
              <label className="flex items-center justify-between">
                <span>Needs review</span>
                <input type="checkbox" className="accent-blue-600" />
              </label>
            </div>
          </details>
        </div>
      )}

      {tab === "lists" && (
        <div className="grid gap-2">
          {["Alpha", "Beta", "Gamma", "Delta"].map((n) => (
            <div key={n} className="flex items-center justify-between p-2 rounded-md border border-gray-200/70 dark:border-white/10">
              <span className="text-sm text-gray-800 dark:text-gray-200">{n}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">tag</span>
            </div>
          ))}
        </div>
      )}

      {tab === "cards" && (
        <div className="grid gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="p-3 rounded-md border border-gray-200/70 dark:border-white/10">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Card {i}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Minimal descriptive text.</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 1) Minimal Top Navbar only
export const NavbarOnly: Story = {
  render: () => {
    const [collapsed, setCollapsed] = React.useState(false);
    return (
      <div className="h-screen grid grid-rows-[auto,1fr] bg-transparent">
        <TopNavbar
          brand={<span className="font-semibold">Kiff AI</span>}
          links={[{ id: "docs", label: "Docs", href: "#" }]}
          menus={[{ id: "account", label: "Account", items: [{ id: "logout", label: "Logout" }] }]}
          onBurgerClick={() => setCollapsed(!collapsed)}
        />
        <div className="p-6 text-sm text-gray-600 dark:text-gray-400">
          Burger on the right toggles the vertical sidebar in combined layouts. Collapsed: {String(collapsed)}
        </div>
      </div>
    );
  },
};

// 2) Minimal Left Sidebar only
export const LeftSidebarOnly: Story = {
  render: () => {
    const [collapsed, setCollapsed] = React.useState(false);
    return (
      <div className="h-screen grid grid-cols-[var(--ls,16rem)_1fr] bg-transparent">
        <div style={{ width: collapsed ? 64 : 256 }}>
          <LeftSidebarNav items={sampleItems} collapsed={collapsed} onToggleCollapsed={setCollapsed} />
        </div>
        <main className="p-6">
          <div className="h-[60vh] rounded-xl border border-gray-200/70 dark:border-white/10 grid place-items-center text-gray-700 dark:text-gray-300">
            Content Area
          </div>
        </main>
      </div>
    );
  },
};

// 3) Minimal Right Sidebar only (sticky)
export const RightSidebarOnly: Story = {
  render: () => {
    const [rightCollapsed, setRightCollapsed] = React.useState(false);
    return (
      <div
        className="h-screen grid bg-transparent"
        style={{ gridTemplateColumns: rightCollapsed ? '1fr 12px' : '1fr 22rem' }}
      >
        <main className="p-6 overflow-auto">
          <div className="h-[1200px] rounded-xl border border-gray-200/70 dark:border-white/10 grid place-items-center text-gray-700 dark:text-gray-300">
            Scroll to see the right sidebar stick
          </div>
        </main>
        {/* Right rail/panel */}
        <div
          className="relative h-full transition-[width] duration-300 ease-out overflow-hidden bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm border-l border-gray-200/70 dark:border-white/10"
        >
          <button
            aria-label={rightCollapsed ? "Open parameters" : "Collapse parameters"}
            title={rightCollapsed ? "Parameters" : "Collapse"}
            onClick={() => setRightCollapsed(v => !v)}
            className={`absolute right-0 translate-x-1/2 top-16 z-10 h-8 w-8 rounded-full border flex items-center justify-center transition-colors
              bg-white/70 dark:bg-white/5 backdrop-blur-sm
              border-gray-200/70 dark:border-white/10
              text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400`}
            style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            {rightCollapsed ? (
              // Sliders (Parameters) icon when collapsed
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M3 6.75A.75.75 0 0 1 3.75 6h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM16.5 6a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Zm-3 6a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 0 3h-1A1.5 1.5 0 0 1 13.5 12Zm3 3.75a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Z"/>
              </svg>
            ) : (
              // Chevron-left when expanded
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M14.53 5.47a.75.75 0 0 1 0 1.06L10.06 11l4.47 4.47a.75.75 0 0 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <div className="h-full">
            <div
              className={`sticky top-0 h-screen overflow-auto transition-transform duration-300 ease-out bg-white dark:bg-[#0b1324]/80`}
              style={{ transform: rightCollapsed ? 'translateX(100%)' : 'translateX(0)' }}
            >
              <div className="p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Controls</h3>
                <SidebarTabs />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

// 4) Combined: Top Navbar + Left & Right Sidebars (minimal, aligned)
export const SidebarsAndNavbar: Story = {
  render: () => {
    const [leftCollapsed, setLeftCollapsed] = React.useState(false);
    const [rightCollapsed, setRightCollapsed] = React.useState(false);
    return (
      <div className="h-screen grid grid-rows-[auto,1fr] bg-transparent">
        {/* Top navbar spanning full width */}
        <TopNavbar
          brand={<span className="font-semibold">Kiff AI</span>}
          links={[{ id: "docs", label: "Docs", href: "#" }]}
          menus={[{ id: "account", label: "Account", items: [{ id: "logout", label: "Logout" }] }]}
        />

        {/* Below the navbar: 3-column layout */}
        <div
          className="grid h-full overflow-hidden bg-white text-slate-900 dark:bg-[#070d1a] dark:text-gray-100"
          style={{ gridTemplateColumns: `${leftCollapsed ? '64px' : '16rem'} 1fr ${rightCollapsed ? '12px' : '22rem'}` }}
        >
          {/* Left sidebar */}
          <aside className="relative h-full border-r border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="sticky top-0 h-full p-2">
              <div className="h-full" style={{ width: leftCollapsed ? 64 : 256 }}>
                <LeftSidebarNav items={sampleItems} collapsed={leftCollapsed} onToggleCollapsed={setLeftCollapsed} />
              </div>
            </div>
          </aside>

          {/* Main content (only scrollable area) */}
          <main className="p-6 overflow-auto">
            <div className="h-[1200px] rounded-xl border border-gray-200/70 dark:border-white/10 grid place-items-center text-gray-700 dark:text-gray-300">
              Content Area (scroll to see sticky sidebars remain in place)
            </div>
          </main>

          {/* Right rail/panel */}
          <aside className="relative h-full transition-[width] duration-300 ease-out overflow-hidden bg-white dark:bg-slate-900 border-l border-gray-200/70 dark:border-slate-700">
            <button
              aria-label={rightCollapsed ? "Open parameters" : "Collapse parameters"}
              title={rightCollapsed ? "Parameters" : "Collapse"}
              onClick={() => setRightCollapsed(v => !v)}
              className={`absolute right-0 translate-x-1/2 top-16 z-10 h-8 w-8 rounded-full border flex items-center justify-center transition-colors
                bg-white dark:bg-slate-800
                border-gray-200/70 dark:border-slate-700
                text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400`}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              {rightCollapsed ? (
                // Sliders (Parameters) icon when collapsed
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M3 6.75A.75.75 0 0 1 3.75 6h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75ZM16.5 6a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Zm-3 6a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 0 3h-1A1.5 1.5 0 0 1 13.5 12Zm3 3.75a1.5 1.5 0 1 1 0 3h-1a1.5 1.5 0 0 1 0-3h1Z"/>
                </svg>
              ) : (
                // Chevron-left when expanded
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M14.53 5.47a.75.75 0 0 1 0 1.06L10.06 11l4.47 4.47a.75.75 0 0 1-1.06 1.06l-5-5a.75.75 0 0 1 0-1.06l5-5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            <div className="h-full">
              <div
                className={`sticky top-0 h-full overflow-auto transition-transform duration-300 ease-out bg-white dark:bg-slate-900`}
                style={{ transform: rightCollapsed ? 'translateX(100%)' : 'translateX(0)' }}
              >
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Controls</h3>
                  <SidebarTabs />
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Versions</h4>
                    <div className="grid gap-2 text-sm">
                      <label className="flex items-center justify-between">
                        <span>Stable</span>
                        <input type="radio" name="ver2" defaultChecked className="accent-blue-600" />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Beta</span>
                        <input type="radio" name="ver2" className="accent-blue-600" />
                      </label>
                      <label className="flex items-center justify-between">
                        <span>Experimental</span>
                        <input type="radio" name="ver2" className="accent-blue-600" />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  },
  name: "Sidebars + Navbar",
  parameters: { layout: "fullscreen" },
};


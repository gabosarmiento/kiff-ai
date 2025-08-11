"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, Puzzle, FlaskConical, BookOpen, Zap, User, LogOut, Settings } from "lucide-react";
import { LeftSidebarNav, type NavItem } from "./LeftSidebarNav";
import { useLayoutState } from "../layout/LayoutState";
import { useAuth } from "@/hooks/useAuth";

// Icon wrappers to avoid JSX typing issues with lucide-react
function createIconWrapper(C: any) {
  const Wrapped: React.FC<React.SVGProps<SVGSVGElement>> = (props) =>
    React.createElement(C as any, props as any);
  Wrapped.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return Wrapped;
}
const HomeIcon = createIconWrapper(Home);
const PuzzleIcon = createIconWrapper(Puzzle);
const FlaskConicalIcon = createIconWrapper(FlaskConical);
const BookOpenIcon = createIconWrapper(BookOpen);
const ZapIcon = createIconWrapper(Zap);
const UserIcon = createIconWrapper(User);
const LogOutIcon = createIconWrapper(LogOut);
const SettingsIcon = createIconWrapper(Settings);

const iconCls = "h-5 w-5";

const WORKSPACE_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/kiffs/create", label: "Dashboard", href: "/kiffs/create", icon: <HomeIcon className={iconCls} /> },
  { id: "/api-gallery", label: "API Gallery", href: "/api-gallery", icon: <PuzzleIcon className={iconCls} /> },
  { id: "/kb", label: "Knowledge Base", href: "/kb", icon: <BookOpenIcon className={iconCls} /> },
  { id: "/kiffs", label: "Kiffs", href: "/kiffs", icon: <ZapIcon className={iconCls} /> },
];

const ACCOUNT_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/account", label: "Account", href: "/account", icon: <UserIcon className={iconCls} /> },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useLayoutState();
  const { user } = useAuth();

  const mkChildren = (
    links: { id: string; label: string; href: string; icon?: React.ReactNode }[]
  ): NavItem[] =>
    links.map((l) => ({
      id: l.id,
      label: l.label,
      icon: l.icon,
      onClick: () => router.push(l.href),
      active: pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)),
    }));

  // Role-aware: if on /admin and user is admin, show only Users
  let items: NavItem[];
  if (pathname.startsWith("/admin") && user?.role === "admin") {
    const ADMIN_LINKS = [
      { id: "/admin/users", label: "Users", href: "/admin/users", icon: <UserIcon className={iconCls} /> },
      { id: "/admin/models", label: "Models", href: "/admin/models", icon: <SettingsIcon className={iconCls} /> },
      { id: "/admin/api-gallery-editor", label: "API Gallery Editor", href: "/admin/api-gallery-editor", icon: <PuzzleIcon className={iconCls} /> },
      { id: "/admin/extractor", label: "Extractor", href: "/admin/extractor", icon: <FlaskConicalIcon className={iconCls} /> },
    ];
    items = [
      { id: "admin", label: "Admin", children: mkChildren(ADMIN_LINKS) },
      { id: "account", label: "Account", children: mkChildren(ACCOUNT_LINKS) },
    ];
  } else {
    items = [
      { id: "workspace", label: "Workspace", children: mkChildren(WORKSPACE_LINKS) },
    ];
    if (user?.role === "admin") {
      const ADMIN_LINKS = [
        { id: "/admin/users", label: "Users", href: "/admin/users", icon: <UserIcon className={iconCls} /> },
        { id: "/admin/models", label: "Models", href: "/admin/models", icon: <SettingsIcon className={iconCls} /> },
        { id: "/admin/api-gallery-editor", label: "API Gallery Editor", href: "/admin/api-gallery-editor", icon: <PuzzleIcon className={iconCls} /> },
        { id: "/admin/extractor", label: "Extractor", href: "/admin/extractor", icon: <FlaskConicalIcon className={iconCls} /> },
      ];
      items.push({ id: "admin", label: "Admin", children: mkChildren(ADMIN_LINKS) });
    }
    items.push({ id: "account", label: "Account", children: mkChildren(ACCOUNT_LINKS) });
  }

  return (
    <LeftSidebarNav
      items={items}
      collapsed={collapsed}
      onToggleCollapsed={(next) => setCollapsed(next)}
      logo={<span className="font-semibold">Kiff</span>}
      onSelect={async (id) => {
        router.push(id);
      }}
    />
  );
}

export default Sidebar;

"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Puzzle, FlaskConical, BookOpen, Zap, User } from "lucide-react";
import { LeftSidebarNav, type NavItem } from "./LeftSidebarNav";
import { useLayoutState } from "../layout/LayoutState";
import { useAuth } from "@/hooks/useAuth";

// Small wrappers to avoid JSX typing issues with lucide-react in this workspace
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

// Preserve the original names and real URLs
const iconCls = "h-5 w-5";
const WORKSPACE_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/", label: "Dashboard", href: "/", icon: <HomeIcon className={iconCls} /> },
  { id: "/api-gallery", label: "API Gallery", href: "/api-gallery", icon: <PuzzleIcon className={iconCls} /> },
  { id: "/extractor", label: "Extractor", href: "/extractor", icon: <FlaskConicalIcon className={iconCls} /> },
  { id: "/kp", label: "Kiff Packs", href: "/kp", icon: <BookOpenIcon className={iconCls} /> },
  { id: "/kiffs", label: "Kiffs", href: "/kiffs", icon: <ZapIcon className={iconCls} /> },
];

const ACCOUNT_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/account", label: "Account", href: "/account", icon: <UserIcon className={iconCls} /> },
];

// DEPRECATED: Use Sidebar from './Sidebar'. Keeping the old implementation here temporarily.
function OldAppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useLayoutState();
  const { user } = useAuth();

  const mkChildren = (links: { id: string; label: string; href: string; icon?: React.ReactNode }[]): NavItem[] =>
    links.map((l) => ({
      id: l.id,
      label: l.label,
      icon: l.icon,
      active: pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)),
    }));

  // If on /admin routes and user is admin: show a minimal Admin-only sidebar with just Users
  let items: NavItem[];
  if (pathname.startsWith("/admin") && user?.role === "admin") {
    const ADMIN_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
      { id: "/admin/users", label: "Users", href: "/admin/users", icon: <UserIcon className={iconCls} /> },
    ];
    items = [{ id: "admin", label: "Admin", children: mkChildren(ADMIN_LINKS) }];
  } else {
    items = [
      { id: "workspace", label: "Workspace", children: mkChildren(WORKSPACE_LINKS) },
      { id: "account", label: "Account", children: mkChildren(ACCOUNT_LINKS) },
    ];
  }

  return (
    <LeftSidebarNav
      items={items}
      collapsed={collapsed}
      onToggleCollapsed={setCollapsed}
      onSelect={(id) => {
        // id is the href path by design
        if (id === "/") {
          if (user?.role === "admin") {
            router.push("/admin/users");
          } else {
            router.push("/kiffs/create");
          }
          return;
        }
        router.push(id);
      }}
      logo={<span className="text-sm font-semibold text-slate-900">Kiff</span>}
    />
  );
}

export { Sidebar as default, Sidebar as AppSidebar } from "./Sidebar";

"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Puzzle, FlaskConical, BookOpen, Zap, User } from "lucide-react";
import { LeftSidebarNav, type NavItem } from "./LeftSidebarNav";
import { useLayoutState } from "../layout/LayoutState";

// Preserve the original names and real URLs
const iconCls = "h-5 w-5";
const WORKSPACE_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/", label: "Dashboard", href: "/", icon: <Home className={iconCls} /> },
  { id: "/api-gallery", label: "API Gallery", href: "/api-gallery", icon: <Puzzle className={iconCls} /> },
  { id: "/extractor", label: "Extractor", href: "/extractor", icon: <FlaskConical className={iconCls} /> },
  { id: "/kb", label: "Knowledge Base", href: "/kb", icon: <BookOpen className={iconCls} /> },
  { id: "/kiffs", label: "Kiffs", href: "/kiffs", icon: <Zap className={iconCls} /> },
];

const ACCOUNT_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/account", label: "Account", href: "/account", icon: <User className={iconCls} /> },
];

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useLayoutState();

  const mkChildren = (links: { id: string; label: string; href: string; icon?: React.ReactNode }[]): NavItem[] =>
    links.map((l) => ({
      id: l.id,
      label: l.label,
      icon: l.icon,
      active: pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href)),
    }));

  const items: NavItem[] = [
    { id: "workspace", label: "Workspace", children: mkChildren(WORKSPACE_LINKS) },
    { id: "account", label: "Account", children: mkChildren(ACCOUNT_LINKS) },
  ];

  return (
    <LeftSidebarNav
      items={items}
      collapsed={collapsed}
      onToggleCollapsed={setCollapsed}
      onSelect={(id) => {
        // id is the href path by design
        router.push(id);
      }}
      logo={<span className="text-sm font-semibold text-slate-900">Kiff</span>}
    />
  );
}

export default AppSidebar;

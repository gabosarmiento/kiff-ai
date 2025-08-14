"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Home, FlaskConical, User, LogOut, Settings, Plus } from "lucide-react";
import { UsersThree, Folders, ShareNetwork } from "@phosphor-icons/react";
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
const ShareNetworkIcon = (props: any) => <ShareNetwork size={20} weight="duotone" {...props} />;
const FlaskConicalIcon = createIconWrapper(FlaskConical);
const UsersThreeIcon = (props: any) => <UsersThree size={20} weight="duotone" {...props} />;
const FoldersIcon = (props: any) => <Folders size={20} weight="duotone" {...props} />;
const UserIcon = createIconWrapper(User);
const LogOutIcon = createIconWrapper(LogOut);
const SettingsIcon = createIconWrapper(Settings);
const PlusIcon = createIconWrapper(Plus);
// Blue circular plus icon that fits within the existing 20x20 wrapper
const BluePlusCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    {...props}
  >
    <circle cx="10" cy="10" r="10" fill="#2563EB" />
    <path d="M10 5v10M5 10h10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const iconCls = "h-5 w-5";

const WORKSPACE_LINKS: { id: string; label: string; href: string; icon?: React.ReactNode }[] = [
  { id: "/kiffs/launcher", label: "New Kiff", href: "/kiffs/launcher", icon: <BluePlusCircleIcon className="h-5 w-5" /> },
  { id: "/api-gallery", label: "API Gallery", href: "/api-gallery", icon: <ShareNetworkIcon className={iconCls} /> },
  { id: "/kiffs/packs", label: "Kiff Packs", href: "/kiffs/packs", icon: <UsersThreeIcon className={iconCls} /> },
  { id: "/kiffs", label: "Kiffs", href: "/kiffs", icon: <FoldersIcon className={iconCls} /> },
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
    links.map((l) => {
      // Only one item should be active: the most specific match
      const isExact = pathname === l.href;
      const isPrefix = !isExact && l.href !== "/" && pathname.startsWith(l.href);
      return {
        id: l.id,
        label: l.label,
        icon: l.icon,
        active: isExact || isPrefix,
      };
    });

  // Role-aware: if on /admin and user is admin, show only Users
  let items: NavItem[];
  if (pathname.startsWith("/admin") && user?.role === "admin") {
    const ADMIN_LINKS = [
      { id: "/admin/users", label: "Users", href: "/admin/users", icon: <UserIcon className={iconCls} /> },
      { id: "/admin/models", label: "Models", href: "/admin/models", icon: <SettingsIcon className={iconCls} /> },
      { id: "/admin/api-gallery-editor", label: "API Gallery Editor", href: "/admin/api-gallery-editor", icon: <ShareNetworkIcon className={iconCls} /> },
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
        { id: "/admin/api-gallery-editor", label: "API Gallery Editor", href: "/admin/api-gallery-editor", icon: <ShareNetworkIcon className={iconCls} /> },
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
        // Special handling for New Kiff button - always include a timestamp param to force a fresh session
        if (id === "/kiffs/launcher") {
          router.push(`/kiffs/launcher?t=${Date.now()}`);
        } else {
          router.push(id);
        }
      }}
    />
  );
}

export default Sidebar;

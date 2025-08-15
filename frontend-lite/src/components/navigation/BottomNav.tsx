"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { User, Plus, Users, Folder, Share2 } from "lucide-react";

// Icon wrapper to avoid JSX typing issues
const createIconWrapper = (C: any) => {
  const Wrapped: React.FC<React.SVGProps<SVGSVGElement>> = (props) =>
    React.createElement(C as any, props as any);
  Wrapped.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return Wrapped;
};

const ShareIcon = createIconWrapper(Share2);
const UsersIcon = createIconWrapper(Users);
const FolderIcon = createIconWrapper(Folder);
const UserIcon = createIconWrapper(User);
const PlusIcon = createIconWrapper(Plus);

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "gallery",
    label: "Gallery",
    href: "/api-gallery",
    icon: <ShareIcon className="h-6 w-6" />,
  },
  {
    id: "packs",
    label: "Packs",
    href: "/kiffs/packs",
    icon: <UsersIcon className="h-6 w-6" />,
  },
  {
    id: "kiffs",
    label: "Kiffs",
    href: "/kiffs",
    icon: <FolderIcon className="h-6 w-6" />,
  },
  {
    id: "account",
    label: "Account",
    href: "/account",
    icon: <UserIcon className="h-6 w-6" />,
  },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };
  // Always show the center FAB, including on the launcher page
  const hideCenter = false;
  // Keep the center button position identical across pages

  return (
    <nav className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 h-16" style={{ zIndex: 1000, paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)', transform: 'translateZ(0)' }}>
      <div className="flex items-center justify-center w-full mx-auto relative h-full">
        {/* First 2 items */}
        <div className={`flex justify-end gap-1 w-[121px]`}>
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`group fx-pressable flex flex-col items-center justify-center w-14 shrink-0 px-1 py-1 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="mb-1 fx-icon">
                {item.icon}
              </div>
              <span className="bottomnav-label text-[11px] font-medium leading-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* Spacer to reserve room for the center FAB so side items don't collide */}
        <div aria-hidden className={`${hideCenter ? 'w-0' : 'w-20'} shrink-0 bottom-spacer`} />

        {/* Center elevated button (hidden on compose) */}
        {!hideCenter && (
          <button
            onClick={() => router.push('/kiffs/launcher')}
            aria-label="New Kiff"
            title="New Kiff"
            className="bottom-fab absolute left-1/2 transform -translate-x-1/2 -translate-y-6 bg-blue-600 text-white rounded-full shadow-lg w-12 h-12 flex items-center justify-center transition-all hover:bg-blue-700 hover:scale-105 fx-pressable"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        )}
        {/* Center overlay label (does not affect layout) */}
        {!hideCenter && (
          <div
            className="pointer-events-none select-none absolute left-1/2 transform -translate-x-1/2 text-[11px] font-semibold text-slate-700"
            style={{ bottom: '0px' }}
          >
            New KIFF
          </div>
        )}
        
        {/* Last 2 items */}
        <div className={`flex justify-start gap-1 w-[121px]`}>
          {NAV_ITEMS.slice(2).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`group fx-pressable flex flex-col items-center justify-center w-14 shrink-0 px-1 py-1 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="mb-1 fx-icon">
                {item.icon}
              </div>
              <span className="bottomnav-label text-[11px] font-medium leading-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default BottomNav;
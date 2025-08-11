"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Home, Puzzle, BookOpen, Zap, User, Plus } from "lucide-react";

// Icon wrapper to avoid JSX typing issues
const createIconWrapper = (C: any) => {
  const Wrapped: React.FC<React.SVGProps<SVGSVGElement>> = (props) =>
    React.createElement(C as any, props as any);
  Wrapped.displayName = `${C?.displayName || C?.name || "Icon"}Wrapper`;
  return Wrapped;
};

const HomeIcon = createIconWrapper(Home);
const PuzzleIcon = createIconWrapper(Puzzle);
const BookOpenIcon = createIconWrapper(BookOpen);
const ZapIcon = createIconWrapper(Zap);
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
    icon: <PuzzleIcon className="h-6 w-6" /> 
  },
  { 
    id: "packs", 
    label: "Packs", 
    href: "/kp", 
    icon: <BookOpenIcon className="h-6 w-6" /> 
  },
  { 
    id: "kiffs", 
    label: "Kiffs", 
    href: "/kiffs", 
    icon: <ZapIcon className="h-6 w-6" /> 
  },
  { 
    id: "account", 
    label: "Account", 
    href: "/account", 
    icon: <UserIcon className="h-6 w-6" /> 
  },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };
  const hideCenter = pathname?.startsWith('/kiffs/compose');
  const leftPad = hideCenter ? '' : ' pr-10';
  const rightPad = hideCenter ? '' : ' pl-10';
  // Keep the center button position identical across pages

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2 h-16">
      <div className="flex justify-between items-center max-w-md mx-auto relative h-full">
        {/* First 2 items */}
        <div className={`flex-1 flex justify-around${leftPad}`}>
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center min-w-0 px-1 py-1 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="mb-1">
                {item.icon}
              </div>
              <span className="text-xs font-medium leading-none">
                {item.label}
              </span>
            </button>
          ))}
        </div>
        {/* Center elevated button (hidden on compose) */}
        {!hideCenter && (
          <button
            onClick={() => router.push('/kiffs/compose')}
            aria-label="New Kiff"
            title="New Kiff"
            className="absolute left-1/2 transform -translate-x-1/2 -translate-y-6 bg-blue-600 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center transition-all hover:bg-blue-700 hover:scale-105"
          >
            <PlusIcon className="h-7 w-7" />
          </button>
        )}
        {/* Center overlay label (does not affect layout) */}
        {!hideCenter && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-0 text-[12px] font-semibold text-gray-700 select-none"
          >
            New Kiff
          </div>
        )}
        
        {/* Last 2 items */}
        <div className={`flex-1 flex justify-around${rightPad}`}>
          {NAV_ITEMS.slice(2).map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center justify-center min-w-0 px-1 py-1 rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="mb-1">
                {item.icon}
              </div>
              <span className="text-xs font-medium leading-none">
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
"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Home, Puzzle, BookOpen, Zap, User } from "lucide-react";

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

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { 
    id: "dashboard", 
    label: "Dashboard", 
    href: "/kiffs/create", 
    icon: <HomeIcon className="h-6 w-6" /> 
  },
  { 
    id: "gallery", 
    label: "Gallery", 
    href: "/api-gallery", 
    icon: <PuzzleIcon className="h-6 w-6" /> 
  },
  { 
    id: "knowledge", 
    label: "Knowledge", 
    href: "/kb", 
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
    if (href === "/kiffs/create") {
      return pathname === href || pathname === "/";
    }
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {NAV_ITEMS.map((item) => (
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
        {user?.role === 'admin' && (
          <button
            key="admin-editor"
            onClick={() => router.push('/admin/api-gallery-editor')}
            className={`flex flex-col items-center justify-center min-w-0 px-1 py-1 rounded-lg transition-colors ${
              pathname.startsWith('/admin/api-gallery-editor') ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="mb-1">
              <PuzzleIcon className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium leading-none">Editor</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default BottomNav;
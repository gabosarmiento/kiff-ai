"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type LayoutCtx = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
};

const Ctx = createContext<LayoutCtx | null>(null);

export function LayoutStateProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), []);
  const value = useMemo(() => ({ collapsed, toggleCollapsed, setCollapsed }), [collapsed, toggleCollapsed]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLayoutState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLayoutState must be used within LayoutStateProvider");
  return ctx;
}

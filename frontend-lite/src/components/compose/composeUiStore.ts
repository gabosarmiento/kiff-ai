"use client";
import { create } from "zustand";

export type Phase = 'idle'|'generating'|'reviewing'|'built'|'running'|'error';
export type PreviewTab = 'code'|'run'|'logs';

interface UiState {
  phase: Phase;
  sessionId?: string;
  selectedTab: PreviewTab;
  sidebarOpen: boolean;
  consoleOpen: boolean;
  setPhase: (p: Phase) => void;
  setSession: (id?: string) => void;
  setTab: (t: PreviewTab) => void;
  toggleSidebar: () => void;
  toggleConsole: () => void;
}

export const useComposeUi = create<UiState>((set) => ({
  phase: 'idle',
  selectedTab: 'code',
  sidebarOpen: true,
  consoleOpen: false,
  setPhase: (phase) => set({ phase }),
  setSession: (sessionId) => set({ sessionId }),
  setTab: (selectedTab) => set({ selectedTab }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
}));

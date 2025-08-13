'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PackContextType {
  selectedPacks: string[];
  addPack: (packId: string) => void;
  removePack: (packId: string) => void;
  clearPacks: () => void;
  setSelectedPacks: (packs: string[]) => void;
}

const PackContext = createContext<PackContextType | undefined>(undefined);

interface PackProviderProps {
  children: ReactNode;
}

export function PackProvider({ children }: PackProviderProps) {
  const [selectedPacks, setSelectedPacksState] = useState<string[]>([]);

  // Load selected packs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('selected_packs');
      if (saved) {
        const packs = JSON.parse(saved);
        if (Array.isArray(packs)) {
          setSelectedPacksState(packs);
        }
      }
    } catch (error) {
      console.warn('Failed to load selected packs from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever selectedPacks changes
  useEffect(() => {
    try {
      localStorage.setItem('selected_packs', JSON.stringify(selectedPacks));
    } catch (error) {
      console.warn('Failed to save selected packs to localStorage:', error);
    }
  }, [selectedPacks]);

  const addPack = (packId: string) => {
    setSelectedPacksState(prev => {
      if (prev.includes(packId)) return prev;
      return [...prev, packId];
    });
  };

  const removePack = (packId: string) => {
    setSelectedPacksState(prev => prev.filter(id => id !== packId));
  };

  const clearPacks = () => {
    setSelectedPacksState([]);
  };

  const setSelectedPacks = (packs: string[]) => {
    setSelectedPacksState(packs);
  };

  return (
    <PackContext.Provider value={{
      selectedPacks,
      addPack,
      removePack,
      clearPacks,
      setSelectedPacks
    }}>
      {children}
    </PackContext.Provider>
  );
}

export function usePacks() {
  const context = useContext(PackContext);
  if (context === undefined) {
    throw new Error('usePacks must be used within a PackProvider');
  }
  return context;
}
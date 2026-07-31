"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface TheaterModeState {
  isTheaterMode: boolean;
  enableTheaterMode: () => void;
  disableTheaterMode: () => void;
  toggleTheaterMode: () => void;
}

const TheaterModeContext = createContext<TheaterModeState | undefined>(undefined);

export function TheaterModeProvider({ children }: { children: ReactNode }) {
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  return (
    <TheaterModeContext.Provider value={{
      isTheaterMode,
      enableTheaterMode: () => setIsTheaterMode(true),
      disableTheaterMode: () => setIsTheaterMode(false),
      toggleTheaterMode: () => setIsTheaterMode(prev => !prev)
    }}>
      {children}
    </TheaterModeContext.Provider>
  );
}

export function useTheaterMode() {
  const context = useContext(TheaterModeContext);
  if (!context) throw new Error("useTheaterMode debe usarse dentro de un TheaterModeProvider");
  return context;
}
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { KEYS, load, save } from "@/services/storage";
import type { PantryItem } from "@/types";

interface PantryState {
  items: PantryItem[];
  addItem: (name: string, quantity?: string) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

const PantryContext = createContext<PantryState | null>(null);

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<PantryItem[]>([]);

  useEffect(() => {
    load<PantryItem[]>(KEYS.PANTRY, []).then(setItems);
  }, []);

  const addItem = useCallback((name: string, quantity?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems((prev) => {
      const alreadyExists = prev.some(
        (i) => i.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (alreadyExists) return prev;
      const next = [
        ...prev,
        { id: generateId(), name: trimmed, quantity, addedAt: new Date().toISOString() },
      ];
      save(KEYS.PANTRY, next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      save(KEYS.PANTRY, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    save(KEYS.PANTRY, []);
  }, []);

  const value = useMemo(
    () => ({ items, addItem, removeItem, clearAll }),
    [items, addItem, removeItem, clearAll]
  );

  return (
    <PantryContext.Provider value={value}>
      {children}
    </PantryContext.Provider>
  );
}

export function usePantry() {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be inside PantryProvider");
  return ctx;
}

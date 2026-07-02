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
import { getDaysUntilExpiry, isLowStock } from "@/utils/pantry";

interface PantryState {
  items: PantryItem[];
  isLoading: boolean;
  expiringItems: PantryItem[];
  lowStockItems: PantryItem[];
  addItem: (name: string, quantity?: string, expiryDate?: string) => void;
  updateItem: (id: string, updates: Partial<Omit<PantryItem, "id" | "addedAt">>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

const PantryContext = createContext<PantryState | null>(null);

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load<PantryItem[]>(KEYS.PANTRY, []).then((loaded) => {
      setItems(loaded);
      setIsLoading(false);
    });
  }, []);

  const addItem = useCallback((name: string, quantity?: string, expiryDate?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems((prev) => {
      const alreadyExists = prev.some(
        (i) => i.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (alreadyExists) return prev;
      const next = [
        ...prev,
        {
          id: generateId(),
          name: trimmed,
          quantity,
          expiryDate,
          addedAt: new Date().toISOString(),
        },
      ];
      save(KEYS.PANTRY, next);
      return next;
    });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<Omit<PantryItem, "id" | "addedAt">>) => {
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
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

  const expiringItems = useMemo(
    () =>
      items.filter((item) => {
        const days = getDaysUntilExpiry(item.expiryDate);
        return days !== null && days <= 3;
      }),
    [items]
  );

  const lowStockItems = useMemo(
    () => items.filter((item) => isLowStock(item.quantity)),
    [items]
  );

  const value = useMemo(
    () => ({ items, isLoading, expiringItems, lowStockItems, addItem, updateItem, removeItem, clearAll }),
    [items, isLoading, expiringItems, lowStockItems, addItem, updateItem, removeItem, clearAll]
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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  classifyIngredient,
  generateShoppingList,
  mergeShoppingLists,
} from "@/services/ShoppingListService";
import { KEYS, load, save } from "@/services/storage";
import type { Meal, PantryItem, ShoppingCategory, ShoppingList, ShoppingListItem } from "@/types";

interface ShoppingListState {
  list: ShoppingList | null;
  generateFromMeals: (meals: Meal[], pantryItems: PantryItem[]) => void;
  addItem: (name: string, quantity?: string) => void;
  toggleItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
}

const ShoppingListContext = createContext<ShoppingListState | null>(null);

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

export function ShoppingListProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<ShoppingList | null>(null);

  useEffect(() => {
    load<ShoppingList | null>(KEYS.SHOPPING_LIST, null).then(setList);
  }, []);

  const persist = useCallback((next: ShoppingList | null) => {
    setList(next);
    save(KEYS.SHOPPING_LIST, next);
  }, []);

  const generateFromMeals = useCallback(
    (meals: Meal[], pantryItems: PantryItem[]) => {
      const generated = generateShoppingList(meals, pantryItems);
      if (list) {
        persist(mergeShoppingLists(list, generated));
      } else {
        persist(generated);
      }
    },
    [list, persist]
  );

  const addItem = useCallback(
    (name: string, quantity?: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const base: ShoppingList = list ?? {
        id: makeId(),
        generatedAt: new Date().toISOString(),
        sourceMeals: [],
        items: [],
      };

      const alreadyExists = base.items.some(
        (i) => i.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (alreadyExists) return;

      const newItem: ShoppingListItem = {
        id: makeId(),
        name: trimmed,
        quantity,
        category: classifyIngredient(trimmed) as ShoppingCategory,
        checked: false,
        sourceRecipes: [],
        addedAt: new Date().toISOString(),
      };

      persist({ ...base, items: [...base.items, newItem] });
    },
    [list, persist]
  );

  const toggleItem = useCallback(
    (id: string) => {
      if (!list) return;
      const items = list.items.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i
      );
      persist({ ...list, items });
    },
    [list, persist]
  );

  const removeItem = useCallback(
    (id: string) => {
      if (!list) return;
      persist({ ...list, items: list.items.filter((i) => i.id !== id) });
    },
    [list, persist]
  );

  const clearChecked = useCallback(() => {
    if (!list) return;
    persist({ ...list, items: list.items.filter((i) => !i.checked) });
  }, [list, persist]);

  const clearAll = useCallback(() => {
    persist(null);
  }, [persist]);

  return (
    <ShoppingListContext.Provider
      value={{ list, generateFromMeals, addItem, toggleItem, removeItem, clearChecked, clearAll }}
    >
      {children}
    </ShoppingListContext.Provider>
  );
}

export function useShoppingList() {
  const ctx = useContext(ShoppingListContext);
  if (!ctx) throw new Error("useShoppingList must be inside ShoppingListProvider");
  return ctx;
}

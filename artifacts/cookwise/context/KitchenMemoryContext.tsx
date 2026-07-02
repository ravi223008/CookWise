/**
 * KitchenMemoryContext
 *
 * Wraps the KitchenMemoryRepository in a React context so components can read
 * memory state reactively and trigger mutations that propagate across the tree.
 *
 * The repository handles persistence; this context handles reactivity.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { memoryRepository } from "@/services/KitchenMemoryRepository";
import type {
  CookingHistoryEntry,
  DislikedIngredient,
  FamilyPreference,
  FavoriteMeal,
  KitchenMemory,
  KitchenMemorySnapshot,
  WeatherCondition,
} from "@/types";

// ── Default state (before AsyncStorage loads) ─────────────────────────────────

const DEFAULT_MEMORY: KitchenMemory = {
  favoriteMeals: [],
  dislikedIngredients: [],
  cookingHistory: [],
  stapleIngredients: [],
  rareIngredients: [],
  familyPreferences: [],
  lastUpdated: new Date().toISOString(),
};

// ── Context value ─────────────────────────────────────────────────────────────

export interface KitchenMemoryContextValue {
  memory: KitchenMemory;
  isLoading: boolean;

  // Favourites
  addFavorite: (meal: FavoriteMeal) => Promise<void>;
  removeFavorite: (mealId: string) => Promise<void>;

  // Disliked ingredients
  addDislikedIngredient: (ingredient: DislikedIngredient) => Promise<void>;
  removeDislikedIngredient: (name: string) => Promise<void>;

  // Cooking history
  addCookingHistoryEntry: (entry: CookingHistoryEntry) => Promise<void>;

  // Ingredient knowledge
  setStapleIngredients: (ingredients: string[]) => Promise<void>;
  setRareIngredients: (ingredients: string[]) => Promise<void>;

  // Household
  setFamilyPreferences: (prefs: FamilyPreference[]) => Promise<void>;

  // Context signals
  setWeather: (weather: WeatherCondition) => Promise<void>;

  // Snapshot (exposed for debugging / profile screens; consumed internally by ai.ts)
  buildSnapshot: (budget: string) => Promise<KitchenMemorySnapshot>;
}

const KitchenMemoryContext = createContext<KitchenMemoryContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function KitchenMemoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [memory, setMemory] = useState<KitchenMemory>(DEFAULT_MEMORY);
  const [isLoading, setIsLoading] = useState(true);

  /** Re-read from the repository and push the latest state to all subscribers. */
  const sync = useCallback(async () => {
    const latest = await memoryRepository.getMemory();
    setMemory(latest);
  }, []);

  // Initial load
  useEffect(() => {
    memoryRepository
      .getMemory()
      .then((mem) => setMemory(mem))
      .finally(() => setIsLoading(false));
  }, []);

  // ── Mutation helpers — each writes then syncs reactive state ───────────

  const addFavorite = useCallback(
    async (meal: FavoriteMeal) => {
      await memoryRepository.addFavorite(meal);
      await sync();
    },
    [sync],
  );

  const removeFavorite = useCallback(
    async (mealId: string) => {
      await memoryRepository.removeFavorite(mealId);
      await sync();
    },
    [sync],
  );

  const addDislikedIngredient = useCallback(
    async (ingredient: DislikedIngredient) => {
      await memoryRepository.addDislikedIngredient(ingredient);
      await sync();
    },
    [sync],
  );

  const removeDislikedIngredient = useCallback(
    async (name: string) => {
      await memoryRepository.removeDislikedIngredient(name);
      await sync();
    },
    [sync],
  );

  const addCookingHistoryEntry = useCallback(
    async (entry: CookingHistoryEntry) => {
      await memoryRepository.addCookingHistoryEntry(entry);
      await sync();
    },
    [sync],
  );

  const setStapleIngredients = useCallback(
    async (ingredients: string[]) => {
      await memoryRepository.setStapleIngredients(ingredients);
      await sync();
    },
    [sync],
  );

  const setRareIngredients = useCallback(
    async (ingredients: string[]) => {
      await memoryRepository.setRareIngredients(ingredients);
      await sync();
    },
    [sync],
  );

  const setFamilyPreferences = useCallback(
    async (prefs: FamilyPreference[]) => {
      await memoryRepository.setFamilyPreferences(prefs);
      await sync();
    },
    [sync],
  );

  const setWeather = useCallback(
    async (weather: WeatherCondition) => {
      await memoryRepository.setWeather(weather);
      await sync();
    },
    [sync],
  );

  const buildSnapshot = useCallback(
    (budget: string) => memoryRepository.buildSnapshot(budget),
    [],
  );

  const value = useMemo<KitchenMemoryContextValue>(
    () => ({
      memory,
      isLoading,
      addFavorite,
      removeFavorite,
      addDislikedIngredient,
      removeDislikedIngredient,
      addCookingHistoryEntry,
      setStapleIngredients,
      setRareIngredients,
      setFamilyPreferences,
      setWeather,
      buildSnapshot,
    }),
    [
      memory,
      isLoading,
      addFavorite,
      removeFavorite,
      addDislikedIngredient,
      removeDislikedIngredient,
      addCookingHistoryEntry,
      setStapleIngredients,
      setRareIngredients,
      setFamilyPreferences,
      setWeather,
      buildSnapshot,
    ],
  );

  return (
    <KitchenMemoryContext.Provider value={value}>
      {children}
    </KitchenMemoryContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useKitchenMemory(): KitchenMemoryContextValue {
  const ctx = useContext(KitchenMemoryContext);
  if (!ctx) {
    throw new Error("useKitchenMemory must be used inside KitchenMemoryProvider");
  }
  return ctx;
}

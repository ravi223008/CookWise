/**
 * KitchenMemoryRepository — AsyncStorage implementation.
 *
 * Exports the application-wide singleton `memoryRepository`.
 *
 * To migrate to a database backend (Supabase, Postgres, etc.):
 *   1. Implement the `KitchenMemoryRepository` interface from @/types.
 *   2. Replace the `memoryRepository` export below.
 *   No consumer code needs to change.
 */

import { KEYS, load, save } from "@/services/storage";
import type {
  CookingHistoryEntry,
  DislikedIngredient,
  FamilyPreference,
  FavoriteMeal,
  KitchenMemory,
  KitchenMemoryRepository,
  KitchenMemorySnapshot,
  WeatherCondition,
} from "@/types";

// ── Season helper ─────────────────────────────────────────────────────────────

function getCurrentSeason(): string {
  const m = new Date().getMonth(); // 0–11
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

// ── Cuisine frequency ─────────────────────────────────────────────────────────

function buildCuisineFrequency(
  history: CookingHistoryEntry[],
): Record<string, number> {
  const freq: Record<string, number> = {};
  // Only consider the last 60 meals — beyond that the signal is stale
  for (const entry of history.slice(0, 60)) {
    if (entry.cuisine) {
      freq[entry.cuisine] = (freq[entry.cuisine] ?? 0) + 1;
    }
  }
  return freq;
}

// ── Default state ─────────────────────────────────────────────────────────────

const DEFAULT_MEMORY: KitchenMemory = {
  favoriteMeals: [],
  dislikedIngredients: [],
  cookingHistory: [],
  stapleIngredients: [],
  rareIngredients: [],
  familyPreferences: [],
  lastUpdated: new Date().toISOString(),
};

// ── AsyncStorage implementation ───────────────────────────────────────────────

class AsyncStorageKitchenMemoryRepository implements KitchenMemoryRepository {
  /** Read from storage, back-filling any fields added in later schema versions. */
  private async read(): Promise<KitchenMemory> {
    const stored = await load<KitchenMemory>(KEYS.KITCHEN_MEMORY, DEFAULT_MEMORY);
    // Spread DEFAULT_MEMORY first so any field added after the user's stored data
    // was written is initialised to the correct default instead of undefined.
    return { ...DEFAULT_MEMORY, ...stored };
  }

  private async write(memory: KitchenMemory): Promise<void> {
    await save(KEYS.KITCHEN_MEMORY, {
      ...memory,
      lastUpdated: new Date().toISOString(),
    });
  }

  // ── Read / write ────────────────────────────────────────────────────────

  async getMemory(): Promise<KitchenMemory> {
    return this.read();
  }

  async saveMemory(memory: KitchenMemory): Promise<void> {
    return this.write(memory);
  }

  // ── Favourites ──────────────────────────────────────────────────────────

  async addFavorite(meal: FavoriteMeal): Promise<void> {
    const mem = await this.read();
    if (mem.favoriteMeals.some((m) => m.mealId === meal.mealId)) return;
    await this.write({
      ...mem,
      favoriteMeals: [meal, ...mem.favoriteMeals].slice(0, 100),
    });
  }

  async removeFavorite(mealId: string): Promise<void> {
    const mem = await this.read();
    await this.write({
      ...mem,
      favoriteMeals: mem.favoriteMeals.filter((m) => m.mealId !== mealId),
    });
  }

  // ── Disliked ingredients ────────────────────────────────────────────────

  async addDislikedIngredient(ingredient: DislikedIngredient): Promise<void> {
    const mem = await this.read();
    const already = mem.dislikedIngredients.some(
      (d) => d.name.toLowerCase() === ingredient.name.toLowerCase(),
    );
    if (already) return;
    await this.write({
      ...mem,
      dislikedIngredients: [...mem.dislikedIngredients, ingredient].slice(0, 200),
    });
  }

  async removeDislikedIngredient(name: string): Promise<void> {
    const mem = await this.read();
    await this.write({
      ...mem,
      dislikedIngredients: mem.dislikedIngredients.filter(
        (d) => d.name.toLowerCase() !== name.toLowerCase(),
      ),
    });
  }

  // ── Cooking history ─────────────────────────────────────────────────────

  async addCookingHistoryEntry(entry: CookingHistoryEntry): Promise<void> {
    const mem = await this.read();
    await this.write({
      ...mem,
      cookingHistory: [entry, ...mem.cookingHistory].slice(0, 200),
    });
  }

  // ── Context signals ─────────────────────────────────────────────────────

  async setWeather(weather: WeatherCondition): Promise<void> {
    const mem = await this.read();
    await this.write({ ...mem, weather });
  }

  // ── Ingredient knowledge ────────────────────────────────────────────────

  async setStapleIngredients(ingredients: string[]): Promise<void> {
    const mem = await this.read();
    await this.write({ ...mem, stapleIngredients: ingredients.slice(0, 100) });
  }

  async setRareIngredients(ingredients: string[]): Promise<void> {
    const mem = await this.read();
    await this.write({ ...mem, rareIngredients: ingredients.slice(0, 100) });
  }

  // ── Household ───────────────────────────────────────────────────────────

  async setFamilyPreferences(preferences: FamilyPreference[]): Promise<void> {
    const mem = await this.read();
    await this.write({ ...mem, familyPreferences: preferences.slice(0, 20) });
  }

  // ── Snapshot builder ────────────────────────────────────────────────────

  async buildSnapshot(budget: string): Promise<KitchenMemorySnapshot> {
    const mem = await this.read();

    // Consolidate all family members' hard allergies and soft dislikes
    const familyAllergies = [
      ...new Set(mem.familyPreferences.flatMap((fp) => fp.allergies)),
    ];
    const familyDislikes = [
      ...new Set(mem.familyPreferences.flatMap((fp) => fp.dislikes)),
    ];

    return {
      favoriteMealNames: mem.favoriteMeals.map((f) => f.mealName),
      dislikedIngredients: mem.dislikedIngredients.map((d) => d.name),
      recentlyCooked: mem.cookingHistory.slice(0, 20).map((h) => h.mealName),
      stapleIngredients: mem.stapleIngredients,
      rareIngredients: mem.rareIngredients,
      familyAllergies,
      familyDislikes,
      cuisineFrequency: buildCuisineFrequency(mem.cookingHistory),
      budget,
      season: getCurrentSeason(),
      weather: mem.weather
        ? {
            condition: mem.weather.condition,
            temperatureCelsius: mem.weather.temperatureCelsius,
            description: mem.weather.description,
          }
        : undefined,
    };
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

/**
 * Application-wide KitchenMemory repository singleton.
 *
 * Replace this export with a database-backed implementation to migrate away
 * from AsyncStorage — no consumer code needs to change.
 */
export const memoryRepository: KitchenMemoryRepository =
  new AsyncStorageKitchenMemoryRepository();

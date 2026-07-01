// ─────────────────────────────────────────────
// Core meal & pantry
// ─────────────────────────────────────────────

export interface Meal {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  missingIngredients: string[];
  readyIn: number;
  matchScore: number;
  matchReason?: string;
  cuisine: string;
  mood?: string;
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
}

export type PantryCategory =
  | "produce"
  | "dairy"
  | "meat"
  | "grains"
  | "canned"
  | "frozen"
  | "condiments"
  | "spices"
  | "bakery"
  | "beverages"
  | "other";

export type StorageLocation = "fridge" | "freezer" | "pantry" | "counter";

export interface PantryItem {
  id: string;
  name: string;
  quantity?: string;
  addedAt: string;
  purchaseDate?: string;
  expiryDate?: string;
  category?: PantryCategory;
  storageLocation?: StorageLocation;
}

// ─────────────────────────────────────────────
// Family members
// ─────────────────────────────────────────────

export type AgeGroup = "baby" | "toddler" | "child" | "teen" | "adult" | "senior";
export type SpiceLevel = "none" | "mild" | "medium" | "hot" | "extra-hot";

export interface FamilyMember {
  id: string;
  name: string;
  photo?: string;
  ageGroup: AgeGroup;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  spiceLevel: SpiceLevel;
  favoriteCuisines: string[];
}

// ─────────────────────────────────────────────
// User profile
// ─────────────────────────────────────────────

export interface UserProfile {
  name: string;
  allergies: string[];
  budget: "low" | "medium" | "high";
  familySize: number;
  preferredCuisines: string[];
}

export type Mood =
  | "tired"
  | "romantic"
  | "budget"
  | "protein"
  | "healthy"
  | "kids"
  | "guests"
  | null;

// ─────────────────────────────────────────────
// Cooking history
// ─────────────────────────────────────────────

export interface MealHistoryEntry {
  mealId: string;
  mealName: string;
  cookedAt: string;
}

export interface CookingHistoryEntry {
  mealId: string;
  mealName: string;
  cuisine: string;
  cookedAt: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

// ─────────────────────────────────────────────
// Kitchen memory
// ─────────────────────────────────────────────

export interface FavoriteMeal {
  mealId: string;
  mealName: string;
  cuisine: string;
  savedAt: string;
}

export interface DislikedIngredient {
  name: string;
  addedAt: string;
}

export interface WeatherCondition {
  condition: "sunny" | "cloudy" | "rainy" | "cold" | "hot" | "snowy" | "windy";
  temperatureCelsius: number;
  description: string;
  fetchedAt: string;
}

/**
 * KitchenMemory is the central memory object for a user's culinary profile.
 * Designed to be stored locally now, and swapped to a database repository later
 * without changing any consumer code — just swap the KitchenMemoryRepository impl.
 */
export interface KitchenMemory {
  userId?: string;
  favoriteMeals: FavoriteMeal[];
  dislikedIngredients: DislikedIngredient[];
  cookingHistory: CookingHistoryEntry[];
  weather?: WeatherCondition;
  lastUpdated: string;
}

/**
 * Snapshot passed to the API — only what the AI needs, not all raw data.
 * Keeps the API payload lean while still giving the chef full context.
 */
export interface KitchenMemorySnapshot {
  favoriteMealNames: string[];
  dislikedIngredients: string[];
  recentlyCooked: string[];
  weather?: Pick<WeatherCondition, "condition" | "temperatureCelsius" | "description">;
}

/**
 * Repository interface for KitchenMemory — designed for future DB integration.
 * Swap the AsyncStorage implementation below for a Supabase/Postgres adapter
 * without changing any context or component code.
 */
export interface KitchenMemoryRepository {
  getMemory(): Promise<KitchenMemory>;
  saveMemory(memory: KitchenMemory): Promise<void>;
  addFavorite(meal: FavoriteMeal): Promise<void>;
  removeFavorite(mealId: string): Promise<void>;
  addDislikedIngredient(ingredient: DislikedIngredient): Promise<void>;
  removeDislikedIngredient(name: string): Promise<void>;
  addCookingHistoryEntry(entry: CookingHistoryEntry): Promise<void>;
  setWeather(weather: WeatherCondition): Promise<void>;
}

// ─────────────────────────────────────────────
// Planner
// ─────────────────────────────────────────────

export interface WeekDay {
  key: string;
  label: string;
  short: string;
}

export const WEEK_DAYS: WeekDay[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

export type WeeklyPlan = Record<string, Meal | null>;

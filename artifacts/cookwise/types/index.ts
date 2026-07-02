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
  /** Chef's plain-English explanation of why this meal was chosen. */
  chefReason?: string;
  cuisine: string;
  mood?: string;
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
  /**
   * Only present when confidence < 70.
   * 2–3 backup meals the chef considered before settling on the primary pick.
   */
  alternatives?: Omit<Meal, "alternatives">[];
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
  | "comfort"
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

/**
 * Dietary preferences and restrictions for a single household member.
 * Stored in KitchenMemory so the AI can personalise for the whole family.
 */
export interface FamilyPreference {
  name: string;
  role: "adult" | "child" | "baby";
  /** Hard allergies — never include, same weight as profile.allergies. */
  allergies: string[];
  /** Soft dislikes — avoid where possible, but not absolute. */
  dislikes: string[];
  spiceLevel: "none" | "mild" | "medium" | "hot";
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

  // ── Meal history & preferences ──────────────────────────────────────────
  favoriteMeals: FavoriteMeal[];
  dislikedIngredients: DislikedIngredient[];
  /** Full cooking history — last 200 entries, newest first. */
  cookingHistory: CookingHistoryEntry[];

  // ── Ingredient knowledge ────────────────────────────────────────────────
  /**
   * Ingredients that are always stocked (staples).
   * The AI treats these as available and never marks them as "missing".
   * Examples: olive oil, garlic, onion, salt, pepper, butter, eggs.
   */
  stapleIngredients: string[];
  /**
   * Ingredients that are rarely available.
   * The AI avoids designing meals that depend on these.
   */
  rareIngredients: string[];

  // ── Household ───────────────────────────────────────────────────────────
  /**
   * Per-person dietary preferences for everyone in the household.
   * Allergies are consolidated to hard avoids; dislikes are soft signals.
   */
  familyPreferences: FamilyPreference[];

  // ── Context ─────────────────────────────────────────────────────────────
  weather?: WeatherCondition;
  lastUpdated: string;
}

/**
 * Snapshot passed to the API — only what the AI needs, not all raw data.
 * Keeps the API payload lean while still giving the chef full context.
 */
export interface KitchenMemorySnapshot {
  // ── Meals ──────────────────────────────────────────────────────────────
  /** Names of saved favourite meals — style and quality reference for the AI. */
  favoriteMealNames: string[];
  /** Ingredients the user never wants — absolute avoid alongside allergies. */
  dislikedIngredients: string[];
  /** Recent meal names from cooking history — AI avoids repeating these. */
  recentlyCooked: string[];

  // ── Ingredient knowledge ────────────────────────────────────────────────
  /** Always in the kitchen — never listed as missing by the AI. */
  stapleIngredients: string[];
  /** Rarely stocked — AI does not plan meals that depend on these. */
  rareIngredients: string[];

  // ── Household ───────────────────────────────────────────────────────────
  /** Consolidated hard allergies from all family members. */
  familyAllergies: string[];
  /** Consolidated soft dislikes from all family members. */
  familyDislikes: string[];

  // ── Behavioural signals ─────────────────────────────────────────────────
  /** Cuisine → count from cooking history; drives variety nudges in prompts. */
  cuisineFrequency: Record<string, number>;
  /** Budget level from profile — included so the server prompt has full context. */
  budget: string;
  /** Current season derived at snapshot time: spring | summer | autumn | winter. */
  season: string;

  // ── Context ─────────────────────────────────────────────────────────────
  weather?: Pick<WeatherCondition, "condition" | "temperatureCelsius" | "description">;
}

/**
 * Repository interface for KitchenMemory — designed for future DB integration.
 * Swap the AsyncStorage implementation below for a Supabase/Postgres adapter
 * without changing any context or component code.
 */
export interface KitchenMemoryRepository {
  // ── Read / write ────────────────────────────────────────────────────────
  getMemory(): Promise<KitchenMemory>;
  saveMemory(memory: KitchenMemory): Promise<void>;

  // ── Favourites ──────────────────────────────────────────────────────────
  addFavorite(meal: FavoriteMeal): Promise<void>;
  removeFavorite(mealId: string): Promise<void>;

  // ── Disliked ingredients ────────────────────────────────────────────────
  addDislikedIngredient(ingredient: DislikedIngredient): Promise<void>;
  removeDislikedIngredient(name: string): Promise<void>;

  // ── Cooking history ─────────────────────────────────────────────────────
  addCookingHistoryEntry(entry: CookingHistoryEntry): Promise<void>;

  // ── Context signals ─────────────────────────────────────────────────────
  setWeather(weather: WeatherCondition): Promise<void>;

  // ── Ingredient knowledge ────────────────────────────────────────────────
  setStapleIngredients(ingredients: string[]): Promise<void>;
  setRareIngredients(ingredients: string[]): Promise<void>;

  // ── Household ───────────────────────────────────────────────────────────
  setFamilyPreferences(preferences: FamilyPreference[]): Promise<void>;

  // ── Snapshot builder ────────────────────────────────────────────────────
  /**
   * Derives and returns a lean KitchenMemorySnapshot ready to be sent to the
   * API server as part of a meal recommendation request.
   *
   * @param budget - Current budget level from UserProfile.
   */
  buildSnapshot(budget: string): Promise<KitchenMemorySnapshot>;
}

// ─────────────────────────────────────────────
// Receipt scanner
// ─────────────────────────────────────────────

/**
 * Raw output from an OCR engine.
 * Populated by an OcrAdapter implementation — left empty until OCR is wired in.
 */
export interface OcrResult {
  rawText: string;
  imagePath: string;
  scannedAt: string;
  /** Adapter that produced this result, e.g. "google-vision", "aws-textract", "apple-vision" */
  adapterName: string;
  /** Overall confidence reported by the OCR engine (0–1). -1 if unavailable. */
  confidence: number;
}

/** A single line item extracted from a receipt. */
export interface ReceiptLineItem {
  /** The original, unmodified line from the OCR output. */
  raw: string;
  /** Cleaned, normalised item name ready for pantry insertion. */
  name: string;
  quantity?: number;
  unit?: string;
  price?: number;
  currency?: string;
  /** Parser confidence for this line (0–1). */
  confidence: number;
  /** True if heuristics suggest this is a non-food line (e.g. plastic bag, loyalty points). */
  isNonFood: boolean;
}

/** Structured representation of a scanned receipt. */
export interface ParsedReceipt {
  storeName?: string;
  storeAddress?: string;
  date?: string;
  items: ReceiptLineItem[];
  subtotal?: number;
  total?: number;
  currency?: string;
  parsedAt: string;
  /** Name of the parser strategy used. */
  parserStrategy: string;
}

/** Summary of what happened when a parsed receipt was applied to the pantry. */
export interface PantryUpdateResult {
  /** Items newly added to the pantry. */
  added: string[];
  /** Items that were already in the pantry (skipped to avoid duplicates). */
  skipped: string[];
  /** Items filtered out as non-food or unrecognisable. */
  ignored: string[];
  /** Any items that failed to save. */
  errors: string[];
}

// ─────────────────────────────────────────────
// Shopping list
// ─────────────────────────────────────────────

export type ShoppingCategory =
  | "vegetables"
  | "fruit"
  | "dairy"
  | "meat"
  | "frozen"
  | "pantry";

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity?: string;
  category: ShoppingCategory;
  checked: boolean;
  sourceRecipes: string[];
  addedAt: string;
}

export interface ShoppingList {
  id: string;
  generatedAt: string;
  sourceMeals: string[];
  items: ShoppingListItem[];
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

export interface Meal {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  missingIngredients: string[];
  readyIn: number;
  matchScore: number;
  cuisine: string;
  mood?: string;
  youtubeVideoId?: string;
  youtubeTitle?: string;
  youtubeThumbnail?: string;
}

export interface PantryItem {
  id: string;
  name: string;
  quantity?: string;
  addedAt: string;
}

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

export interface MealHistoryEntry {
  mealId: string;
  mealName: string;
  cookedAt: string;
}

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

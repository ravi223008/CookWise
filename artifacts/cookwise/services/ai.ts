import type { Meal, Mood, UserProfile } from "@/types";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface RecommendRequest {
  ingredients: string[];
  mood: Mood;
  recentMeals: string[];
  profile: UserProfile;
}

export async function getRecommendation(req: RecommendRequest): Promise<Meal> {
  const res = await fetch(`${BASE_URL}/api/meals/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to get recommendation");
  }

  return res.json() as Promise<Meal>;
}

export async function getWeeklyPlan(
  pantryItems: string[],
  profile: UserProfile,
  recentMeals: string[]
): Promise<Meal[]> {
  const res = await fetch(`${BASE_URL}/api/meals/weekly-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pantryItems, profile, recentMeals }),
  });

  if (!res.ok) throw new Error("Failed to generate weekly plan");
  return res.json() as Promise<Meal[]>;
}

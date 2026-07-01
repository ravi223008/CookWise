import type { Meal, Mood, UserProfile } from "@/types";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

/** Timeout for all AI API calls (ms). LLM calls can be slow; 30s is generous. */
const AI_TIMEOUT_MS = 30_000;

export interface RecommendRequest {
  ingredients: string[];
  mood: Mood;
  recentMeals: string[];
  profile: UserProfile;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getRecommendation(req: RecommendRequest): Promise<Meal> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}/api/meals/recommend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      },
      AI_TIMEOUT_MS,
    );
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("Network request failed")) {
      throw new Error("Unable to reach the server. Check your internet connection.");
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Server error (${res.status}). Please try again.`);
  }

  return res.json() as Promise<Meal>;
}

export async function getWeeklyPlan(
  pantryItems: string[],
  profile: UserProfile,
  recentMeals: string[],
): Promise<Meal[]> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${BASE_URL}/api/meals/weekly-plan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantryItems, profile, recentMeals }),
      },
      AI_TIMEOUT_MS,
    );
  } catch (err: unknown) {
    if (err instanceof TypeError && err.message.includes("Network request failed")) {
      throw new Error("Unable to reach the server. Check your internet connection.");
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Server error (${res.status}). Please try again.`);
  }

  return res.json() as Promise<Meal[]>;
}

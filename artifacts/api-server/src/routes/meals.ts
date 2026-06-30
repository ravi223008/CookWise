import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getOpenAI() {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

interface RecommendRequest {
  ingredients: string[];
  mood: string | null;
  recentMeals: string[];
  profile: {
    name: string;
    allergies: string[];
    budget: "low" | "medium" | "high";
    familySize: number;
    preferredCuisines: string[];
  };
}

const MOOD_CONTEXT: Record<string, string> = {
  tired: "simple, comforting, minimal effort required",
  romantic: "elegant, impressive, restaurant-quality",
  budget: "cheap, economical, uses basic pantry staples",
  protein: "high protein, muscle-building, filling",
  healthy: "nutritious, balanced, light",
  kids: "kid-friendly, mild, fun and simple",
  guests: "impressive, crowd-pleasing, shareable",
};

// ---------- Fallback meal bank ----------

const FALLBACK_MEALS = [
  {
    name: "Creamy Butter Chicken",
    description: "Rich, aromatic curry with tender chicken in a velvety tomato-cream sauce.",
    cuisine: "Indian",
    readyIn: 35,
    matchScore: 94,
    ingredients: ["chicken breast", "butter", "heavy cream", "tomato puree", "garlic", "ginger", "garam masala", "cumin", "rice"],
    mood: null,
  },
  {
    name: "Classic Spaghetti Carbonara",
    description: "Silky egg-and-cheese pasta with crispy pancetta — Roman comfort at its finest.",
    cuisine: "Italian",
    readyIn: 20,
    matchScore: 91,
    ingredients: ["spaghetti", "pancetta", "eggs", "parmesan", "black pepper", "garlic"],
    mood: null,
  },
  {
    name: "Teriyaki Salmon Bowl",
    description: "Glazed salmon over steamed rice with sesame-dressed greens.",
    cuisine: "Japanese",
    readyIn: 25,
    matchScore: 92,
    ingredients: ["salmon fillet", "soy sauce", "honey", "mirin", "rice", "cucumber", "sesame seeds", "spring onions"],
    mood: "healthy",
  },
  {
    name: "One-Pan Lemon Herb Chicken",
    description: "Juicy chicken thighs roasted with garlic, lemon, and fresh herbs.",
    cuisine: "Mediterranean",
    readyIn: 40,
    matchScore: 90,
    ingredients: ["chicken thighs", "lemon", "garlic", "rosemary", "thyme", "olive oil", "potatoes"],
    mood: null,
  },
  {
    name: "Veggie Stir-Fry with Noodles",
    description: "Crisp vegetables and noodles tossed in a savory umami sauce.",
    cuisine: "Chinese",
    readyIn: 15,
    matchScore: 88,
    ingredients: ["noodles", "broccoli", "bell pepper", "carrot", "soy sauce", "sesame oil", "garlic", "ginger"],
    mood: "healthy",
  },
  {
    name: "Avocado Toast with Poached Eggs",
    description: "Creamy smashed avocado on sourdough with perfectly poached eggs.",
    cuisine: "American",
    readyIn: 12,
    matchScore: 89,
    ingredients: ["sourdough bread", "avocado", "eggs", "lemon", "chilli flakes", "salt", "pepper"],
    mood: "tired",
  },
  {
    name: "Black Bean Tacos",
    description: "Smoky spiced black beans in warm tortillas with fresh salsa.",
    cuisine: "Mexican",
    readyIn: 18,
    matchScore: 87,
    ingredients: ["tortillas", "black beans", "tomato", "onion", "coriander", "cumin", "lime", "avocado"],
    mood: "budget",
  },
  {
    name: "Honey Garlic Shrimp",
    description: "Succulent shrimp glazed in honey-garlic butter, ready in minutes.",
    cuisine: "American",
    readyIn: 15,
    matchScore: 93,
    ingredients: ["shrimp", "honey", "garlic", "butter", "soy sauce", "parsley", "rice"],
    mood: "romantic",
  },
  {
    name: "Greek Chicken Souvlaki",
    description: "Marinated grilled chicken with tzatziki and warm pita.",
    cuisine: "Greek",
    readyIn: 30,
    matchScore: 91,
    ingredients: ["chicken breast", "lemon", "oregano", "olive oil", "garlic", "pita", "cucumber", "yoghurt"],
    mood: "guests",
  },
  {
    name: "Beef & Broccoli",
    description: "Tender beef strips and broccoli in a rich oyster sauce over rice.",
    cuisine: "Chinese",
    readyIn: 22,
    matchScore: 90,
    ingredients: ["beef sirloin", "broccoli", "oyster sauce", "soy sauce", "garlic", "ginger", "sesame oil", "rice"],
    mood: "protein",
  },
  {
    name: "Mac and Cheese",
    description: "Ultra-creamy baked mac with a golden breadcrumb crust.",
    cuisine: "American",
    readyIn: 30,
    matchScore: 96,
    ingredients: ["macaroni", "cheddar", "butter", "flour", "milk", "mustard", "breadcrumbs"],
    mood: "kids",
  },
];

function getFallbackMeal(mood: string | null, allergies: string[], pantryIngredients: string[]) {
  // Filter by mood if one is selected
  const moodMatches = mood ? FALLBACK_MEALS.filter((m) => m.mood === mood) : [];
  const pool = moodMatches.length > 0 ? moodMatches : FALLBACK_MEALS;

  // Pick deterministically but vary by time-of-day
  const hour = new Date().getHours();
  const picked = pool[hour % pool.length]!;

  // Calculate missing ingredients from pantry
  const pantrySet = new Set(pantryIngredients.map((i) => i.toLowerCase()));
  const missingIngredients = pantryIngredients.length > 0
    ? picked.ingredients.filter((ing) => !pantrySet.has(ing.toLowerCase())).slice(0, 3)
    : [];

  return {
    id: generateId(),
    ...picked,
    missingIngredients,
    mood: mood ?? undefined,
  };
}

// ---------- Weekly plan fallback ----------

// ---------- YouTube helper ----------

async function fetchYouTubeVideo(mealName: string): Promise<{
  youtubeVideoId: string | null;
  youtubeTitle: string | null;
  youtubeThumbnail: string | null;
}> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) return { youtubeVideoId: null, youtubeTitle: null, youtubeThumbnail: null };
  try {
    const q = encodeURIComponent(`how to make ${mealName} recipe`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=1&key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return { youtubeVideoId: null, youtubeTitle: null, youtubeThumbnail: null };
    const data = (await resp.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; thumbnails: { medium: { url: string } } };
      }>;
    };
    const item = data.items?.[0];
    if (!item) return { youtubeVideoId: null, youtubeTitle: null, youtubeThumbnail: null };
    return {
      youtubeVideoId: item.id.videoId,
      youtubeTitle: item.snippet.title,
      youtubeThumbnail: item.snippet.thumbnails?.medium?.url ?? null,
    };
  } catch {
    return { youtubeVideoId: null, youtubeTitle: null, youtubeThumbnail: null };
  }
}

function getFallbackWeeklyPlan(): any[] {
  const shuffled = [...FALLBACK_MEALS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 7).map((m) => ({
    id: generateId(),
    ...m,
    missingIngredients: [],
  }));
}

/**
 * POST /api/meals/recommend
 * Returns a single AI-recommended meal
 */
router.post("/recommend", async (req, res) => {
  const body = req.body as RecommendRequest;
  const { ingredients, mood, recentMeals, profile } = body;

  const moodHint = mood ? MOOD_CONTEXT[mood] ?? "" : "";
  const budgetMap = { low: "under $10", medium: "$10-25", high: "any budget" };
  const budgetHint = budgetMap[profile.budget] ?? "$10-25";

  const prompt = `You are CookWise, an AI dinner decision assistant. Your job is to recommend ONE specific meal.

Context:
- User name: ${profile.name}
- Family size: ${profile.familySize} people
- Budget: ${budgetHint} per meal
- Allergies/restrictions: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "none"}
- Preferred cuisines: ${profile.preferredCuisines.length > 0 ? profile.preferredCuisines.join(", ") : "any"}
- Tonight's mood: ${mood ? `${mood} (${moodHint})` : "no preference"}
- Available pantry ingredients: ${ingredients.length > 0 ? ingredients.join(", ") : "basic pantry staples (salt, pepper, oil, common spices)"}
- Recently cooked (avoid repeating): ${recentMeals.length > 0 ? recentMeals.join(", ") : "none"}

Recommend exactly ONE meal that best fits. Be specific and confident — pick ONE meal, not options.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "name": "Meal Name",
  "description": "One enticing sentence describing the dish (max 100 chars)",
  "cuisine": "Cuisine type",
  "readyIn": 30,
  "matchScore": 94,
  "ingredients": ["ingredient 1", "ingredient 2", "..."],
  "missingIngredients": ["ingredients from the list above that the user doesn't have"]
}

Rules:
- matchScore is 85-99 (how well this meal fits the context)
- readyIn is realistic cooking time in minutes
- ingredients should be a complete list needed for this meal (5-12 items)
- missingIngredients must be a subset of ingredients that are NOT in the pantry list
- Keep it practical and achievable for a home cook`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.8,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const yt = await fetchYouTubeVideo(parsed.name);
    const meal = {
      id: generateId(),
      name: parsed.name,
      description: parsed.description,
      cuisine: parsed.cuisine,
      readyIn: Number(parsed.readyIn) || 30,
      matchScore: Number(parsed.matchScore) || 90,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      missingIngredients: Array.isArray(parsed.missingIngredients)
        ? parsed.missingIngredients
        : [],
      mood: mood ?? undefined,
      ...yt,
    };

    res.json(meal);
  } catch {
    // Fallback to curated meals when AI is unavailable (quota, no key, network)
    const fallback = getFallbackMeal(mood, profile.allergies, ingredients);
    const yt = await fetchYouTubeVideo(fallback.name);
    res.json({ ...fallback, ...yt });
  }
});

/**
 * POST /api/meals/weekly-plan
 * Returns 7 meals for a weekly plan
 */
router.post("/weekly-plan", async (req, res) => {
  const { pantryItems, profile, recentMeals } = req.body as {
    pantryItems: string[];
    profile: RecommendRequest["profile"];
    recentMeals: string[];
  };

  const budgetMap = { low: "under $10", medium: "$10-25", high: "any budget" };
  const budgetHint = budgetMap[profile.budget] ?? "$10-25";

  const prompt = `You are CookWise. Generate a 7-day dinner meal plan.

Context:
- Family size: ${profile.familySize} people
- Budget: ${budgetHint} per meal
- Allergies: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "none"}
- Preferred cuisines: ${profile.preferredCuisines.length > 0 ? profile.preferredCuisines.join(", ") : "any"}
- Pantry items: ${pantryItems.length > 0 ? pantryItems.join(", ") : "basic staples"}
- Recently cooked (avoid): ${recentMeals.length > 0 ? recentMeals.join(", ") : "none"}

Respond with ONLY valid JSON array of exactly 7 meals:
[
  {
    "name": "Meal Name",
    "description": "One sentence description",
    "cuisine": "Cuisine type",
    "readyIn": 30,
    "matchScore": 90,
    "ingredients": ["ing1", "ing2"],
    "missingIngredients": ["missing1"]
  }
]

Vary the cuisines. Keep meals practical for home cooking.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.9,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");

    const parsed = JSON.parse(jsonMatch[0]);
    const meals = (Array.isArray(parsed) ? parsed : []).slice(0, 7).map((m: any) => ({
      id: generateId(),
      name: m.name ?? "Meal",
      description: m.description ?? "",
      cuisine: m.cuisine ?? "International",
      readyIn: Number(m.readyIn) || 30,
      matchScore: Number(m.matchScore) || 85,
      ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
      missingIngredients: Array.isArray(m.missingIngredients) ? m.missingIngredients : [],
    }));

    res.json(meals);
  } catch {
    res.json(getFallbackWeeklyPlan());
  }
});

export default router;

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
    };

    res.json(meal);
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    if (msg.includes("OPENAI_API_KEY")) {
      res.status(503).json({ error: "OpenAI API key not configured. Add OPENAI_API_KEY to your environment secrets." });
    } else {
      res.status(500).json({ error: `AI recommendation failed: ${msg}` });
    }
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
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    if (msg.includes("OPENAI_API_KEY")) {
      res.status(503).json({ error: "OpenAI API key not configured." });
    } else {
      res.status(500).json({ error: `Weekly plan failed: ${msg}` });
    }
  }
});

export default router;

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

const MOOD_CONTEXT: Record<string, { vibe: string; effort: string; style: string }> = {
  tired: {
    vibe: "exhausted after a long day",
    effort: "minimal — 15-25 min, one pan, very simple steps",
    style: "comforting, familiar, no complicated techniques",
  },
  romantic: {
    vibe: "planning a special evening for two",
    effort: "worth the extra effort — 30-45 min, feels restaurant-quality",
    style: "elegant, beautifully presented, a little indulgent",
  },
  budget: {
    vibe: "watching spending this week",
    effort: "practical — 20-30 min, economical ingredients, zero waste",
    style: "hearty and satisfying without expensive items",
  },
  protein: {
    vibe: "focused on fitness and fuelling well",
    effort: "straightforward — 20-35 min, high-protein focus",
    style: "substantial, macro-conscious, filling",
  },
  healthy: {
    vibe: "wanting to eat clean and feel good",
    effort: "light — 15-30 min, fresh ingredients",
    style: "nutritious, balanced macros, light on heavy fats",
  },
  kids: {
    vibe: "feeding the whole family including picky eaters",
    effort: "simple — 20-30 min, crowd-pleasing",
    style: "mild, fun, universally loved flavours — no exotic ingredients",
  },
  guests: {
    vibe: "impressing people coming over for dinner",
    effort: "worth it — 40-60 min, impressive but achievable",
    style: "shareable, centrepiece dish, visually stunning",
  },

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

function getTimeOfDayContext(): string {
  const h = new Date().getHours();
  if (h < 11) return "morning (breakfast or brunch)";
  if (h < 15) return "midday (lunch)";
  if (h < 18) return "late afternoon (early dinner)";
  return "evening (dinner)";
}


/**
 * POST /api/meals/recommend
 * Returns a single AI-recommended meal
 */
router.post("/recommend", async (req, res) => {
  const body = req.body as RecommendRequest;
  const { ingredients, mood, recentMeals, profile } = body;

  const moodCtx = mood ? MOOD_CONTEXT[mood] : null;
  const budgetMap = { low: "under $10 per meal", medium: "$10–25 per meal", high: "no budget constraint" };
  const budgetHint = budgetMap[profile.budget] ?? "$10–25 per meal";
  const timeOfDay = getTimeOfDayContext();

  const hasPantry = ingredients.length > 0;
  const hasCuisinePrefs = profile.preferredCuisines.length > 0;
  const hasAllergies = profile.allergies.length > 0;
  const hasRecentMeals = recentMeals.length > 0;

  const systemPrompt = `You are the user's personal AI Chef — not a recipe search engine. You think deeply about the person in front of you: their energy level tonight, what they have in the fridge, their family, their budget, and what they've been eating lately. Then you make ONE confident decision, as a great chef would.

Your job is to pick the single best meal for this specific person at this specific moment. Be decisive. Never hedge. Never list options. Commit to one recommendation with confidence.`;

  const userPrompt = `Make me a personalized dinner recommendation.

WHO I AM:
- Name: ${profile.name}
- Cooking for: ${profile.familySize} ${profile.familySize === 1 ? "person (myself)" : "people"}
- Budget: ${budgetHint}
- Allergies / dietary restrictions: ${hasAllergies? profile.allergies.join(", ") : "none"}
- Cuisine preferences: ${hasCuisinePrefs? profile.preferredCuisines.join(", ") : "open to anything"}

RIGHT NOW:
- Time of day: ${timeOfDay}
- Tonight's mood/vibe: ${moodCtx? `${mood} — I'm ${moodCtx.vibe}`: "no particular mood, just hungry"}
- Effort I can give: ${moodCtx? moodCtx.effort: "moderate — 20–40 min is fine"}
- Style I want: ${moodCtx? moodCtx.style: "something satisfying and well-balanced"}

WHAT'S IN MY PANTRY:
${hasPantry? ingredients.join(", "): "I haven't listed ingredients — assume basic staples: salt, pepper, olive oil, onion, garlic, eggs, butter, and common dry goods"}

WHAT I'VE COOKED RECENTLY (avoid repeating these):
${hasRecentMeals ? recentMeals.join(", ") : "nothing tracked yet"}

DECISION RULES:
1. Pick ONE meal. Be confident and decisive — as my personal chef, I trust your judgment.
2. Prioritize what I can actually make with my pantry. Minimize shopping trips.
3. Respect my allergies absolutely — no exceptions.
4. Match the effort level to my mood. If I'm tired, keep it simple. If I have guests, impress them.
5. Avoid repeating recent meals.
6. matchScore reflects your true confidence. This is the right meal for me RIGHT NOW:
   - 90–99: perfect fit — pantry match + mood + preferences all align
   - 75–89: good fit — most criteria met, maybe 1–2 things to buy
   - 60–74: acceptable — some compromises, or pantry is bare
   If your confidence is below 70, still pick ONE meal, but lower the matchScore honestly.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "name": "Meal Name",
  "description": "One enticing, specific sentence (max 100 chars) — mention a key flavor or technique",
  "cuisine": "Cuisine type",
  "readyIn": 30,
  "matchScore": 94,
  "ingredients": ["complete list of ingredients needed, 5–12 items"],
  "missingIngredients": ["only items from ingredients[] that are NOT in the pantry list above"]
}

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },],
      max_tokens: 600,
      temperature: 0.75,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    const yt = await fetchYouTubeVideo(parsed.name);
    const meal = {
      id: generateId(),
      name: parsed.name,
      description: parsed.description,
      cuisine: parsed.cuisine,
      readyIn: Number(parsed.readyIn) || 30,
      matchScore: Math.min(99, Math.max(60, Number(parsed.matchScore) || 85)),
      ingredients: Array.isArray(parsed.ingredients) ? parsed. ingredients : [],
      missingIngredients: Array.isArray(parsed.missingIngredients) ? parsed.missingIngredients : [],
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

  const budgetMap = { low: "under $10 per meal", medium: "$10–25 per meal", high: "no budget constraint" };
  const budgetHint = budgetMap[profile.budget] ?? "$10–25 per meal";
  const hasPantry = pantryItems.length > 0;

  const systemPrompt = `You are a personal AI Chef creating a thoughtful 7-day dinner plan. Think like a professional meal planner who knows this family well. Balance nutrition, variety, and effort levels across the week (lighter midweek, more ambitious on weekends), and make smart use of shared ingredients to reduce shopping. Each meal should feel personally chosen — not randomly generated.`;

const userPrompt = `Plan 7 dinners for the week ahead.

THE HOUSEHOLD:
- Cooking for: ${profile.familySize} ${profile.familySize === 1 ? "person" : "people"}
- Budget: ${budgetHint}
- Allergies / restrictions: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "none"}
- Cuisine preferences: ${profile.preferredCuisines.length > 0 ? profile.preferredCuisines.join(", ") : "open to variety"}

PANTRY AVAILABLE:
${hasPantry? pantryItems.join(", "): "basic staples only — salt, pepper, oil, onion, garlic, eggs, butter"}

RECENTLY COOKED (avoid repeating):
${recentMeals.length > 0 ? recentMeals.join(", ") : "nothing tracked"}

PLANNING RULES:
- Day 1–2 (Mon/Tue): Quick and easy, 20–30 min — start of the week energy
- Day 3 (Wed): Something comforting mid-week
- Day 4–5 (Thu/Fri): Slightly more exciting, still achievable after work
- Day 6–7 (Sat/Sun): More ambitious or social — weekend cooking
- Vary the cuisines across all 7 days — no repeated cuisine types
- Rotate proteins: don't repeat the same protein two days in a row
- Maximize pantry usage to minimize shopping
- Each meal should feel genuinely appetizing, not like a placeholder

Respond with ONLY a valid JSON array of exactly 7 meals, no markdown:
[
  {
    "name": "Meal Name",
    "description": "One specific, enticing sentence — mention a key flavor or technique",
    "cuisine": "Cuisine type",
    "readyIn": 30,
    "matchScore": 90,
    "ingredients": ["complete ingredient list, 5–12 items"],
    "missingIngredients": ["items not in the pantry above"]
  }
]`;

Vary the cuisines. Keep meals practical for home cooking.`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },],
      max_tokens: 2000,
      temperature: 0.85,
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
      matchScore: Math.min(99, Math.max(60, Number(m.matchScore) || 85)),
      ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
      missingIngredients: Array.isArray(m.missingIngredients) ? m.missingIngredients : [],
    }));

    res.json(meals);
  } catch {
    res.json(getFallbackWeeklyPlan());
  }
});

export default router;

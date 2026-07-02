import { Router } from "express";
import OpenAI from "openai";
import { z } from "zod";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getOpenAI() {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  return new OpenAI({ apiKey });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ─────────────────────────────────────────────────────────────────────────────
// Request validation schemas
// ─────────────────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  name: z.string().max(100).default(""),
  allergies: z.array(z.string().max(100)).max(30).default([]),
  budget: z.enum(["low", "medium", "high"]).default("medium"),
  familySize: z.number().int().min(1).max(20).default(2),
  preferredCuisines: z.array(z.string().max(100)).max(20).default([]),
});

const MemorySnapshotSchema = z
  .object({
    favoriteMealNames: z.array(z.string().max(200)).max(50).default([]),
    dislikedIngredients: z.array(z.string().max(200)).max(200).default([]),
    recentlyCooked: z.array(z.string().max(200)).max(50).default([]),
    stapleIngredients: z.array(z.string().max(200)).max(100).default([]),
    rareIngredients: z.array(z.string().max(200)).max(100).default([]),
    familyAllergies: z.array(z.string().max(200)).max(50).default([]),
    familyDislikes: z.array(z.string().max(200)).max(200).default([]),
    cuisineFrequency: z
      .record(z.string().max(100), z.number().int().min(0).max(999))
      .default({}),
    budget: z.string().max(50).default("medium"),
    season: z.string().max(20).default(""),
  })
  .optional();

type MemorySnapshot = NonNullable<z.infer<typeof MemorySnapshotSchema>>;

const PantryItemWithExpirySchema = z.object({
  name: z.string().max(200),
  expiryDate: z.string().optional(),
  daysUntilExpiry: z.number().optional(),
});

const RecommendSchema = z.object({
  ingredients: z.array(z.string().max(200)).max(200).default([]),
  pantryItems: z.array(PantryItemWithExpirySchema).max(200).default([]),
  mood: z.string().max(50).nullable().default(null),
  recentMeals: z.array(z.string().max(200)).max(50).default([]),
  profile: ProfileSchema.default({}),
  memory: MemorySnapshotSchema,
});

const WeeklyPlanSchema = z.object({
  pantryItems: z.array(z.string().max(200)).max(200).default([]),
  profile: ProfileSchema.default({}),
  recentMeals: z.array(z.string().max(200)).max(50).default([]),
});

// ─────────────────────────────────────────────────────────────────────────────
// Types (inferred from schemas)
// ─────────────────────────────────────────────────────────────────────────────

type RecommendRequest = z.infer<typeof RecommendSchema>;

interface WeatherContext {
  tempC: number;
  condition: string;
  isHot: boolean;
  isCold: boolean;
  isRainy: boolean;
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context builders
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWeatherContext(): Promise<WeatherContext | null> {
  try {
    const resp = await fetch("https://wttr.in/?format=j1", {
      headers: { "User-Agent": "CookWise/1.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      current_condition?: Array<{
        temp_C?: string;
        weatherDesc?: Array<{ value?: string }>;
      }>;
    };
    const cond = data.current_condition?.[0];
    if (!cond) return null;

    const tempC = Number(cond.temp_C ?? "18");
    const condition = cond.weatherDesc?.[0]?.value ?? "Clear";
    const lc = condition.toLowerCase();
    const isHot = tempC >= 28;
    const isCold = tempC <= 10;
    const isRainy = lc.includes("rain") || lc.includes("drizzle") || lc.includes("shower");

    let summary: string;
    if (isHot) summary = `hot (${tempC}°C, ${condition}) — favour lighter, fresher dishes; avoid heavy stews`;
    else if (isCold) summary = `cold (${tempC}°C, ${condition}) — favour warming, hearty dishes; soups, stews, roasts`;
    else if (isRainy) summary = `rainy (${tempC}°C, ${condition}) — comfort food is ideal; something warming and satisfying`;
    else summary = `mild (${tempC}°C, ${condition}) — any style works well`;

    return { tempC, condition, isHot, isCold, isRainy, summary };
  } catch {
    return null;
  }
}

function getDayOfWeekContext(): { day: string; effort: string; style: string } {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = days[new Date().getDay()]!;
  const dow = new Date().getDay();

  if (dow === 0) return { day, effort: "relaxed Sunday cooking — up to 60 min, something wholesome and satisfying", style: "Sunday roast or slow-cooked comfort food" };
  if (dow === 6) return { day, effort: "leisurely weekend cooking — up to 50 min, worth the extra effort", style: "something to enjoy with time to spare" };
  if (dow === 5) return { day, effort: "Friday treat — 25–40 min, slightly indulgent after a long week", style: "celebratory or takeaway-style at home" };
  if (dow === 3) return { day, effort: "midweek practical — 20–30 min, something comforting and straightforward", style: "familiar, no-fuss comfort" };
  return { day, effort: "weeknight efficient — 15–30 min max, quick and easy", style: "simple, reliable, minimal washing up" };
}

function getTimeOfDayContext(): string {
  const h = new Date().getHours();
  if (h < 11) return "morning (breakfast or brunch)";
  if (h < 15) return "midday (lunch or light meal)";
  if (h < 18) return "late afternoon (early dinner)";
  return "evening (dinner)";
}

/** Ingredients that spoil quickly and should be prioritised */
const PERISHABLE_KEYWORDS = [
  "chicken", "beef", "pork", "lamb", "fish", "salmon", "tuna", "shrimp", "prawn",
  "mince", "mincemeat", "steak", "bacon", "sausage",
  "milk", "cream", "yoghurt", "yogurt", "creme fraiche", "sour cream",
  "soft cheese", "ricotta", "mascarpone", "brie", "camembert",
  "spinach", "lettuce", "rocket", "kale", "herbs", "coriander", "parsley", "basil",
  "avocado", "tomato", "mushroom", "courgette", "zucchini",
  "berries", "strawberries", "raspberries", "blueberries",
  "tofu", "eggs",
];

function getPerishables(ingredients: string[]): string[] {
  return ingredients.filter((ing) =>
    PERISHABLE_KEYWORDS.some((k) => ing.toLowerCase().includes(k))
  );
}

function getFamilySizeContext(size: number): string {
  if (size === 1) return "cooking just for myself — single portion, quick and no leftovers needed";
  if (size === 2) return "cooking for two — intimate meal, no need to batch cook";
  if (size <= 4) return `cooking for ${size} people — family-sized portions, one main dish`;
  return `cooking for ${size} people — large batch, needs to be crowd-pleasing and scalable`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mood config
// ─────────────────────────────────────────────────────────────────────────────

const MOOD_CONTEXT: Record<string, { vibe: string; effort: string; style: string }> = {
  tired: {
    vibe: "exhausted after a long day",
    effort: "minimal — 15–25 min, one pan, very simple steps",
    style: "comforting, familiar, no complicated techniques",
  },
  romantic: {
    vibe: "planning a special evening for two",
    effort: "worth the extra effort — 30–45 min, feels restaurant-quality",
    style: "elegant, beautifully presented, a little indulgent",
  },
  budget: {
    vibe: "watching spending this week",
    effort: "practical — 20–30 min, economical ingredients, zero waste",
    style: "hearty and satisfying without expensive items",
  },
  protein: {
    vibe: "focused on fitness and fuelling well",
    effort: "straightforward — 20–35 min, high-protein focus",
    style: "substantial, macro-conscious, filling",
  },
  healthy: {
    vibe: "wanting to eat clean and feel good",
    effort: "light — 15–30 min, fresh ingredients",
    style: "nutritious, balanced macros, light on heavy fats",
  },
  kids: {
    vibe: "feeding the whole family including picky eaters",
    effort: "simple — 20–30 min, crowd-pleasing",
    style: "mild, fun, universally loved flavours — no exotic ingredients",
  },
  guests: {
    vibe: "impressing people coming over for dinner",
    effort: "worth it — 40–60 min, impressive but achievable",
    style: "shareable, centrepiece dish, visually stunning",
  },
  comfort: {
    vibe: "craving something deeply satisfying and cosy",
    effort: "unhurried — 25–45 min, no-fuss cooking",
    style: "rich, warming, nostalgic — the food equivalent of a hug",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Fallback meal bank
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_MEALS = [
  {
    name: "Creamy Butter Chicken",
    description: "Rich, aromatic curry with tender chicken in a velvety tomato-cream sauce.",
    cuisine: "Indian",
    readyIn: 35,
    matchScore: 94,
    ingredients: ["chicken breast", "butter", "heavy cream", "tomato puree", "garlic", "ginger", "garam masala", "cumin", "rice"],
    mood: null,
    tempRange: "any",
  },
  {
    name: "Classic Spaghetti Carbonara",
    description: "Silky egg-and-cheese pasta with crispy pancetta — Roman comfort at its finest.",
    cuisine: "Italian",
    readyIn: 20,
    matchScore: 91,
    ingredients: ["spaghetti", "pancetta", "eggs", "parmesan", "black pepper", "garlic"],
    mood: null,
    tempRange: "cold",
  },
  {
    name: "Teriyaki Salmon Bowl",
    description: "Glazed salmon over steamed rice with sesame-dressed greens.",
    cuisine: "Japanese",
    readyIn: 25,
    matchScore: 92,
    ingredients: ["salmon fillet", "soy sauce", "honey", "mirin", "rice", "cucumber", "sesame seeds", "spring onions"],
    mood: "healthy",
    tempRange: "any",
  },
  {
    name: "One-Pan Lemon Herb Chicken",
    description: "Juicy chicken thighs roasted with garlic, lemon, and fresh herbs.",
    cuisine: "Mediterranean",
    readyIn: 40,
    matchScore: 90,
    ingredients: ["chicken thighs", "lemon", "garlic", "rosemary", "thyme", "olive oil", "potatoes"],
    mood: null,
    tempRange: "any",
  },
  {
    name: "Veggie Stir-Fry with Noodles",
    description: "Crisp vegetables and noodles tossed in a savory umami sauce.",
    cuisine: "Chinese",
    readyIn: 15,
    matchScore: 88,
    ingredients: ["noodles", "broccoli", "bell pepper", "carrot", "soy sauce", "sesame oil", "garlic", "ginger"],
    mood: "healthy",
    tempRange: "any",
  },
  {
    name: "Avocado Toast with Poached Eggs",
    description: "Creamy smashed avocado on sourdough with perfectly poached eggs.",
    cuisine: "American",
    readyIn: 12,
    matchScore: 89,
    ingredients: ["sourdough bread", "avocado", "eggs", "lemon", "chilli flakes", "salt", "pepper"],
    mood: "tired",
    tempRange: "hot",
  },
  {
    name: "Black Bean Tacos",
    description: "Smoky spiced black beans in warm tortillas with fresh salsa.",
    cuisine: "Mexican",
    readyIn: 18,
    matchScore: 87,
    ingredients: ["tortillas", "black beans", "tomato", "onion", "coriander", "cumin", "lime", "avocado"],
    mood: "budget",
    tempRange: "any",
  },
  {
    name: "Honey Garlic Shrimp",
    description: "Succulent shrimp glazed in honey-garlic butter, ready in minutes.",
    cuisine: "American",
    readyIn: 15,
    matchScore: 93,
    ingredients: ["shrimp", "honey", "garlic", "butter", "soy sauce", "parsley", "rice"],
    mood: "romantic",
    tempRange: "any",
  },
  {
    name: "Greek Chicken Souvlaki",
    description: "Marinated grilled chicken with tzatziki and warm pita.",
    cuisine: "Greek",
    readyIn: 30,
    matchScore: 91,
    ingredients: ["chicken breast", "lemon", "oregano", "olive oil", "garlic", "pita", "cucumber", "yoghurt"],
    mood: "guests",
    tempRange: "hot",
  },
  {
    name: "Beef & Broccoli",
    description: "Tender beef strips and broccoli in a rich oyster sauce over rice.",
    cuisine: "Chinese",
    readyIn: 22,
    matchScore: 90,
    ingredients: ["beef sirloin", "broccoli", "oyster sauce", "soy sauce", "garlic", "ginger", "sesame oil", "rice"],
    mood: "protein",
    tempRange: "any",
  },
  {
    name: "Mac and Cheese",
    description: "Ultra-creamy baked mac with a golden breadcrumb crust.",
    cuisine: "American",
    readyIn: 30,
    matchScore: 96,
    ingredients: ["macaroni", "cheddar", "butter", "flour", "milk", "mustard", "breadcrumbs"],
    mood: "kids",
    tempRange: "cold",
  },
  {
    name: "Creamy Tomato Pasta",
    description: "Velvety tomato sauce with a touch of cream, tossed through rigatoni — pure nostalgia in a bowl.",
    cuisine: "Italian",
    readyIn: 25,
    matchScore: 95,
    ingredients: ["rigatoni", "crushed tomatoes", "double cream", "garlic", "butter", "parmesan", "basil"],
    mood: "comfort",
    tempRange: "any",
  },
  {
    name: "Slow-Cooked Beef Stew",
    description: "Tender chunks of beef with root vegetables in a rich, deeply flavoured gravy.",
    cuisine: "British",
    readyIn: 45,
    matchScore: 94,
    ingredients: ["beef chuck", "potato", "carrot", "onion", "celery", "beef stock", "tomato paste", "thyme", "bay leaf"],
    mood: "comfort",
    tempRange: "cold",
  },
  {
    name: "Tomato Lentil Soup",
    description: "Hearty red lentil soup with cumin, smoked paprika, and a squeeze of lemon.",
    cuisine: "Middle Eastern",
    readyIn: 30,
    matchScore: 89,
    ingredients: ["red lentils", "tomato", "onion", "garlic", "cumin", "smoked paprika", "vegetable stock", "lemon"],
    mood: null,
    tempRange: "cold",
  },
  {
    name: "Prawn Mango Salad",
    description: "Light, zesty salad with juicy prawns, fresh mango, and chilli-lime dressing.",
    cuisine: "Thai",
    readyIn: 15,
    matchScore: 90,
    ingredients: ["prawns", "mango", "cucumber", "red onion", "coriander", "lime", "fish sauce", "chilli"],
    mood: "healthy",
    tempRange: "hot",
  },
  {
    name: "Mushroom Risotto",
    description: "Silky Arborio rice with wild mushrooms, parmesan, and a splash of white wine.",
    cuisine: "Italian",
    readyIn: 40,
    matchScore: 88,
    ingredients: ["arborio rice", "mushrooms", "onion", "garlic", "white wine", "vegetable stock", "parmesan", "butter"],
    mood: "romantic",
    tempRange: "cold",
  },
];

function getFallbackMeal(
  mood: string | null,
  allergies: string[],
  pantryIngredients: string[],
  weather: WeatherContext | null,
) {
  let pool = [...FALLBACK_MEALS];

  if (weather?.isHot) pool = pool.filter((m) => m.tempRange !== "cold");
  if (weather?.isCold) pool = pool.filter((m) => m.tempRange !== "hot");

  const moodMatches = mood ? pool.filter((m) => m.mood === mood) : [];
  const workingPool = moodMatches.length > 0 ? moodMatches : pool;

  const pantrySet = new Set(pantryIngredients.map((i) => i.toLowerCase()));
  const scored = workingPool.map((m) => {
    const matched = m.ingredients.filter((ing) => pantrySet.has(ing.toLowerCase())).length;
    const ratio = pantryIngredients.length > 0 ? matched / m.ingredients.length : 0;
    return { m, ratio };
  });
  scored.sort((a, b) => b.ratio - a.ratio);

  const picked = scored[0]?.m ?? workingPool[new Date().getHours() % workingPool.length]!;

  const missingIngredients = pantryIngredients.length > 0
    ? picked.ingredients.filter((ing) => !pantrySet.has(ing.toLowerCase())).slice(0, 3)
    : [];

  return {
    id: generateId(),
    name: picked.name,
    description: picked.description,
    cuisine: picked.cuisine,
    readyIn: picked.readyIn,
    matchScore: picked.matchScore,
    ingredients: picked.ingredients,
    missingIngredients,
    mood: mood ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// YouTube helper
// ─────────────────────────────────────────────────────────────────────────────

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
    name: m.name,
    description: m.description,
    cuisine: m.cuisine,
    readyIn: m.readyIn,
    matchScore: m.matchScore,
    ingredients: m.ingredients,
    missingIngredients: [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meals/recommend
// ─────────────────────────────────────────────────────────────────────────────

router.post("/recommend", async (req, res, next) => {
  const parsed = RecommendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { ingredients, pantryItems, mood, recentMeals, profile, memory } = parsed.data as RecommendRequest;

  const weather = await fetchWeatherContext();

  const moodCtx = mood ? MOOD_CONTEXT[mood] ?? null : null;
  const dayCtx = getDayOfWeekContext();
  const timeOfDay = getTimeOfDayContext();
  const familyCtx = getFamilySizeContext(profile.familySize);
  const budgetMap = { low: "under $10 per meal", medium: "$10–25 per meal", high: "no budget constraint" };
  const budgetHint = budgetMap[profile.budget] ?? "$10–25 per meal";

  // Build expiry-aware pantry list
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiryLines: string[] = [];
  const expiringSoon: string[] = [];

  if (pantryItems.length > 0) {
    for (const item of pantryItems) {
      let days = item.daysUntilExpiry;
      if (days === undefined && item.expiryDate) {
        const exp = new Date(item.expiryDate);
        exp.setHours(0, 0, 0, 0);
        days = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
      }
      if (days !== undefined) {
        if (days < 0) {
          expiryLines.push(`• ${item.name} — EXPIRED (discard or use with caution)`);
        } else if (days === 0) {
          expiryLines.push(`• ${item.name} — expires TODAY ⚠️`);
          expiringSoon.push(item.name);
        } else if (days <= 2) {
          expiryLines.push(`• ${item.name} — expires in ${days} day${days > 1 ? "s" : ""} ⚠️ USE NOW`);
          expiringSoon.push(item.name);
        } else if (days <= 5) {
          expiryLines.push(`• ${item.name} — expires in ${days} days`);
        } else {
          expiryLines.push(`• ${item.name}`);
        }
      } else {
        expiryLines.push(`• ${item.name}`);
      }
    }
  } else if (ingredients.length > 0) {
    // Fallback to plain ingredient list when no expiry data
    const perishables = getPerishables(ingredients);
    for (const ing of ingredients) {
      if (perishables.includes(ing)) {
        expiryLines.push(`• ${ing} ⚠️ perishable — use soon`);
        expiringSoon.push(ing);
      } else {
        expiryLines.push(`• ${ing}`);
      }
    }
  }

  const allIngredientNames = pantryItems.length > 0
    ? pantryItems.map((p) => p.name)
    : ingredients;

  // Family details from memory
  const familyAllergies = memory?.familyAllergies ?? [];
  const familyDislikes = memory?.familyDislikes ?? [];
  const allAllergies = [...new Set([...profile.allergies, ...familyAllergies])];
  const recentlyCooked = memory?.recentlyCooked ?? recentMeals;
  const favoriteMeals = memory?.favoriteMealNames ?? [];
  const staples = memory?.stapleIngredients ?? [];
  const rareIngredients = memory?.rareIngredients ?? [];

  const systemPrompt = `You are this family's personal chef — you know them inside out. You think like a seasoned human chef who has cooked for this household for years: you know their fridge, their schedule, their kids' fussiness, their budget, and exactly what they cooked last week. Your job is to make ONE decisive recommendation — the single best meal for this exact moment. You are confident, direct, and never hedge. You care deeply about using up food before it expires. You treat allergies as absolute rules. You balance every context signal (weather, time, day, mood, expiry urgency) into a single best answer. Only offer alternatives when you genuinely can't reach a confident recommendation (confidence below 70).`;

  const userPrompt = `Decide the single best meal for right now. Act like their personal chef — confident and decisive.

━━━ THE HOUSEHOLD ━━━
• ${familyCtx}
• Budget tonight: ${budgetHint}
• Hard allergies (NEVER use): ${allAllergies.length > 0 ? allAllergies.join(", ") : "none"}
• Family dislikes (avoid where possible): ${familyDislikes.length > 0 ? familyDislikes.join(", ") : "none"}
• Cuisine preferences: ${profile.preferredCuisines.length > 0 ? profile.preferredCuisines.join(", ") : "open to anything"}
${favoriteMeals.length > 0 ? `• Past favourites they love: ${favoriteMeals.slice(0, 5).join(", ")}` : ""}
${staples.length > 0 ? `• Pantry staples (always available): ${staples.join(", ")}` : ""}
${rareIngredients.length > 0 ? `• Rarely in stock (don't rely on): ${rareIngredients.join(", ")}` : ""}

━━━ TIMING & DAY ━━━
• Today: ${dayCtx.day} — ${dayCtx.effort}
• Time of day: ${timeOfDay}
• Style for today: ${dayCtx.style}
${moodCtx
  ? `• Mood: ${mood} — ${moodCtx.vibe}\n• Energy available: ${moodCtx.effort}\n• Craving: ${moodCtx.style}`
  : "• Mood: open — just hungry and ready for something great"
}

━━━ WEATHER RIGHT NOW ━━━
${weather ? `• ${weather.summary}` : "• Weather unavailable — choose something universally appealing"}

━━━ WHAT'S IN THE KITCHEN ━━━
${expiryLines.length > 0
  ? expiryLines.join("\n")
  : "Nothing tracked — assume basic staples: salt, pepper, olive oil, onion, garlic, eggs, butter, dried spices, pasta, rice"
}
${expiringSoon.length > 0
  ? `\n🚨 EXPIRY PRIORITY — build the meal around these if at all possible: ${expiringSoon.join(", ")}`
  : ""
}

━━━ RECENT MEALS (avoid repeating) ━━━
${recentlyCooked.length > 0
  ? recentlyCooked.slice(0, 7).join(", ")
  : "No history yet — anything goes"
}

━━━ CHEF DECISION RULES ━━━
1. EXPIRY FIRST — ingredients expiring today or tomorrow must be used if a good meal can be built around them.
2. ONE best meal — be decisive, no hedging.
3. Weather match — cold/rainy → warming dishes; hot → light and fresh.
4. Day rhythm — weeknights: fast and simple; weekends: more ambitious is fine.
5. Mood overrides day — if mood is "tired", cap at 25 min regardless of the day.
6. Avoid recent meals AND their cuisine types to ensure variety.
7. Hard allergies are absolute — zero exceptions.
8. Family size > 3 → meal must be scalable and crowd-pleasing.
9. Budget is a firm ceiling — never recommend ingredients above it.
10. Confidence = honest score of how perfectly this meal fits RIGHT NOW:
    • 90–99 → perfect: expiry items used, pantry match, mood & weather aligned
    • 70–89 → strong: most criteria met, ≤2 items to buy
    • 50–69 → acceptable: sparse pantry or notable compromise
    • <50 → poor fit: major constraint issue

━━━ RESPONSE FORMAT ━━━
Respond ONLY with valid JSON. No markdown, no explanation outside the JSON.

When confidence ≥ 70 (leave "alternatives" as empty array):
{
  "confidence": 88,
  "name": "Meal Name",
  "description": "One enticing sentence — mention a key flavour or technique (max 100 chars)",
  "cuisine": "Cuisine type",
  "readyIn": 30,
  "chefReason": "One sentence — why THIS meal RIGHT NOW (mention the key deciding factor: expiry, weather, mood, etc.)",
  "ingredients": ["complete list needed, 5–12 items"],
  "missingIngredients": ["items from ingredients[] NOT in the kitchen above"],
  "alternatives": []
}

When confidence < 70 (include 2–3 alternatives):
{
  "confidence": 58,
  "name": "Best Available Meal",
  "description": "...",
  "cuisine": "...",
  "readyIn": 25,
  "chefReason": "Why this is the best option despite low confidence",
  "ingredients": [...],
  "missingIngredients": [...],
  "alternatives": [
    {
      "name": "Alternative Meal 1",
      "description": "...",
      "cuisine": "...",
      "readyIn": 20,
      "chefReason": "Why this is a valid alternative",
      "ingredients": [...],
      "missingIngredients": [...]
    }
  ]
}`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.65,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const aiResp = JSON.parse(jsonMatch[0]);
    const confidence = Math.min(99, Math.max(1, Number(aiResp.confidence) || 75));

    const yt = await fetchYouTubeVideo(aiResp.name);

    // Build alternatives when confidence < 70
    const rawAlts: any[] = Array.isArray(aiResp.alternatives) ? aiResp.alternatives : [];
    const alternatives = confidence < 70
      ? rawAlts.slice(0, 3).map((alt: any) => ({
          id: generateId(),
          name: alt.name ?? "Alternative",
          description: alt.description ?? "",
          cuisine: alt.cuisine ?? "International",
          readyIn: Number(alt.readyIn) || 30,
          matchScore: Math.min(99, Math.max(40, confidence - 5 + Math.floor(Math.random() * 10))),
          chefReason: alt.chefReason ?? "",
          ingredients: Array.isArray(alt.ingredients) ? alt.ingredients : [],
          missingIngredients: Array.isArray(alt.missingIngredients) ? alt.missingIngredients : [],
          mood: mood ?? undefined,
        }))
      : [];

    const meal = {
      id: generateId(),
      name: aiResp.name,
      description: aiResp.description,
      cuisine: aiResp.cuisine,
      readyIn: Number(aiResp.readyIn) || 30,
      matchScore: confidence,
      chefReason: aiResp.chefReason ?? "",
      ingredients: Array.isArray(aiResp.ingredients) ? aiResp.ingredients : [],
      missingIngredients: Array.isArray(aiResp.missingIngredients) ? aiResp.missingIngredients : [],
      mood: mood ?? undefined,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      ...yt,
    };

    res.json(meal);
  } catch (err) {
    try {
      const fallback = getFallbackMeal(mood, profile.allergies, allIngredientNames, weather ?? null);
      const yt = await fetchYouTubeVideo(fallback.name);
      res.json({ ...fallback, ...yt });
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meals/weekly-plan
// ─────────────────────────────────────────────────────────────────────────────

router.post("/weekly-plan", async (req, res, next) => {
  const parsed = WeeklyPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  const { pantryItems, profile, recentMeals } = parsed.data;

  const [weather] = await Promise.all([fetchWeatherContext()]);
  const budgetMap = { low: "under $10 per meal", medium: "$10–25 per meal", high: "no budget constraint" };
  const budgetHint = budgetMap[profile.budget] ?? "$10–25 per meal";
  const perishables = getPerishables(pantryItems);

  const systemPrompt = `You are a personal AI Chef creating a thoughtful 7-day dinner plan. Think like a professional meal planner: balance nutrition, variety, and effort across the week (lighter midweek, more ambitious on weekends). Make smart use of shared ingredients to reduce shopping. Account for weather — warming meals when it's cold, lighter meals when it's hot. Each meal should feel genuinely hand-picked, not randomly generated.`;

  const userPrompt = `Plan 7 dinners for the week ahead.

━━━ THE HOUSEHOLD ━━━
• Cooking for: ${profile.familySize} ${profile.familySize === 1 ? "person" : "people"}
• Budget: ${budgetHint}
• Allergies / restrictions: ${profile.allergies.length > 0 ? profile.allergies.join(", ") : "none"}
• Cuisine preferences: ${profile.preferredCuisines.length > 0 ? profile.preferredCuisines.join(", ") : "open to variety"}

━━━ WEATHER ━━━
${weather ? `Current conditions: ${weather.summary} — plan the week around this` : "Weather unknown — plan for variety"}

━━━ PANTRY AVAILABLE ━━━
${pantryItems.length > 0 ? pantryItems.join(", ") : "Basic staples only — salt, pepper, oil, onion, garlic, eggs, butter"}
${perishables.length > 0 ? `\n⚠️  Use these early in the week (they spoil): ${perishables.join(", ")}` : ""}

━━━ RECENTLY COOKED (avoid repeating) ━━━
${recentMeals.length > 0 ? recentMeals.join(", ") : "Nothing tracked yet"}

━━━ PLANNING RULES ━━━
• Monday–Tuesday: Quick and easy (20–30 min) — start of week energy
• Wednesday: Comforting midweek meal
• Thursday–Friday: More exciting but still achievable after work; Friday = slight treat
• Saturday: More ambitious or social weekend cooking
• Sunday: Wholesome, satisfying; roast or slow-cooked style
• Use perishable pantry items in Day 1–2 meals
• No repeated cuisine types across the 7 days
• No repeated proteins two days in a row
• Weather matters: if cold/rainy → lean warming; if hot → lean lighter

Respond with ONLY a valid JSON array of exactly 7 meals, no markdown:
[
  {
    "name": "Meal Name",
    "description": "One specific, enticing sentence — mention a key flavour or technique",
    "cuisine": "Cuisine type",
    "readyIn": 30,
    "matchScore": 90,
    "ingredients": ["complete ingredient list, 5–12 items"],
    "missingIngredients": ["items not in the pantry above"]
  }
]`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2200,
      temperature: 0.82,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");

    const meals = (JSON.parse(jsonMatch[0]) as any[]).slice(0, 7).map((m) => ({
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
  } catch (err) {
    try {
      res.json(getFallbackWeeklyPlan());
    } catch (fallbackErr) {
      next(fallbackErr);
    }
  }
});

export default router;

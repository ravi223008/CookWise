import type { Meal, PantryItem, ShoppingCategory, ShoppingList, ShoppingListItem } from "@/types";

// ─────────────────────────────────────────────
// Supermarket adapter interface
// Designed for future integrations (Woolworths, Coles, Instacart, etc.)
// ─────────────────────────────────────────────

export interface SupermarketProduct {
  id: string;
  name: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  url?: string;
}

export interface SupermarketAdapter {
  readonly name: string;
  searchProduct(query: string): Promise<SupermarketProduct[]>;
  addToCart(productId: string, quantity: number): Promise<void>;
  getCartUrl(): string;
}

// ─────────────────────────────────────────────
// Category classifier
// ─────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<ShoppingCategory, string[]> = {
  frozen: [
    "frozen",
  ],
  vegetables: [
    "carrot", "onion", "tomato", "potato", "garlic", "spinach", "broccoli",
    "celery", "cucumber", "zucchini", "courgette", "capsicum", "pepper",
    "lettuce", "cabbage", "mushroom", "corn", "pea", "asparagus", "leek",
    "pumpkin", "squash", "sweet potato", "beetroot", "radish", "artichoke",
    "eggplant", "aubergine", "kale", "chard", "scallion", "spring onion",
    "shallot", "bok choy", "pak choi", "fennel", "parsnip", "turnip",
    "cauliflower", "broccolini", "silverbeet", "watercress", "endive",
    "arugula", "rocket", "snow pea", "edamame", "bean sprout",
    "parsley", "coriander", "cilantro", "basil", "thyme", "rosemary",
    "dill", "chive", "sage", "oregano", "mint", "bay leaf",
    "ginger", "turmeric", "lemongrass",
  ],
  fruit: [
    "apple", "banana", "lemon", "lime", "orange", "berry", "strawberry",
    "blueberry", "raspberry", "blackberry", "mango", "pineapple", "grape",
    "watermelon", "peach", "pear", "plum", "cherry", "avocado", "coconut",
    "kiwi", "papaya", "melon", "fig", "date", "pomegranate", "nectarine",
    "apricot", "mandarin", "clementine", "grapefruit", "passionfruit",
    "guava", "lychee", "dragonfruit", "jackfruit", "durian", "persimmon",
    "quince", "rhubarb",
  ],
  dairy: [
    "milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "egg",
    "sour cream", "cream cheese", "ricotta", "mozzarella", "parmesan",
    "cheddar", "brie", "feta", "gouda", "gruyere", "haloumi", "halloumi",
    "ghee", "whey", "custard", "kefir", "quark", "mascarpone",
    "buttermilk", "condensed milk", "evaporated milk", "heavy cream",
    "whipping cream", "double cream", "clotted cream",
  ],
  meat: [
    "chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna",
    "shrimp", "prawn", "bacon", "sausage", "mince", "steak", "duck",
    "veal", "venison", "anchovy", "sardine", "crab", "lobster", "oyster",
    "clam", "mussel", "octopus", "squid", "calamari", "ham", "chorizo",
    "pancetta", "prosciutto", "salami", "pepperoni", "brisket", "rib",
    "tenderloin", "sirloin", "fillet", "loin", "meatball", "kebab",
    "scallop", "snapper", "barramundi", "cod", "tilapia", "halibut",
    "mackerel", "herring", "trout",
  ],
  pantry: [],
};

function normalise(s: string): string {
  return s.toLowerCase().trim();
}

export function classifyIngredient(name: string): ShoppingCategory {
  const n = normalise(name);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ShoppingCategory, string[]][]) {
    if (category === "pantry") continue;
    if (keywords.some((kw) => n.includes(kw))) return category;
  }

  return "pantry";
}

// ─────────────────────────────────────────────
// Core generation logic
// ─────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function isPantryMatch(ingredient: string, pantryItems: PantryItem[]): boolean {
  const n = normalise(ingredient);
  return pantryItems.some((p) => {
    const pn = normalise(p.name);
    return n.includes(pn) || pn.includes(n);
  });
}

/**
 * Generate a ShoppingList from a set of meals, automatically excluding
 * ingredients already present in the pantry.
 *
 * Duplicates across meals are merged; `sourceRecipes` tracks which meal(s)
 * require each item so the list stays auditable.
 */
export function generateShoppingList(
  meals: Meal[],
  pantryItems: PantryItem[]
): ShoppingList {
  const seen = new Map<string, ShoppingListItem>();

  for (const meal of meals) {
    const allIngredients = meal.missingIngredients.length > 0
      ? meal.missingIngredients
      : meal.ingredients;

    for (const raw of allIngredients) {
      const name = raw.trim();
      if (!name) continue;
      if (isPantryMatch(name, pantryItems)) continue;

      const key = normalise(name);
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        if (!existing.sourceRecipes.includes(meal.name)) {
          existing.sourceRecipes.push(meal.name);
        }
      } else {
        seen.set(key, {
          id: generateId(),
          name,
          category: classifyIngredient(name),
          checked: false,
          sourceRecipes: [meal.name],
          addedAt: new Date().toISOString(),
        });
      }
    }
  }

  return {
    id: generateId(),
    generatedAt: new Date().toISOString(),
    sourceMeals: meals.map((m) => m.name),
    items: Array.from(seen.values()),
  };
}

/**
 * Merge a newly generated list into an existing one.
 * Preserves checked state for items already present.
 * New items are appended; duplicates are skipped.
 */
export function mergeShoppingLists(
  existing: ShoppingList,
  incoming: ShoppingList
): ShoppingList {
  const merged = new Map<string, ShoppingListItem>();

  for (const item of existing.items) {
    merged.set(normalise(item.name), item);
  }

  for (const item of incoming.items) {
    const key = normalise(item.name);
    if (merged.has(key)) {
      const ex = merged.get(key)!;
      const combined = Array.from(new Set([...ex.sourceRecipes, ...item.sourceRecipes]));
      merged.set(key, { ...ex, sourceRecipes: combined });
    } else {
      merged.set(key, item);
    }
  }

  const allMeals = Array.from(new Set([...existing.sourceMeals, ...incoming.sourceMeals]));

  return {
    id: existing.id,
    generatedAt: existing.generatedAt,
    sourceMeals: allMeals,
    items: Array.from(merged.values()),
  };
}

/**
 * Group items by ShoppingCategory, respecting display order.
 */
export const CATEGORY_ORDER: ShoppingCategory[] = [
  "vegetables",
  "fruit",
  "dairy",
  "meat",
  "frozen",
  "pantry",
];

export function groupByCategory(
  items: ShoppingListItem[]
): Map<ShoppingCategory, ShoppingListItem[]> {
  const groups = new Map<ShoppingCategory, ShoppingListItem[]>(
    CATEGORY_ORDER.map((c) => [c, []])
  );
  for (const item of items) {
    groups.get(item.category)!.push(item);
  }
  return groups;
}

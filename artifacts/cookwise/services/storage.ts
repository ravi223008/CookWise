import AsyncStorage from "@react-native-async-storage/async-storage";

export const KEYS = {
  USER_PROFILE: "cookwise:profile",
  PANTRY: "cookwise:pantry",
  MEAL_HISTORY: "cookwise:history",
  TONIGHT_MEAL: "cookwise:tonight",
  WEEKLY_PLAN: "cookwise:weekly",
  KITCHEN_MEMORY: "cookwise:memory",
  FAMILY_MEMBERS: "cookwise:family",
  SHOPPING_LIST: "cookwise:shopping",
} as const;

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // silently fail
  }
}

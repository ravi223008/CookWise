import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { KEYS, load, save } from "@/services/storage";
import type { Meal, MealHistoryEntry, Mood, UserProfile } from "@/types";

interface AppState {
  profile: UserProfile;
  mealHistory: MealHistoryEntry[];
  tonightsMeal: Meal | null;
  selectedMood: Mood;
  moodFrequency: Record<string, number>;
  isLoadingRecommendation: boolean;
  updateProfile: (update: Partial<UserProfile>) => void;
  addToHistory: (meal: Meal) => void;
  setTonightsMeal: (meal: Meal | null) => void;
  setSelectedMood: (mood: Mood) => void;
  setIsLoadingRecommendation: (v: boolean) => void;
  clearTonightsMeal: () => void;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Friend",
  allergies: [],
  budget: "medium",
  familySize: 2,
  preferredCuisines: [],
};

function getTopMood(freq: Record<string, number>): Mood {
  const entries = Object.entries(freq).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return (entries[0]![0] as Mood) ?? null;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]);
  const [tonightsMeal, setTonightsMealState] = useState<Meal | null>(null);
  const [selectedMood, setSelectedMoodState] = useState<Mood>(null);
  const [moodFrequency, setMoodFrequency] = useState<Record<string, number>>({});
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const [savedProfile, savedHistory, savedTonight, savedMoodFreq] = await Promise.all([
        load<UserProfile>(KEYS.USER_PROFILE, DEFAULT_PROFILE),
        load<MealHistoryEntry[]>(KEYS.MEAL_HISTORY, []),
        load<Meal | null>(KEYS.TONIGHT_MEAL, null),
        load<Record<string, number>>(KEYS.MOOD_STREAK, {}),
      ]);
      setProfile(savedProfile);
      setMealHistory(savedHistory);
      setTonightsMealState(savedTonight);
      setMoodFrequency(savedMoodFreq);
      const topMood = getTopMood(savedMoodFreq);
      if (topMood) setSelectedMoodState(topMood);
      setLoaded(true);
    }
    init();
  }, []);

  const updateProfile = useCallback((update: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...update };
      save(KEYS.USER_PROFILE, next);
      return next;
    });
  }, []);

  const addToHistory = useCallback((meal: Meal) => {
    setMealHistory((prev) => {
      const entry: MealHistoryEntry = {
        mealId: meal.id,
        mealName: meal.name,
        cookedAt: new Date().toISOString(),
      };
      const next = [entry, ...prev].slice(0, 30);
      save(KEYS.MEAL_HISTORY, next);
      return next;
    });
  }, []);

  const setTonightsMeal = useCallback((meal: Meal | null) => {
    setTonightsMealState(meal);
    save(KEYS.TONIGHT_MEAL, meal);
  }, []);

  const clearTonightsMeal = useCallback(() => {
    setTonightsMealState(null);
    save(KEYS.TONIGHT_MEAL, null);
  }, []);

  const setSelectedMood = useCallback((mood: Mood) => {
    setSelectedMoodState(mood);
    if (mood) {
      setMoodFrequency((prev) => {
        const next = { ...prev, [mood]: (prev[mood] ?? 0) + 1 };
        save(KEYS.MOOD_STREAK, next);
        return next;
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      profile,
      mealHistory,
      tonightsMeal,
      selectedMood,
      moodFrequency,
      isLoadingRecommendation,
      updateProfile,
      addToHistory,
      setTonightsMeal,
      setSelectedMood,
      setIsLoadingRecommendation,
      clearTonightsMeal,
    }),
    [
      profile,
      mealHistory,
      tonightsMeal,
      selectedMood,
      moodFrequency,
      isLoadingRecommendation,
      updateProfile,
      addToHistory,
      setTonightsMeal,
      setSelectedMood,
      setIsLoadingRecommendation,
      clearTonightsMeal,
    ]
  );

  if (!loaded) return null;

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}

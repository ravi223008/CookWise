import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { KEYS, load, save } from "@/services/storage";
import type { Meal, MealHistoryEntry, Mood, UserProfile } from "@/types";

interface AppState {
  profile: UserProfile;
  mealHistory: MealHistoryEntry[];
  tonightsMeal: Meal | null;
  selectedMood: Mood;
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

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [mealHistory, setMealHistory] = useState<MealHistoryEntry[]>([]);
  const [tonightsMeal, setTonightsMealState] = useState<Meal | null>(null);
  const [selectedMood, setSelectedMood] = useState<Mood>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const [savedProfile, savedHistory, savedTonight] = await Promise.all([
        load<UserProfile>(KEYS.USER_PROFILE, DEFAULT_PROFILE),
        load<MealHistoryEntry[]>(KEYS.MEAL_HISTORY, []),
        load<Meal | null>(KEYS.TONIGHT_MEAL, null),
      ]);
      setProfile(savedProfile);
      setMealHistory(savedHistory);
      setTonightsMealState(savedTonight);
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

  if (!loaded) return null;

  return (
    <AppContext.Provider
      value={{
        profile,
        mealHistory,
        tonightsMeal,
        selectedMood,
        isLoadingRecommendation,
        updateProfile,
        addToHistory,
        setTonightsMeal,
        setSelectedMood,
        setIsLoadingRecommendation,
        clearTonightsMeal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}

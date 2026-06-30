import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getWeeklyPlan } from "@/services/ai";
import { KEYS, load, save } from "@/services/storage";
import type { Meal, WEEK_DAYS, WeeklyPlan } from "@/types";
import { WEEK_DAYS as DAYS } from "@/types";
import { useRouter } from "expo-router";

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, mealHistory } = useApp();
  const { items: pantryItems } = usePantry();
  const [plan, setPlan] = useState<WeeklyPlan>({});
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    load<WeeklyPlan>(KEYS.WEEKLY_PLAN, {}).then(setPlan);
  }, []);

  const generatePlan = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const meals = await getWeeklyPlan(
        pantryItems.map((i) => i.name),
        profile,
        mealHistory.slice(0, 7).map((h) => h.mealName)
      );
      const newPlan: WeeklyPlan = {};
      DAYS.forEach((day, i) => {
        newPlan[day.key] = meals[i] ?? null;
      });
      setPlan(newPlan);
      save(KEYS.WEEKLY_PLAN, newPlan);
    } catch {
      // TODO: show error
    } finally {
      setLoading(false);
    }
  }, [pantryItems, profile, mealHistory]);

  const isEmpty = DAYS.every((d) => !plan[d.key]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Weekly Plan</Text>
        <Pressable
          onPress={generatePlan}
          disabled={loading}
          style={[styles.generateBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="sparkles" size={16} color={colors.primaryForeground} />
              <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>Generate</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty && !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No plan yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap Generate and CookWise will plan your entire week
            </Text>
          </View>
        ) : (
          DAYS.map((day) => {
            const meal = plan[day.key];
            return (
              <View key={day.key} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.dayLabel, { backgroundColor: colors.sageLight }]}>
                  <Text style={[styles.dayShort, { color: colors.primary }]}>{day.short}</Text>
                </View>
                {meal ? (
                  <Pressable
                    style={styles.mealInfo}
                    onPress={() => router.push({ pathname: "/recommendation", params: { meal: JSON.stringify(meal) } })}
                  >
                    <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <View style={styles.mealMeta}>
                      <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.mealMetaText, { color: colors.mutedForeground }]}>
                        {meal.readyIn} min
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.mealInfo}>
                    {loading ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <Text style={[styles.emptyMeal, { color: colors.mutedForeground }]}>Not planned</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  generateBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 20,
    gap: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  dayCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dayLabel: {
    width: 60,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dayShort: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  mealInfo: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 4,
  },
  mealName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  mealMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mealMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  emptyMeal: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

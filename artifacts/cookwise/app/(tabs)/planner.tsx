import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getWeeklyPlan } from "@/services/ai";
import { KEYS, load, save } from "@/services/storage";
import type { Meal, WeeklyPlan } from "@/types";
import { WEEK_DAYS as DAYS } from "@/types";

const BUDGET_PER_ITEM: Record<string, number> = {
  low: 3,
  medium: 6,
  high: 10,
};

function estimateCost(missingIngredients: string[], budget: string): number {
  const perItem = BUDGET_PER_ITEM[budget] ?? 6;
  return missingIngredients.length * perItem;
}

function buildShoppingList(plan: WeeklyPlan): string[] {
  const all: string[] = [];
  for (const day of DAYS) {
    const meal = plan[day.key];
    if (meal?.missingIngredients) {
      all.push(...meal.missingIngredients);
    }
  }
  const unique = Array.from(
    new Set(all.map((s) => s.toLowerCase().trim()))
  ).map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return unique.sort();
}

function totalCookTime(plan: WeeklyPlan): number {
  return DAYS.reduce((sum, day) => sum + (plan[day.key]?.readyIn ?? 0), 0);
}

type Tab = "plan" | "shopping";

export default function PlannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, mealHistory } = useApp();
  const { items: pantryItems } = usePantry();
  const [plan, setPlan] = useState<WeeklyPlan>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("plan");

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
      // server-side fallback handles errors
    } finally {
      setLoading(false);
    }
  }, [pantryItems, profile, mealHistory]);

  const isEmpty = DAYS.every((d) => !plan[d.key]);

  const shoppingList = useMemo(() => buildShoppingList(plan), [plan]);
  const cookTime = useMemo(() => totalCookTime(plan), [plan]);
  const estimatedCost = useMemo(
    () => estimateCost(shoppingList, profile.budget),
    [shoppingList, profile.budget]
  );

  const hasPlan = !isEmpty;

  const handleShare = useCallback(async () => {
    if (!hasPlan) return;
    const lines = DAYS.map((day) => {
      const meal = plan[day.key];
      return meal
        ? `${day.label}: ${meal.name} (${meal.readyIn} min)`
        : `${day.label}: Not planned`;
    });
    const message = [
      "🍽 My Week of Meals",
      "",
      ...lines,
      "",
      `📦 Shopping list: ${shoppingList.length} items`,
      `⏱ Total cook time: ${cookTime} min`,
      `💰 Est. grocery cost: ~$${estimatedCost}`,
      "",
      "Planned with CookWise 🤖",
    ].join("\n");
    try {
      await Share.share({ message, title: "My Weekly Meal Plan" });
    } catch {
      // user dismissed
    }
  }, [hasPlan, plan, shoppingList.length, cookTime, estimatedCost]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.sageLight, colors.background]}
        style={[styles.headerGradient, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Weekly Plan</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              AI-powered meal planning
            </Text>
          </View>
          <View style={styles.headerActions}>
            {hasPlan && (
              <Pressable onPress={handleShare} hitSlop={10} style={styles.shareBtn}>
                <Ionicons name="share-outline" size={20} color={colors.foreground} />
              </Pressable>
            )}
          <Pressable
            onPress={generatePlan}
            disabled={loading}
            style={[
              styles.generateBtn,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Ionicons name="sparkles" size={16} color={colors.primaryForeground} />
                <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
                  {hasPlan ? "Regenerate" : "Generate"}
                </Text>
              </>
            )}
          </Pressable>
          </View>
        </View>

        {hasPlan && (
          <Animated.View
            entering={FadeInDown.delay(100).springify().damping(18)}
            style={styles.statsRow}
          >
            <StatPill
              icon="time-outline"
              value={`${cookTime} min`}
              label="Total cook time"
              colors={colors}
            />
            <StatPill
              icon="cart-outline"
              value={`${shoppingList.length} items`}
              label="To buy"
              colors={colors}
            />
            <StatPill
              icon="cash-outline"
              value={`~$${estimatedCost}`}
              label="Est. grocery cost"
              colors={colors}
            />
          </Animated.View>
        )}

        {hasPlan && (
          <View style={[styles.tabBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setActiveTab("plan")}
              style={[
                styles.tabBtn,
                activeTab === "plan" && { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={activeTab === "plan" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === "plan" ? colors.foreground : colors.mutedForeground },
                ]}
              >
                This Week
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("shopping")}
              style={[
                styles.tabBtn,
                activeTab === "shopping" && { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name="basket-outline"
                size={14}
                color={activeTab === "shopping" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: activeTab === "shopping" ? colors.foreground : colors.mutedForeground },
                ]}
              >
                Shopping List
                {shoppingList.length > 0 && (
                  <Text style={{ color: colors.primary }}> {shoppingList.length}</Text>
                )}
              </Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty && !loading ? (
          <Animated.View
            entering={FadeInDown.delay(100).springify().damping(18)}
            style={styles.emptyState}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.sageLight }]}>
              <Ionicons name="calendar-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No plan yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap Generate and CookWise will plan your entire week — 7 dinners, a shopping list, and cost estimate.
            </Text>
            <Pressable
              onPress={generatePlan}
              disabled={loading}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                    Generate My Week
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : activeTab === "plan" ? (
          DAYS.map((day, idx) => {
            const meal = plan[day.key];
            return (
              <Animated.View
                key={day.key}
                entering={FadeInDown.delay(idx * 50).springify().damping(18)}
              >
                <DayCard
                  dayShort={day.short}
                  dayLabel={day.label}
                  meal={meal ?? null}
                  loading={loading}
                  colors={colors}
                  onPress={() => {
                    if (meal) {
                      router.push({
                        pathname: "/recommendation",
                        params: { meal: JSON.stringify(meal) },
                      });
                    }
                  }}
                />
              </Animated.View>
            );
          })
        ) : (
          <ShoppingListTab
            items={shoppingList}
            estimatedCost={estimatedCost}
            budget={profile.budget}
            colors={colors}
          />
        )}
      </ScrollView>
    </View>
  );
}

const StatPill = React.memo(function StatPill({
  icon,
  value,
  label,
  colors,
}: {
  icon: string;
  value: string;
  label: string;
  colors: any;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={14} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
});

const DayCard = React.memo(function DayCard({
  dayShort,
  dayLabel,
  meal,
  loading,
  colors,
  onPress,
}: {
  dayShort: string;
  dayLabel: string;
  meal: Meal | null;
  loading: boolean;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={meal ? onPress : undefined}
      style={[
        styles.dayCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: meal ? 1 : 0.7,
        },
      ]}
    >
      <View style={[styles.dayLabelBox, { backgroundColor: colors.sageLight }]}>
        <Text style={[styles.dayShort, { color: colors.primary }]}>{dayShort}</Text>
        <Text style={[styles.dayFullLabel, { color: colors.mutedForeground }]}>{dayLabel}</Text>
      </View>
      <View style={styles.dayMealContent}>
        {meal ? (
          <>
            <Text style={[styles.dayMealName, { color: colors.foreground }]} numberOfLines={1}>
              {meal.name}
            </Text>
            <Text
              style={[styles.dayMealDesc, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {meal.description}
            </Text>
            <View style={styles.dayMealMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {meal.readyIn} min
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="restaurant-outline" size={12} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {meal.cuisine}
                </Text>
              </View>
              {meal.missingIngredients.length > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="cart-outline" size={12} color={colors.orange} />
                  <Text style={[styles.metaText, { color: colors.orange }]}>
                    {meal.missingIngredients.length} to buy
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : loading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        ) : (
          <Text style={[styles.emptyMeal, { color: colors.mutedForeground }]}>Not planned</Text>
        )}
      </View>
      {meal && (
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} style={styles.chevron} />
      )}
    </Pressable>
  );
});

const ShoppingListTab = React.memo(function ShoppingListTab({
  items,
  estimatedCost,
  budget,
  colors,
}: {
  items: string[];
  estimatedCost: number;
  budget: string;
  colors: any;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = useCallback((item: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.emptyShop}>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing to buy!</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Your pantry covers everything in this week's plan.
        </Text>
      </View>
    );
  }

  const remaining = items.filter((i) => !checked.has(i));
  const done = items.filter((i) => checked.has(i));

  return (
    <View style={styles.shopContainer}>
      <View style={[styles.costBanner, { backgroundColor: colors.sageLight, borderColor: colors.border }]}>
        <Ionicons name="cash-outline" size={18} color={colors.primary} />
        <View>
          <Text style={[styles.costValue, { color: colors.foreground }]}>
            ~${estimatedCost} estimated
          </Text>
          <Text style={[styles.costHint, { color: colors.mutedForeground }]}>
            Based on {budget} budget · {items.length} items · prices vary by location
          </Text>
        </View>
      </View>

      {remaining.length > 0 && (
        <View style={[styles.listSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
            TO BUY · {remaining.length}
          </Text>
          {remaining.map((item, idx) => (
            <Pressable
              key={item}
              onPress={() => toggle(item)}
              style={[
                styles.listRow,
                {
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View style={[styles.checkbox, { borderColor: colors.border }]} />
              <Text style={[styles.listItem, { color: colors.foreground }]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {done.length > 0 && (
        <View style={[styles.listSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
            IN BASKET · {done.length}
          </Text>
          {done.map((item, idx) => (
            <Pressable
              key={item}
              onPress={() => toggle(item)}
              style={[
                styles.listRow,
                {
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  styles.checkboxChecked,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                <Ionicons name="checkmark" size={11} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.listItem, styles.listItemDone, { color: colors.mutedForeground }]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 6,
  },
  generateBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },

  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  tabBar: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  content: {
    padding: 20,
    gap: 10,
  },

  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
  },
  emptyBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },

  dayCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dayLabelBox: {
    width: 64,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayShort: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  dayFullLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  dayMealContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 3,
  },
  dayMealName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.1,
  },
  dayMealDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  dayMealMeta: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  emptyMeal: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  chevron: {
    paddingRight: 14,
  },

  shopContainer: {
    gap: 14,
  },
  costBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  costValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  costHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  listSection: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  listHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    borderWidth: 0,
  },
  listItem: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  listItemDone: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  emptyShop: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
});

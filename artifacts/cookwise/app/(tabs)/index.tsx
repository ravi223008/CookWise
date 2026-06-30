import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingDots } from "@/components/LoadingDots";
import { MealCard } from "@/components/MealCard";
import { MoodSelector } from "@/components/MoodSelector";
import { useApp } from "@/context/AppContext";
import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getRecommendation } from "@/services/ai";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile,
    tonightsMeal,
    selectedMood,
    mealHistory,
    isLoadingRecommendation,
    setTonightsMeal,
    setSelectedMood,
    setIsLoadingRecommendation,
  } = useApp();
  const { items: pantryItems } = usePantry();
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecommendation = useCallback(async () => {
    setIsLoadingRecommendation(true);
    try {
      const meal = await getRecommendation({
        ingredients: pantryItems.map((i) => i.name),
        mood: selectedMood,
        recentMeals: mealHistory.slice(0, 5).map((h) => h.mealName),
        profile,
      });
      setTonightsMeal(meal);
    } catch {
      // TODO: show toast on error
    } finally {
      setIsLoadingRecommendation(false);
    }
  }, [pantryItems, selectedMood, mealHistory, profile, setTonightsMeal, setIsLoadingRecommendation]);

  useEffect(() => {
    if (!tonightsMeal && !isLoadingRecommendation) {
      fetchRecommendation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecommendation();
    setRefreshing(false);
  }, [fetchRecommendation]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.sageLight, colors.background]}
          style={[styles.headerGradient, { paddingTop: topPad + 24 }]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                {getGreeting()}
              </Text>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {profile.name}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={[styles.avatarBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* Mood */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Tonight's vibe
          </Text>
        </View>
        <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />

        {/* Tonight's Recommendation */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <View style={styles.sectionRow}>
            <Ionicons name="restaurant" size={16} color={colors.primary} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Tonight's recommendation
            </Text>
          </View>

          {isLoadingRecommendation ? (
            <View
              style={[
                styles.loadingCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <LoadingDots />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Finding the perfect meal...
              </Text>
            </View>
          ) : tonightsMeal ? (
            <MealCard meal={tonightsMeal} />
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="restaurant-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No recommendation yet
              </Text>
              <Pressable
                onPress={fetchRecommendation}
                style={[styles.retryBtn, { borderColor: colors.primary }]}
              >
                <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Decide My Dinner CTA */}
        <View style={[styles.section, { marginTop: 8 }]}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              router.push("/decide");
            }}
            style={({ pressed }) => [
              styles.decideCta,
              { backgroundColor: colors.accent, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Ionicons name="sparkles" size={22} color={colors.accentForeground} />
            <Text style={[styles.decideCtaText, { color: colors.accentForeground }]}>
              Decide My Dinner
            </Text>
          </Pressable>
        </View>

        {/* Recent Meals */}
        {mealHistory.length > 0 && (
          <View style={[styles.section, { marginTop: 28 }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Recently cooked
            </Text>
            <View style={styles.historyList}>
              {mealHistory.slice(0, 3).map((entry) => (
                <View
                  key={entry.mealId}
                  style={[styles.historyRow, { borderBottomColor: colors.border }]}
                >
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={[styles.historyName, { color: colors.foreground }]}>
                    {entry.mealName}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {new Date(entry.cookedAt).toLocaleDateString("en", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  name: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  section: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  loadingCard: {
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyCard: {
    padding: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  decideCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 20,
    gap: 10,
  },
  decideCtaText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  historyList: { gap: 0 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  historyDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});

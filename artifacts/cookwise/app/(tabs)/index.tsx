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
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RecommendationCard, RecommendationCardSkeleton } from "@/components/RecommendationCard";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
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
  const ctaScale = useSharedValue(1);

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
      // silent — fallback handled server-side
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

  const handleCookNow = useCallback(() => {
    if (!tonightsMeal) return;
    router.push({
      pathname: "/recommendation",
      params: { meal: JSON.stringify(tonightsMeal) },
    });
  }, [tonightsMeal, router]);

  const handleDecide = useCallback(() => {
    ctaScale.value = withSpring(0.96, { duration: 80 }, () => {
      ctaScale.value = withSpring(1, { duration: 220 });
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/decide");
  }, [ctaScale, router]);

  const ctaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

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
        {/* ── Header ── */}
        <LinearGradient
          colors={[colors.sageLight, colors.background]}
          style={[styles.headerGradient, { paddingTop: topPad + 20 }]}
        >
          <Animated.View
            entering={FadeInDown.delay(0).springify().damping(20)}
            style={styles.headerContent}
          >
            <View style={styles.headerText}>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                {getGreeting()} 👋
              </Text>
              <Text style={[styles.name, { color: colors.foreground }]}>
                {profile.name}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(tabs)/profile")}
              style={[
                styles.avatarBtn,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                },
              ]}
            >
              <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </Animated.View>
        </LinearGradient>

        {/* ── Tonight's Vibe ── */}
        <Animated.View
          entering={FadeInDown.delay(80).springify().damping(20)}
          style={styles.vibeSection}
        >
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              TONIGHT'S VIBE
            </Text>
          </View>
          <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
        </Animated.View>

        {/* ── Recommendation ── */}
        <Animated.View
          entering={FadeInDown.delay(160).springify().damping(20)}
          style={styles.section}
        >

          {isLoadingRecommendation? (
            <RecommendationCardSkeleton />
          ): tonight's meal? (
            <RecommendationCard
              meal={tonightsMeal}
              onCookNow={handleCookNow}
              onChooseAnother={fetchRecommendation}
            />
          ) : (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="restaurant-outline" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No suggestion yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Tap below to find tonight's dinner
              </Text>
              <Pressable
                onPress={fetchRecommendation}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
                  Get Suggestion
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* ── Decide My Dinner CTA ── */}
        <Animated.View
          entering={FadeInDown.delay(240).springify().damping(20)}
          style={[styles.section, { marginTop: 4 }]}
        >
          <Animated.View style={ctaAnimStyle}>
            <Pressable
              onPress={handleDecide}
              style={[
                styles.decideCta,
                {
                  backgroundColor: colors.accent,
                  shadowColor: colors.accent,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 14,
                  elevation: 5,
                },
              ]}
            >
              <Ionicons name="sparkles" size={20} color={colors.accentForeground} />
              <Text style={[styles.decideCtaText, { color: colors.accentForeground }]}>
                Decide My Dinner
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* ── Recent Meals ── */}
        {mealHistory.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(320).springify().damping(20)}
            style={[styles.section, { marginTop: 28 }]}
          >
            <View style={styles.sectionRow}>
              <Ionicons name="time-outline" size={15} color={colors.mutedForeground} />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                RECENTLY COOKED
              </Text>
            </View>

            <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {mealHistory.slice(0, 3).map((entry, idx) => (
                <View
                  key={entry.mealId}
                  style={[
                    styles.historyRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < Math.min(mealHistory.length, 3) - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <View style={[styles.historyDot, { backgroundColor: colors.sageLight }]}>
                    <Ionicons name="checkmark" size={13} color={colors.primary} />
                  </View>
                  <Text
                    style={[styles.historyName, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {entry.mealName}
                  </Text>
                  <View style={[styles.datePill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {formatDate(entry.cookedAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    gap: 3,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.1,
  },
  name: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  avatarBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },

  vibeSection: {
    gap: 12,
    marginTop: 4,
    paddingTop: 4,
  },

  section: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 28,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionLabelPrimary: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },

  emptyCard: {
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
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
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },

  historyCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  historyDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  historyName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { MoodSelector } from "@/components/MoodSelector";
import {
  RecommendationCard,
  RecommendationCardSkeleton,
} from "@/components/RecommendationCard";
import { useApp } from "@/context/AppContext";
import { usePantry } from "@/context/PantryContext";
import { useDashboard } from "@/hooks/useDashboard";
import { useColors } from "@/hooks/useColors";
import { getRecommendation } from "@/services/ai";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Days until a date. Negative = already past. */
function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(iso);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp.getTime() - now.getTime()) / 86_400_000);
}

function expiryLabel(days: number): string {
  if (days <= 0) return "Expires today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

function expiryColor(
  days: number,
  colors: { destructive: string; orange: string; mutedForeground: string },
): string {
  if (days <= 0) return colors.destructive;
  if (days === 1) return colors.orange;
  return colors.mutedForeground;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dashboard = useDashboard();

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
  const [error, setError] = useState<string | null>(null);
  const ctaScale = useSharedValue(1);
  // Guard against React Strict Mode double-invoking the mount effect.
  const didFetchRef = React.useRef(false);

  // ── Expiry alerts (items expiring within 3 days) ──────────────────────────
  // todayKey derived from dashboard.now (ticks every 30 s) so the list
  // recomputes shortly after midnight when items cross the 0-day boundary.
  const todayKey = dashboard.now.toDateString();
  const expiryAlerts = useMemo(
    () =>
      pantryItems
        .filter((item) => {
          if (!item.expiryDate) return false;
          const d = daysUntil(item.expiryDate);
          return d >= 0 && d <= 3;
        })
        .sort(
          (a, b) =>
            new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime(),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pantryItems, todayKey],
  );

  // ── Fetch recommendation ──────────────────────────────────────────────────
  const fetchRecommendation = useCallback(async () => {
    setIsLoadingRecommendation(true);
    setError(null);
    try {
      const meal = await getRecommendation({
        ingredients: pantryItems.map((i) => i.name),
        mood: selectedMood,
        recentMeals: mealHistory.slice(0, 5).map((h) => h.mealName),
        profile,
      });
      setTonightsMeal(meal);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not fetch a recommendation.";
      setError(message);
    } finally {
      setIsLoadingRecommendation(false);
    }
  }, [
    pantryItems,
    selectedMood,
    mealHistory,
    profile,
    setTonightsMeal,
    setIsLoadingRecommendation,
  ]);

  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
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
        {/* ── Dashboard Hero ── */}
        <LinearGradient
          colors={[colors.sageLight, colors.background]}
          style={[styles.hero, { paddingTop: topPad + 20 }]}
        >
          {/* Greeting row */}
          <Animated.View
            entering={FadeInDown.delay(0).springify().damping(20)}
            style={styles.greetingRow}
          >
            <View style={styles.greetingText}>
              <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
                {getGreeting()} 👋
              </Text>
              <Text
                style={[styles.name, { color: colors.foreground }]}
                accessibilityRole="header"
              >
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
              accessibilityRole="button"
              accessibilityLabel={`${profile.name}'s profile`}
            >
              <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Stat pills — Time · Weather · Dinner countdown */}
          <Animated.View
            entering={FadeInDown.delay(60).springify().damping(20)}
            style={styles.statRow}
          >
            {/* Time */}
            <View
              style={[
                styles.statPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard.timeLabel}
              </Text>
            </View>

            {/* Weather */}
            <View
              style={[
                styles.statPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {dashboard.weatherLoading ? (
                <Text style={[styles.statValue, { color: colors.mutedForeground }]}>
                  ···
                </Text>
              ) : dashboard.weather ? (
                <>
                  <Text style={styles.statEmoji}>{dashboard.weather.emoji}</Text>
                  <Text style={[styles.statValue, { color: colors.foreground }]}>
                    {dashboard.weather.tempC}°C
                  </Text>
                  <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
                    {dashboard.weather.label}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="partly-sunny-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.statValue, { color: colors.mutedForeground }]}>
                    —
                  </Text>
                </>
              )}
            </View>

            {/* Dinner countdown */}
            <View
              style={[
                styles.statPill,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="restaurant-outline" size={14} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard.dinnerCountdown}
              </Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ── Tonight's Vibe ── */}
        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(20)}
          style={styles.vibeSection}
        >
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              TONIGHT'S VIBE
            </Text>
          </View>
          <MoodSelector selected={selectedMood} onSelect={setSelectedMood} />
        </Animated.View>

        {/* ── AI Recommendation ── */}
        <Animated.View
          entering={FadeInDown.delay(200).springify().damping(20)}
          style={styles.section}
        >
          <View style={styles.sectionRow}>
            <Ionicons
              name="sparkles"
              size={15}
              color={colors.primary}
              importantForAccessibility="no"
            />
            <Text style={[styles.sectionLabelPrimary, { color: colors.foreground }]}>
              Tonight's Recommendation
            </Text>
          </View>

          {isLoadingRecommendation ? (
            <RecommendationCardSkeleton />
          ) : error ? (
            <View
              style={[
                styles.stateCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              accessibilityRole="alert"
            >
              <Ionicons
                name="cloud-offline-outline"
                size={36}
                color={colors.mutedForeground}
                importantForAccessibility="no"
              />
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>
                Couldn't load a suggestion
              </Text>
              <Text style={[styles.stateSub, { color: colors.mutedForeground }]}>
                {error}
              </Text>
              <Pressable
                onPress={fetchRecommendation}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Retry getting a meal suggestion"
              >
                <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : tonightsMeal ? (
            <RecommendationCard
              meal={tonightsMeal}
              onCookNow={handleCookNow}
              onChooseAnother={fetchRecommendation}
            />
          ) : (
            <View
              style={[
                styles.stateCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="restaurant-outline"
                size={36}
                color={colors.mutedForeground}
                importantForAccessibility="no"
              />
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>
                No suggestion yet
              </Text>
              <Text style={[styles.stateSub, { color: colors.mutedForeground }]}>
                Tap below to find your dinner
              </Text>
              <Pressable
                onPress={fetchRecommendation}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Get a meal suggestion"
              >
                <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
                  Get Suggestion
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* ── Expiry Alerts ── */}
        {expiryAlerts.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(280).springify().damping(20)}
            style={styles.section}
          >
            <View style={styles.sectionRow}>
              <Ionicons
                name="warning-outline"
                size={15}
                color={colors.orange}
                importantForAccessibility="no"
              />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                EXPIRING SOON
              </Text>
            </View>

            <View
              style={[
                styles.expiryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              accessibilityRole="list"
              accessibilityLabel="Ingredients expiring soon"
            >
              {expiryAlerts.map((item, idx) => {
                const days = daysUntil(item.expiryDate!);
                const chipColor = expiryColor(days, colors);
                const bgColor =
                  days <= 0
                    ? colors.destructive + "18"
                    : days === 1
                      ? colors.orangeLight
                      : colors.muted;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.expiryRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth:
                          idx < expiryAlerts.length - 1 ? 1 : 0,
                      },
                    ]}
                    accessibilityRole="text"
                    accessibilityLabel={`${item.name}, ${expiryLabel(days)}`}
                  >
                    <View
                      style={[
                        styles.expiryDot,
                        { backgroundColor: bgColor },
                      ]}
                    >
                      <Ionicons
                        name={days <= 0 ? "alert-circle" : "time-outline"}
                        size={14}
                        color={chipColor}
                      />
                    </View>
                    <Text
                      style={[styles.expiryName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.expiryBadge,
                        { backgroundColor: bgColor },
                      ]}
                    >
                      <Text style={[styles.expiryBadgeText, { color: chipColor }]}>
                        {expiryLabel(days)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Decide My Dinner CTA ── */}
        <Animated.View
          entering={FadeInDown.delay(360).springify().damping(20)}
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
              accessibilityRole="button"
              accessibilityLabel="Decide my dinner — mood-based meal picker"
            >
              <Ionicons
                name="sparkles"
                size={20}
                color={colors.accentForeground}
                importantForAccessibility="no"
              />
              <Text style={[styles.decideCtaText, { color: colors.accentForeground }]}>
                Decide My Dinner
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ──
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 20,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingText: { gap: 3 },
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

  // ── Stat pills ──
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  statSub: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },

  // ── Section chrome ──
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

  // ── State cards (empty / error) ──
  stateCard: {
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  stateTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  stateSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
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

  // ── Expiry alerts ──
  expiryCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  expiryDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  expiryName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  expiryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  expiryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  // ── Decide CTA ──
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
});

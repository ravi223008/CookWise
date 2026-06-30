import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { Meal } from "@/types";

export default function RecommendationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ meal: string }>();
  const { addToHistory } = useApp();
  const [cooked, setCooked] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  let meal: Meal | null = null;
  try {
    meal = params.meal ? (JSON.parse(params.meal) as Meal) : null;
  } catch {
    meal = null;
  }

  const handleCooked = useCallback(() => {
    if (!meal) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addToHistory(meal);
    setCooked(true);
  }, [meal, addToHistory]);

  const openYouTube = useCallback(() => {
    if (!meal?.youtubeVideoId) return;
    const url = `https://www.youtube.com/watch?v=${meal.youtubeVideoId}`;
    Linking.openURL(url);
  }, [meal]);

  if (!meal) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Meal not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const matchColor =
    meal.matchScore >= 90
      ? colors.primary
      : meal.matchScore >= 70
        ? colors.orange
        : colors.mutedForeground;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      >
        {/* Hero */}
        <LinearGradient
          colors={[colors.sageLight, colors.background]}
          style={[styles.hero, { paddingTop: topPad + 16 }]}
        >
          <Pressable onPress={() => router.back()} style={styles.backIcon} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </Pressable>

          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={[styles.matchBadge, { backgroundColor: matchColor + "18" }]}>
                <Ionicons name="star" size={14} color={matchColor} />
                <Text style={[styles.matchText, { color: matchColor }]}>
                  {meal.matchScore}% Match
                </Text>
              </View>
              <View style={[styles.timeBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                  {meal.readyIn} min
                </Text>
              </View>
            </View>
            <Text style={[styles.mealName, { color: colors.foreground }]}>{meal.name}</Text>
            <Text style={[styles.cuisine, { color: colors.primary }]}>{meal.cuisine}</Text>
            <Text style={[styles.description, { color: colors.mutedForeground }]}>{meal.description}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Ingredients */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Ingredients</Text>
            <View style={styles.ingredientList}>
              {meal.ingredients.map((ing) => {
                const missing = meal!.missingIngredients.includes(ing);
                return (
                  <View key={ing} style={styles.ingredientRow}>
                    <View style={[styles.ingredientDot, { backgroundColor: missing ? colors.orangeLight : colors.sageLight }]}>
                      <Ionicons
                        name={missing ? "cart-outline" : "checkmark"}
                        size={14}
                        color={missing ? colors.orange : colors.primary}
                      />
                    </View>
                    <Text style={[styles.ingredientText, { color: missing ? colors.mutedForeground : colors.foreground }]}>
                      {ing}
                    </Text>
                    {missing && (
                      <View style={[styles.missingTag, { backgroundColor: colors.orangeLight }]}>
                        <Text style={[styles.missingTagText, { color: colors.orange }]}>Buy</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {meal.missingIngredients.length > 0 && (
              <View style={[styles.missingNote, { backgroundColor: colors.orangeLight }]}>
                <Ionicons name="cart-outline" size={16} color={colors.orange} />
                <Text style={[styles.missingNoteText, { color: colors.orange }]}>
                  You need {meal.missingIngredients.length} item{meal.missingIngredients.length > 1 ? "s" : ""} from the store
                </Text>
              </View>
            )}
          </View>

          {/* YouTube */}
          {meal.youtubeVideoId ? (
            <Pressable
              onPress={openYouTube}
              style={[styles.youtubeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.ytThumb, { backgroundColor: colors.muted }]}>
                {meal.youtubeThumbnail ? (
                  <>
                    <Image
                      source={{ uri: meal.youtubeThumbnail }}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                    <View style={styles.ytPlayOverlay}>
                      <Ionicons name="play-circle" size={36} color="#fff" />
                    </View>
                  </>
                ) : (
                  <Ionicons name="play-circle" size={48} color="#FF0000" />
                )}
              </View>
              <View style={styles.ytInfo}>
                <Text style={[styles.ytLabel, { color: colors.mutedForeground }]}>Watch recipe</Text>
                <Text style={[styles.ytTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {meal.youtubeTitle ?? `How to make ${meal.name}`}
                </Text>
                <View style={styles.ytMeta}>
                  <Ionicons name="logo-youtube" size={14} color="#FF0000" />
                  <Text style={[styles.ytMetaText, { color: colors.mutedForeground }]}>Open in YouTube</Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.youtubeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.ytThumb, { backgroundColor: colors.muted }]}>
                <Ionicons name="videocam-outline" size={32} color={colors.mutedForeground} />
              </View>
              <View style={styles.ytInfo}>
                <Text style={[styles.ytLabel, { color: colors.mutedForeground }]}>Recipe video</Text>
                <Text style={[styles.ytTitle, { color: colors.foreground }]}>
                  {`How to make ${meal.name}`}
                </Text>
                <Text style={[styles.ytMetaText, { color: colors.mutedForeground }]}>Loading video...</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.ctaBar, { paddingBottom: bottomPad + 16, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {cooked ? (
          <View style={[styles.cookedBanner, { backgroundColor: colors.sageLight }]}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={[styles.cookedText, { color: colors.primary }]}>Saved to your cooking history</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleCooked}
            style={[styles.cookedBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark" size={20} color={colors.primaryForeground} />
            <Text style={[styles.cookedBtnText, { color: colors.primaryForeground }]}>Mark as Cooked</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  backIcon: { marginBottom: 20 },
  heroContent: { gap: 10 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matchBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  matchText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  mealName: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    lineHeight: 38,
  },
  cuisine: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  description: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
  body: {
    padding: 20,
    gap: 16,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  ingredientList: { gap: 10 },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ingredientDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  missingTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  missingTagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  missingNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  missingNoteText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  youtubeCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
  },
  ytThumb: {
    width: 100,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ytPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  ytInfo: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  ytLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ytTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  ytMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ytMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  ctaBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cookedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  cookedBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  cookedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  cookedText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  backBtn: {
    marginTop: 12,
  },
  backBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});

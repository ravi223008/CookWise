import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { Meal } from "@/types";

export interface RecommendationCardProps {
  meal: Meal;
  onCookNow: () => void;
  onChooseAnother: () => void;
  label?: string;
}

const CUISINE_EMOJI: Record<string, string> = {
  Italian: "🍝",
  Indian: "🍛",
  Japanese: "🍱",
  Chinese: "🥢",
  Mexican: "🌮",
  American: "🍔",
  Mediterranean: "🫒",
  Greek: "🫙",
  Thai: "🍜",
  French: "🥐",
};

function getCuisineEmoji(cuisine: string): string {
  return CUISINE_EMOJI[cuisine] ?? "🍽️";
}

function getMatchColor(
  matchScore: number,
  colors: { primary: string; orange: string; mutedForeground: string }
): string {
  if (matchScore >= 90) return colors.primary;
  if (matchScore >= 70) return colors.orange;
  return colors.mutedForeground;
}

const IMAGE_HEIGHT = 200;

export function RecommendationCard({ meal, onCookNow, onChooseAnother, label = "Today's Recommendation", }: RecommendationCardProps) {
  const colors = useColors();
  const cookScale = useSharedValue(1);
  const anotherScale = useSharedValue(1);

  const cookAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cookScale.value }],
  }));
  const anotherAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anotherScale.value }],
  }));

  const handleCookNow = useCallback(() => {
    cookScale.value = withSpring(0.95, { duration: 80 }, () => {
      cookScale.value = withSpring(1, { duration: 220 });
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCookNow();
  }, [cookScale, onCookNow]);

  const handleChooseAnother = useCallback(() => {
    anotherScale.value = withSpring(0.95, { duration: 80 }, () => {
      anotherScale.value = withSpring(1, { duration: 220 });
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChooseAnother();
  }, [anotherScale, onChooseAnother]);

  const matchColor = getMatchColor(meal.matchScore, colors);

  const hasThumbnail = Boolean(meal.youtubeThumbnail);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18).stiffness(120)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* ── Card header: Today's Recommendation ── */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.sparkDot, { backgroundColor: colors.sageLight }]}>
            <Ionicons name="sparkles" size={12} color={colors.primary} />
          </View>
          <Text style={[styles.cardHeaderLabel, { color: colors.foreground }]}>
            {label}
          </Text>
        </View>
        <View style={[styles.matchBadgePill, { backgroundColor: matchColor }]}>
          <Ionicons name="star" size={11} color="#fff" />
          <Text style={styles.matchBadgePillText}>{meal.matchScore}%</Text>
        </View>
      </View>
      
      {/* ── Hero image ── */}
      <View style={styles.imageContainer}>
        {hasThumbnail? (
          <Image
            source={{ uri: meal.youtubeThumbnail }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={[colors.sageLight, colors.muted]}
            style={styles.placeholderImage}
          >
            <Text style={styles.cuisineEmoji}>{getCuisineEmoji(meal.cuisine)}</Text>
          </LinearGradient>
        )}

        {hasThumbnail && (
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        
        {hasThumbnail && (
          <Text style={styles.imageTitle} numberOfLines={2}>
            {meal.name}
          </Text>
        )}
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Recipe name (only when no thumbnail) */}
        {!hasThumbnail && (
          <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={2}>
            {meal.name}
          </Text>
        )}

        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {meal.description}
        </Text>

        {/* Meta row: cooking time + cuisine + missing items */}
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
            <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {meal.readyIn} min
            </Text>
          </View>
          <View style={[styles.metaPill, { backgroundColor: colors.muted }]}>
            <Ionicons name="restaurant-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {meal.cuisine}
            </Text>
          </View>
          {meal.missingIngredients.length > 0 && (
            <View style={[styles.metaPill, { backgroundColor: colors.orangeLight }]}>
              <Ionicons name="cart-outline" size={13} color={colors.orange} />
              <Text style={[styles.metaText, { color: colors.orange }]}>
                {meal.missingIngredients.length} to buy
              </Text>
            </View>
          )}
        </View>

        {/* Ingredient match bar */}
        <View style={styles.matchBarSection}>
          <View style={styles.matchBarRow}>
            <Text style={[styles.matchBarLabel, { color: colors.mutedForeground }]}>
              Ingredient match
            </Text>
            <Text style={[styles.matchBarValue, { color: matchColor }]}>
              {meal.matchScore}%
            </Text>
          </View>
          <View style={[styles.matchBarTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.matchBarFill,
                {
                  width: `${meal.matchScore}%` as unknown as number,
                  backgroundColor: matchColor,
                },
              ]}
            />
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Animated.View style={[{ flex: 1 }, cookAnimStyle]}>
            <Pressable
              onPress={handleCookNow}
              style={[styles.cookBtn, { backgroundColor: colors.primary }]}
              accessibilityLabel="Cook this meal now"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.cookBtnText, { color: colors.primaryForeground }]}>
                Cook Now
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, anotherAnimStyle]}>
            <Pressable
              onPress={handleChooseAnother}
              style={[styles.anotherBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              accessibilityLabel="Get a different recipe suggestion"
              accessibilityRole="button"
            >
              <Ionicons name="shuffle-outline" size={18} color={colors.foreground} />
              <Text style={[styles.anotherBtnText, { color: colors.foreground }]}>
                Choose Another
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

export function RecommendationCardSkeleton() {
  const colors = useColors();
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750 }),
        withTiming(0.45, { duration: 750 }),
      ),
      -1,
    );
  }, [pulse]);

  const shimmer = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.card, shimmer, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Header skeleton */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.skeletonLine, { width: 160, height: 16, backgroundColor: colors.muted }]} />
        <View style={[styles.skeletonPill, { width: 52, height: 24, backgroundColor: colors.muted }]} />
      </View>
      
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]} />
      <View style={[styles.body, { gap: 14 }]}>
        <View style={[styles.skeletonLine, { width: "72%", backgroundColor: colors.muted }]} />
        <View style={[styles.skeletonLine, { width: "90%", height: 14, backgroundColor: colors.muted }]} />
        <View style={styles.metaRow}>
          <View style={[styles.skeletonPill, { backgroundColor: colors.muted }]} />
          <View style={[styles.skeletonPill, { backgroundColor: colors.muted }]} />
        </View>
        <View style={[styles.skeletonBar, { backgroundColor: colors.muted }]} />
        <View style={styles.actions}>
          <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.muted }} />
          <View style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.muted }} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
  },
  
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sparkDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  matchBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  matchBadgePillText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    backgroundColor: "#EEF2EE",
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT,
  },
  placeholderImage: {
    width: "100%",
    height: IMAGE_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  cuisineEmoji: {
    fontSize: 64,
  },
  imageTitle: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  body: {
    padding: 18,
    gap: 12,
  },
  mealName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  matchBarSection: {
    gap: 7,
  },
  matchBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchBarLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  matchBarValue: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  matchBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  matchBarFill: {
    height: 6,
    borderRadius: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  cookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    gap: 7,
  },
  cookBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  anotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    gap: 7,
  },
  anotherBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  skeletonLine: {
    height: 22,
    borderRadius: 11,
  },
  skeletonPill: {
    height: 30,
    width: 90,
    borderRadius: 20,
  },
  skeletonBar: {
    height: 6,
    borderRadius: 3,
    width: "100%",
  },
});

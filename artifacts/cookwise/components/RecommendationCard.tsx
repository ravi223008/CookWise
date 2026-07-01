import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  runOnJS,
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
  onFavorite?: (meal: Meal) => void;
  isFavorited?: boolean;
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
const SWIPE_THRESHOLD = 100;

export function RecommendationCard({
  meal,
  onCookNow,
  onChooseAnother,
  onFavorite,
  isFavorited = false,
  label = "Today's Recommendation",
}: RecommendationCardProps) {
  const colors = useColors();
  const [reasonVisible, setReasonVisible] = useState(false);

  const cookScale = useSharedValue(1);
  const anotherScale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const swipeHintOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;
    cardOpacity.value = 1;
    swipeHintOpacity.value = 0;
    setReasonVisible(false);
  }, [meal.id]);

  const triggerChooseAnother = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChooseAnother();
  }, [onChooseAnother]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationX < 0) {
        translateX.value = e.translationX;
        const progress = Math.min(Math.abs(e.translationX) / SWIPE_THRESHOLD, 1);
        cardOpacity.value = 1 - progress * 0.4;
        swipeHintOpacity.value = progress;
      }
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-400, { duration: 260 });
        cardOpacity.value = withTiming(0, { duration: 260 }, () => {
          runOnJS(triggerChooseAnother)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        cardOpacity.value = withSpring(1);
        swipeHintOpacity.value = withTiming(0, { duration: 200 });
      }
    });

  const cookAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cookScale.value }],
  }));
  const anotherAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: anotherScale.value }],
  }));
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: cardOpacity.value,
  }));
  const swipeHintStyle = useAnimatedStyle(() => ({
    opacity: swipeHintOpacity.value,
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

  const handleFavorite = useCallback(() => {
    if (!onFavorite) return;
    heartScale.value = withSpring(1.4, { duration: 120 }, () => {
      heartScale.value = withSpring(1, { duration: 200 });
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onFavorite(meal);
  }, [onFavorite, heartScale, meal]);

  const toggleReason = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setReasonVisible((v) => !v);
  }, []);

  const matchColor = getMatchColor(meal.matchScore, colors);
  const hasThumbnail = Boolean(meal.youtubeThumbnail);
  const hasReason = Boolean(meal.matchReason);

  return (
    <View style={styles.swipeWrapper}>
      {/* Behind-card swipe hint */}
      <Animated.View style={[styles.swipeHint, swipeHintStyle]}>
        <Ionicons name="shuffle-outline" size={28} color={colors.primary} />
        <Text style={[styles.swipeHintText, { color: colors.primary }]}>New pick</Text>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={cardAnimStyle}>
          <Animated.View
            entering={FadeInUp.springify().damping(18).stiffness(120)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            {/* ── Card header ── */}
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.sparkDot, { backgroundColor: colors.sageLight }]}>
                  <Ionicons name="sparkles" size={12} color={colors.primary} />
                </View>
                <Text style={[styles.cardHeaderLabel, { color: colors.foreground }]}>
                  {label}
                </Text>
              </View>

              <View style={styles.cardHeaderRight}>
                {onFavorite && (
                  <Animated.View style={heartAnimStyle}>
                    <Pressable
                      onPress={handleFavorite}
                      hitSlop={8}
                      accessibilityLabel={isFavorited ? "Remove from favorites" : "Save to favorites"}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={isFavorited ? "heart" : "heart-outline"}
                        size={22}
                        color={isFavorited ? colors.accent : colors.mutedForeground}
                      />
                    </Pressable>
                  </Animated.View>
                )}
                <Pressable
                  onPress={hasReason ? toggleReason : undefined}
                  style={[styles.matchBadgePill, { backgroundColor: matchColor }]}
                  accessibilityLabel={hasReason ? "View match reason" : undefined}
                  accessibilityRole={hasReason ? "button" : "text"}
                >
                  <Ionicons name="star" size={11} color="#fff" />
                  <Text style={styles.matchBadgePillText}>{meal.matchScore}%</Text>
                  {hasReason && (
                    <Ionicons
                      name={reasonVisible ? "chevron-up" : "information-circle-outline"}
                      size={11}
                      color="#fff"
                    />
                  )}
                </Pressable>
              </View>
            </View>

            {/* ── Confidence reason panel ── */}
            {reasonVisible && hasReason && (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}
                style={[
                  styles.reasonPanel,
                  { backgroundColor: colors.sageLight, borderBottomColor: colors.border },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.primary} style={{ marginTop: 1 }} />
                <Text style={[styles.reasonText, { color: colors.sageDark }]}>
                  {meal.matchReason}
                </Text>
              </Animated.View>
            )}

            {/* ── Hero image ── */}
            <View style={styles.imageContainer}>
              {hasThumbnail ? (
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
              {!hasThumbnail && (
                <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={2}>
                  {meal.name}
                </Text>
              )}

              <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
                {meal.description}
              </Text>

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

              <Text style={[styles.swipeTip, { color: colors.mutedForeground }]}>
                ← Swipe left for a new suggestion
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
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
  swipeWrapper: {
    position: "relative",
  },
  swipeHint: {
    position: "absolute",
    right: 20,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 0,
  },
  swipeHintText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
    zIndex: 1,
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
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    paddingVertical: 6,
    borderRadius: 20,
  },
  matchBadgePillText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },

  reasonPanel: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
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

  swipeTip: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    opacity: 0.5,
    marginTop: -4,
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

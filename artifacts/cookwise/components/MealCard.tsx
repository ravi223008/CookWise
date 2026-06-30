import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { Meal } from "@/types";

interface MealCardProps {
  meal: Meal;
  onPress?: () => void;
  compact?: boolean;
}

export function MealCard({ meal, onPress, compact = false }: MealCardProps) {
  const colors = useColors();
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.97, { duration: 100 }, () => {
      scale.value = withSpring(1, { duration: 200 });
    });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: "/recommendation",
        params: { meal: JSON.stringify(meal) },
      });
    }
  }, [meal, onPress, router, scale]);

  const matchColor =
    meal.matchScore >= 90
      ? colors.primary
      : meal.matchScore >= 70
        ? colors.orange
        : colors.mutedForeground;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={handlePress} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius ?? 20 }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={2}>
              {meal.name}
            </Text>
            <View style={[styles.matchBadge, { backgroundColor: matchColor + "18" }]}>
              <Text style={[styles.matchText, { color: matchColor }]}>
                {meal.matchScore}%
              </Text>
            </View>
          </View>

          {!compact && (
            <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
              {meal.description}
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {meal.readyIn} min
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="restaurant-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {meal.cuisine}
            </Text>
          </View>
          {meal.missingIngredients.length > 0 && (
            <View style={styles.footerItem}>
              <Ionicons name="cart-outline" size={14} color={colors.orange} />
              <Text style={[styles.footerText, { color: colors.orange }]}>
                {meal.missingIngredients.length} missing
              </Text>
            </View>
          )}
        </View>

        {!compact && (
          <View style={[styles.cookButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.cookButtonText, { color: colors.primaryForeground }]}>
              Cook Now
            </Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primaryForeground} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  header: {
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  mealName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    flex: 1,
    lineHeight: 28,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
  },
  matchText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  cookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  cookButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});

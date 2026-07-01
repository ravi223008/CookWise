import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { Mood } from "@/types";

interface MoodOption {
  key: Mood;
  label: string;
  emoji: string;
}

const MOODS: MoodOption[] = [
  { key: "tired",   label: "Tired",        emoji: "😴" },
  { key: "romantic", label: "Romantic",    emoji: "❤️" },
  { key: "budget",  label: "Budget",       emoji: "💰" },
  { key: "protein", label: "High Protein", emoji: "🏋" },
  { key: "healthy", label: "Healthy",      emoji: "🥗" },
  { key: "kids",    label: "Kids",         emoji: "👶" },
  { key: "guests",  label: "Guests",       emoji: "🎉" },
  { key: "comfort", label: "Comfort Food", emoji: "🍜" },
];

interface MoodChipProps {
  mood: MoodOption;
  isActive: boolean;
  onPress: (mood: Mood) => void;
}

function MoodChip({ mood, isActive, onPress }: MoodChipProps) {
  const colors = useColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.06 : 1, {
      damping: 14,
      stiffness: 200,
    });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.92, { duration: 80 }, () => {
      scale.value = withSpring(isActive ? 1 : 1.06, { damping: 14, stiffness: 200 });
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onPress(mood.key);
  }, [isActive, mood.key, onPress, scale]);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.chip,
          {
            backgroundColor: isActive ? colors.primary : colors.card,
            borderColor: isActive ? colors.primary : colors.border,
            shadowColor: isActive ? colors.primary : "transparent",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isActive ? 0.28 : 0,
            shadowRadius: 6,
            elevation: isActive ? 3 : 0,
          },
        ]}
      >
        <Text style={styles.emoji}>{mood.emoji}</Text>
        <Text
          style={[
            styles.chipLabel,
            { color: isActive ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {mood.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

interface MoodSelectorProps {
  selected: Mood;
  onSelect: (mood: Mood) => void;
}

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const handleSelect = useCallback(
    (mood: Mood) => {
      onSelect(selected === mood ? null : mood);
    },
    [selected, onSelect]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {MOODS.map((m) => (
        <MoodChip
          key={m.key}
          mood={m}
          isActive={selected === m.key}
          onPress={handleSelect}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    borderWidth: 1,
    gap: 6,
  },
  emoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});

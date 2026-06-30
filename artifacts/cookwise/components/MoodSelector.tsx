import { Ionicons } from "@expo/vector-icons";
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
  icon: string;
}

const MOODS: MoodOption[] = [
  { key: "tired", label: "Tired", icon: "moon-outline" },
  { key: "romantic", label: "Romantic", icon: "heart-outline" },
  { key: "budget", label: "Budget", icon: "cash-outline" },
  { key: "protein", label: "Protein", icon: "barbell-outline" },
  { key: "healthy", label: "Healthy", icon: "leaf-outline" },
  { key: "kids", label: "Kids", icon: "happy-outline" },
  { key: "guests", label: "Guests", icon: "people-outline" },
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
        <Ionicons
          name={mood.icon as any}
          size={15}
          color={isActive ? colors.primaryForeground : colors.mutedForeground}
        />
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
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});

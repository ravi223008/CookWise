import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

interface MoodSelectorProps {
  selected: Mood;
  onSelect: (mood: Mood) => void;
}

export function MoodSelector({ selected, onSelect }: MoodSelectorProps) {
  const colors = useColors();

  const handleSelect = useCallback(
    (mood: Mood) => {
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
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
      {MOODS.map((m) => {
        const isActive = selected === m.key;
        return (
          <Pressable
            key={m.key}
            onPress={() => handleSelect(m.key)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.primary : colors.card,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name={m.icon as any}
              size={16}
              color={isActive ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.chipLabel,
                {
                  color: isActive ? colors.primaryForeground : colors.foreground,
                },
              ]}
            >
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const BUDGETS = [
  { key: "low" as const, label: "Low" },
  { key: "medium" as const, label: "Medium" },
  { key: "high" as const, label: "High" },
];

const CUISINES = [
  "Italian", "Indian", "Mexican", "Chinese", "Japanese",
  "Mediterranean", "American", "Thai", "French", "Greek",
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, mealHistory } = useApp();

  const [name, setName] = useState(profile.name);
  const [allergyInput, setAllergyInput] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSaveName = useCallback(() => {
    if (name.trim()) updateProfile({ name: name.trim() });
  }, [name, updateProfile]);

  const addAllergy = useCallback(() => {
    const trimmed = allergyInput.trim();
    if (!trimmed || profile.allergies.includes(trimmed)) return;
    updateProfile({ allergies: [...profile.allergies, trimmed] });
    setAllergyInput("");
  }, [allergyInput, profile.allergies, updateProfile]);

  const removeAllergy = useCallback(
    (a: string) => {
      updateProfile({ allergies: profile.allergies.filter((x) => x !== a) });
    },
    [profile.allergies, updateProfile]
  );

  const toggleCuisine = useCallback(
    (c: string) => {
      const has = profile.preferredCuisines.includes(c);
      updateProfile({
        preferredCuisines: has
          ? profile.preferredCuisines.filter((x) => x !== c)
          : [...profile.preferredCuisines, c],
      });
    },
    [profile.preferredCuisines, updateProfile]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>
            {profile.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Your name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              onEndEditing={handleSaveName}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{mealHistory.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Meals cooked</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{profile.familySize}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Family size</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{profile.allergies.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Allergies</Text>
            </View>
          </View>
        </View>

        {/* Family Size */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Family size</Text>
          <View style={styles.countRow}>
            <Pressable
              onPress={() => updateProfile({ familySize: Math.max(1, profile.familySize - 1) })}
              style={[styles.countBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="remove" size={20} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.countValue, { color: colors.foreground }]}>{profile.familySize}</Text>
            <Pressable
              onPress={() => updateProfile({ familySize: Math.min(10, profile.familySize + 1) })}
              style={[styles.countBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="add" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {/* Budget */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Budget</Text>
          <View style={styles.budgetRow}>
            {BUDGETS.map((b) => {
              const isActive = profile.budget === b.key;
              return (
                <Pressable
                  key={b.key}
                  onPress={() => updateProfile({ budget: b.key })}
                  style={[
                    styles.budgetBtn,
                    {
                      backgroundColor: isActive ? colors.primary : colors.muted,
                      flex: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.budgetText,
                      { color: isActive ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Allergies */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Allergies & restrictions</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
              value={allergyInput}
              onChangeText={setAllergyInput}
              onSubmitEditing={addAllergy}
              placeholder="e.g. Gluten, Nuts..."
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
            />
            <Pressable
              onPress={addAllergy}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
            </Pressable>
          </View>
          {profile.allergies.length > 0 && (
            <View style={styles.chips}>
              {profile.allergies.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => removeAllergy(a)}
                  style={[styles.chip, { backgroundColor: colors.orangeLight, borderColor: colors.orange }]}
                >
                  <Text style={[styles.chipText, { color: colors.orange }]}>{a}</Text>
                  <Ionicons name="close" size={14} color={colors.orange} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Cuisines */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Preferred cuisines</Text>
          <View style={styles.chips}>
            {CUISINES.map((c) => {
              const isActive = profile.preferredCuisines.includes(c);
              return (
                <Pressable
                  key={c}
                  onPress={() => toggleCuisine(c)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? colors.sageLight : colors.muted,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isActive ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 20, gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  stat: { alignItems: "center", gap: 4 },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 40 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  countBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  countValue: { fontSize: 24, fontFamily: "Inter_700Bold", minWidth: 30, textAlign: "center" },
  budgetRow: { flexDirection: "row", gap: 8 },
  budgetBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  budgetText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingDots } from "@/components/LoadingDots";
import { MoodSelector } from "@/components/MoodSelector";
import { useApp } from "@/context/AppContext";
import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getRecommendation } from "@/services/ai";
import type { Mood } from "@/types";

export default function DecideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, mealHistory, setTonightsMeal, selectedMood } = useApp();
  const { items: pantryItems } = usePantry();

  const [extraIngredients, setExtraIngredients] = useState("");
  const [mood, setMood] = useState<Mood>(selectedMood);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleDecide = useCallback(async () => {
    Keyboard.dismiss();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError(null);

    const extra = extraIngredients
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pantryForRecommend = pantryItems.map((item) => {
      let daysUntilExpiry: number | undefined;
      if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        exp.setHours(0, 0, 0, 0);
        daysUntilExpiry = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
      }
      return {
        name: item.name,
        expiryDate: item.expiryDate,
        daysUntilExpiry,
      };
    });

    const extraAsItems = extra.map((name) => ({ name }));
    const allPantryItems = [...pantryForRecommend, ...extraAsItems];
    const allIngredients = allPantryItems.map((i) => i.name);

    try {
      const meal = await getRecommendation({
        ingredients: allIngredients,
        pantryItems: allPantryItems,
        mood,
        recentMeals: mealHistory.slice(0, 7).map((h) => h.mealName),
        profile,
      });
      setTonightsMeal(meal);
      router.replace({
        pathname: "/recommendation",
        params: { meal: JSON.stringify(meal) },
      });
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [extraIngredients, mood, pantryItems, profile, mealHistory, setTonightsMeal, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Decide My Dinner</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mood */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>How are you feeling?</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Select a mood and CookWise picks the perfect meal
          </Text>
        </View>
        <MoodSelector selected={mood} onSelect={setMood} />

        {/* Ingredients */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Extra ingredients</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            What else do you have? Comma-separated
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                color: colors.foreground,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            value={extraIngredients}
            onChangeText={setExtraIngredients}
            placeholder="e.g. chicken breast, tomatoes, garlic"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            returnKeyType="done"
          />
        </View>

        {/* Pantry summary */}
        {pantryItems.length > 0 && (
          <View style={[styles.pantryNote, { backgroundColor: colors.sageLight }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={[styles.pantryNoteText, { color: colors.primary }]}>
              Using {pantryItems.length} items from your pantry
            </Text>
          </View>
        )}

        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={[styles.cta, { paddingBottom: bottomPad + 20, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleDecide}
          disabled={loading}
          style={[styles.ctaBtn, { backgroundColor: colors.accent, opacity: loading ? 0.8 : 1 }]}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <LoadingDots />
              <Text style={[styles.ctaBtnText, { color: colors.accentForeground }]}>Finding your meal...</Text>
            </View>
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color={colors.accentForeground} />
              <Text style={[styles.ctaBtnText, { color: colors.accentForeground }]}>Get My Recommendation</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  content: { gap: 0 },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  sectionSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  textArea: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
    textAlignVertical: "top",
  },
  pantryNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pantryNoteText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 20,
    gap: 8,
  },
  ctaBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});

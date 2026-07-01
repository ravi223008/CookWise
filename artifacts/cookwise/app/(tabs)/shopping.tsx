import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

import { useShoppingList } from "@/context/ShoppingListContext";
import { usePantry } from "@/context/PantryContext";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { KEYS, load } from "@/services/storage";
import { CATEGORY_ORDER, groupByCategory } from "@/services/ShoppingListService";
import type { ShoppingCategory, ShoppingListItem, WeeklyPlan } from "@/types";

// ─────────────────────────────────────────────
// Category display config
// ─────────────────────────────────────────────

interface CategoryConfig {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  bg: string;
}

const CATEGORY_CONFIG: Record<ShoppingCategory, CategoryConfig> = {
  vegetables: { label: "Vegetables",  icon: "leaf-outline",       color: "#2d7a3a", bg: "#e8f5e9" },
  fruit:      { label: "Fruit",       icon: "nutrition-outline",  color: "#c0392b", bg: "#fdecea" },
  dairy:      { label: "Dairy",       icon: "water-outline",      color: "#1565c0", bg: "#e3f2fd" },
  meat:       { label: "Meat",        icon: "fish-outline",       color: "#7b3f00", bg: "#fdf0e4" },
  frozen:     { label: "Frozen",      icon: "snow-outline",       color: "#0277bd", bg: "#e1f5fe" },
  pantry:     { label: "Pantry",      icon: "grid-outline",       color: "#6d4c41", bg: "#efebe9" },
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function CategoryHeader({ category, count }: { category: ShoppingCategory; count: number }) {
  const colors = useColors();
  const cfg = CATEGORY_CONFIG[category];
  return (
    <View style={[styles.catHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.catIconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
      </View>
      <Text style={[styles.catLabel, { color: colors.foreground }]}>{cfg.label}</Text>
      <View style={[styles.catBadge, { backgroundColor: colors.muted }]}>
        <Text style={[styles.catBadgeText, { color: colors.mutedForeground }]}>{count}</Text>
      </View>
    </View>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const colors = useColors();
  const cfg = CATEGORY_CONFIG[item.category];

  return (
    <Pressable
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle(item.id);
      }}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.checked ? cfg.color : colors.border,
            backgroundColor: item.checked ? cfg.color : "transparent",
          },
        ]}
      >
        {item.checked && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>

      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowName,
            { color: item.checked ? colors.mutedForeground : colors.foreground },
            item.checked && styles.rowNameChecked,
          ]}
        >
          {item.name}
        </Text>
        {item.quantity ? (
          <Text style={[styles.rowQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
        ) : null}
        {item.sourceRecipes.length > 0 && (
          <Text style={[styles.rowSource, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.sourceRecipes.join(", ")}
          </Text>
        )}
      </View>

      <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────

export default function ShoppingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { list, generateFromMeals, addItem, toggleItem, removeItem, clearChecked, clearAll } =
    useShoppingList();
  const { items: pantryItems } = usePantry();
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const checkedCount = useMemo(() => list?.items.filter((i) => i.checked).length ?? 0, [list]);
  const totalCount = list?.items.length ?? 0;

  const grouped = useMemo(() => {
    if (!list) return null;
    return groupByCategory(list.items);
  }, [list]);

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(trimmed);
    setInput("");
    Keyboard.dismiss();
  }, [input, addItem]);

  const handleGenerateFromPlan = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    try {
      const plan = await load<WeeklyPlan>(KEYS.WEEKLY_PLAN, {});
      const meals = Object.values(plan).filter(Boolean) as NonNullable<typeof plan[string]>[];
      if (meals.length === 0) return;
      generateFromMeals(meals, pantryItems);
    } finally {
      setGenerating(false);
    }
  }, [generateFromMeals, pantryItems]);

  const isEmpty = !list || list.items.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Shopping List</Text>
          {!isEmpty && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {checkedCount}/{totalCount} items
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          {checkedCount > 0 && (
            <Pressable
              onPress={clearChecked}
              style={[styles.headerBtn, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="checkmark-done-outline" size={15} color={colors.mutedForeground} />
              <Text style={[styles.headerBtnText, { color: colors.mutedForeground }]}>Clear done</Text>
            </Pressable>
          )}
          {!isEmpty && (
            <Pressable
              onPress={clearAll}
              style={[styles.headerBtn, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Generate from plan banner */}
      <Pressable
        onPress={handleGenerateFromPlan}
        disabled={generating}
        style={[styles.generateBanner, { backgroundColor: colors.primary }]}
      >
        {generating ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Ionicons name="sparkles" size={16} color={colors.primaryForeground} />
        )}
        <Text style={[styles.generateBannerText, { color: colors.primaryForeground }]}>
          {generating ? "Generating…" : "Generate from weekly plan"}
        </Text>
      </Pressable>

      {/* Add input */}
      <View
        style={[
          styles.inputRow,
          { borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
          ]}
          placeholder="Add item manually…"
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleAdd}
          disabled={!input.trim()}
          style={[
            styles.addBtn,
            { backgroundColor: input.trim() ? colors.primary : colors.muted },
          ]}
        >
          <Ionicons
            name="add"
            size={22}
            color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>

      {/* List */}
      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No items yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Tap "Generate from weekly plan" to auto-fill missing ingredients, or add items manually above.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        >
          {CATEGORY_ORDER.map((category) => {
            const items = grouped?.get(category) ?? [];
            if (items.length === 0) return null;
            return (
              <View key={category}>
                <CategoryHeader category={category} count={items.length} />
                {items.map((item) => (
                  <ShoppingRow
                    key={item.id}
                    item={item}
                    onToggle={toggleItem}
                    onRemove={removeItem}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingBottom: 2,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 4,
  },
  headerBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  generateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
  },
  generateBannerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    marginTop: 8,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  catBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowNameChecked: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  rowQty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  rowSource: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});

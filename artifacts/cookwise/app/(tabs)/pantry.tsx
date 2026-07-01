import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import type { PantryItem } from "@/types";

const PantryRow = React.memo(function PantryRow({
  item,
  onDelete,
}: {
  item: PantryItem;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  const handleDelete = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete(item.id);
  }, [item.id, onDelete]);

  return (
    <View
      style={[styles.row, { borderBottomColor: colors.border }]}
      accessibilityRole="text"
      accessibilityLabel={`${item.name}${item.quantity ? `, ${item.quantity}` : ""}`}
    >
      <View style={[styles.rowDot, { backgroundColor: colors.sageLight }]}>
        <Ionicons name="leaf-outline" size={14} color={colors.primary} importantForAccessibility="no" />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.foreground }]}>{item.name}</Text>
        {item.quantity ? (
          <Text style={[styles.rowQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={handleDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name} from pantry`}
      >
        <Ionicons name="close-circle" size={22} color={colors.mutedForeground} importantForAccessibility="no" />
      </Pressable>
    </View>
  );
});

export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, isLoading, addItem, removeItem, clearAll } = usePantry();
  const [input, setInput] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(trimmed);
    setInput("");
    Keyboard.dismiss();
  }, [input, addItem]);

  const renderItem = useCallback(
    ({ item }: { item: PantryItem }) => (
      <PantryRow item={item} onDelete={removeItem} />
    ),
    [removeItem]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 16, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
        accessibilityRole="header"
      >
        <Text style={[styles.title, { color: colors.foreground }]} accessibilityRole="header">
          Pantry
        </Text>
        {items.length > 0 && (
          <Pressable
            onPress={clearAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear all pantry items"
          >
            <Text style={[styles.clearBtn, { color: colors.mutedForeground }]}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {/* Add Input */}
      <View style={[styles.inputRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Add ingredient…"
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          accessibilityLabel="Ingredient name"
          accessibilityHint="Type an ingredient name and tap Add"
        />
        <Pressable
          onPress={handleAdd}
          disabled={!input.trim()}
          style={[styles.addBtn, { backgroundColor: input.trim() ? colors.primary : colors.muted }]}
          accessibilityRole="button"
          accessibilityLabel="Add ingredient"
          accessibilityState={{ disabled: !input.trim() }}
        >
          <Ionicons
            name="add"
            size={22}
            color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
            importantForAccessibility="no"
          />
        </Pressable>
      </View>

      {/* Loading / List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            items.length === 0 && styles.listEmpty,
            { paddingBottom: bottomPad + 80 },
          ]}
          scrollEnabled={!!items.length}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="basket-outline" size={48} color={colors.mutedForeground} importantForAccessibility="no" />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Pantry is empty</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Add ingredients above so CookWise can suggest meals you can actually make
              </Text>
            </View>
          }
        />
      )}
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
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  clearBtn: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingTop: 8,
  },
  listEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  rowQty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
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

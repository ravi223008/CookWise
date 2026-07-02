import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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

import { usePantry } from "@/context/PantryContext";
import { useColors } from "@/hooks/useColors";
import type { PantryItem } from "@/types";
import {
  getDaysUntilExpiry,
  getExpiryLabel,
  getExpiryStatus,
  isLowStock,
  sortPantryItems,
} from "@/utils/pantry";

// ─────────────────────────────────────────────────────────────────────────────
// Expiry badge
// ─────────────────────────────────────────────────────────────────────────────

function ExpiryBadge({ expiryDate }: { expiryDate?: string }) {
  const colors = useColors();
  const days = getDaysUntilExpiry(expiryDate);
  const status = getExpiryStatus(expiryDate);
  const label = getExpiryLabel(days);

  if (status === "none") return null;

  const bg =
    status === "expired" ? "#EF444420"
    : status === "critical" ? colors.orange + "22"
    : status === "soon" ? "#F59E0B22"
    : colors.sageLight;

  const fg =
    status === "expired" ? colors.destructive
    : status === "critical" ? colors.orange
    : status === "soon" ? "#D97706"
    : colors.primary;

  const icon =
    status === "expired" ? "alert-circle"
    : status === "critical" ? "warning"
    : status === "soon" ? "time"
    : "checkmark-circle-outline";

  return (
    <View style={[styles.expiryBadge, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={11} color={fg} />
      <Text style={[styles.expiryBadgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pantry row
// ─────────────────────────────────────────────────────────────────────────────

const PantryRow = React.memo(function PantryRow({
  item,
  onDelete,
  onPress,
}: {
  item: PantryItem;
  onDelete: (id: string) => void;
  onPress: (item: PantryItem) => void;
}) {
  const colors = useColors();
  const status = getExpiryStatus(item.expiryDate);
  const lowStock = isLowStock(item.quantity);

  const dotBg =
    status === "expired" ? "#EF444420"
    : status === "critical" ? colors.orange + "22"
    : status === "soon" ? "#F59E0B22"
    : colors.sageLight;

  const dotFg =
    status === "expired" ? colors.destructive
    : status === "critical" ? colors.orange
    : status === "soon" ? "#D97706"
    : colors.primary;

  const dotIcon =
    status === "expired" ? "alert-circle-outline"
    : status === "critical" ? "warning-outline"
    : status === "soon" ? "time-outline"
    : "leaf-outline";

  const handleDelete = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete(item.id);
  }, [item.id, onDelete]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(item);
  }, [item, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.quantity ? `, ${item.quantity}` : ""}. Tap to edit.`}
    >
      <View style={[styles.rowDot, { backgroundColor: dotBg }]}>
        <Ionicons name={dotIcon as any} size={14} color={dotFg} importantForAccessibility="no" />
      </View>

      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.foreground }]}>{item.name}</Text>
        <View style={styles.rowMeta}>
          {item.quantity ? (
            <View style={[styles.qtyPill, { backgroundColor: lowStock ? colors.orangeLight : colors.muted }]}>
              <Text style={[styles.qtyText, { color: lowStock ? colors.orange : colors.mutedForeground }]}>
                {item.quantity}
              </Text>
              {lowStock && (
                <Ionicons name="alert-circle" size={10} color={colors.orange} />
              )}
            </View>
          ) : null}
          {item.expiryDate ? <ExpiryBadge expiryDate={item.expiryDate} /> : null}
        </View>
      </View>

      <Pressable
        onPress={handleDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.name} from pantry`}
      >
        <Ionicons name="close-circle" size={22} color={colors.mutedForeground} importantForAccessibility="no" />
      </Pressable>
    </Pressable>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Alerts banner
// ─────────────────────────────────────────────────────────────────────────────

function AlertsBanner({
  expiringItems,
  lowStockItems,
}: {
  expiringItems: PantryItem[];
  lowStockItems: PantryItem[];
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  if (expiringItems.length === 0 && lowStockItems.length === 0) return null;

  return (
    <View style={[styles.alertsWrapper, { backgroundColor: colors.orangeLight, borderColor: colors.orange + "30" }]}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.alertsHeader}
        accessibilityRole="button"
        accessibilityLabel="Toggle alerts panel"
      >
        <View style={styles.alertsLeft}>
          <Ionicons name="notifications" size={16} color={colors.orange} />
          <Text style={[styles.alertsTitle, { color: colors.orange }]}>
            {expiringItems.length > 0 && lowStockItems.length > 0
              ? `${expiringItems.length} expiring · ${lowStockItems.length} low stock`
              : expiringItems.length > 0
              ? `${expiringItems.length} item${expiringItems.length > 1 ? "s" : ""} expiring soon`
              : `${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} running low`}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.orange}
        />
      </Pressable>

      {expanded && (
        <View style={styles.alertsBody}>
          {expiringItems.length > 0 && (
            <>
              <Text style={[styles.alertsGroupTitle, { color: colors.orange }]}>Use these soon</Text>
              {expiringItems.map((item) => {
                const days = getDaysUntilExpiry(item.expiryDate);
                return (
                  <View key={item.id} style={styles.alertRow}>
                    <Ionicons name="time-outline" size={13} color={colors.orange} />
                    <Text style={[styles.alertRowName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.alertRowDetail, { color: colors.orange }]}>
                      {getExpiryLabel(days)}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
          {lowStockItems.length > 0 && (
            <>
              <Text style={[styles.alertsGroupTitle, { color: colors.orange }]}>
                {expiringItems.length > 0 ? "Running low" : "Low stock"}
              </Text>
              {lowStockItems.map((item) => (
                <View key={item.id} style={styles.alertRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.orange} />
                  <Text style={[styles.alertRowName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[styles.alertRowDetail, { color: colors.mutedForeground }]}>
                    {item.quantity ?? "low"}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, isLoading, expiringItems, lowStockItems, addItem, removeItem, clearAll } = usePantry();
  const [input, setInput] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const sortedItems = useMemo(() => sortPantryItems(items), [items]);

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(trimmed);
    setInput("");
    Keyboard.dismiss();
  }, [input, addItem]);

  const handlePressItem = useCallback(
    (item: PantryItem) => {
      router.push({ pathname: "/pantry-item", params: { id: item.id } });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: PantryItem }) => (
      <PantryRow item={item} onDelete={removeItem} onPress={handlePressItem} />
    ),
    [removeItem, handlePressItem]
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
          data={sortedItems}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            sortedItems.length === 0 && styles.listEmpty,
            { paddingBottom: bottomPad + 80 },
          ]}
          scrollEnabled
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AlertsBanner
              expiringItems={expiringItems}
              lowStockItems={lowStockItems}
            />
          }
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
    paddingTop: 0,
  },
  listEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  // Alerts banner
  alertsWrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertsLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  alertsTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  alertsBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  alertsGroupTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertRowName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  alertRowDetail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  qtyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  qtyText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  expiryBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
    paddingTop: 60,
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

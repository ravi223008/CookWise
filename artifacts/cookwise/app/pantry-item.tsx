import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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
import type { PantryCategory, StorageLocation } from "@/types";
import { getDaysUntilExpiry, getExpiryLabel, getExpiryStatus } from "@/utils/pantry";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: PantryCategory; label: string; icon: string }[] = [
  { value: "produce", label: "Produce", icon: "leaf" },
  { value: "dairy", label: "Dairy", icon: "water" },
  { value: "meat", label: "Meat", icon: "flame" },
  { value: "grains", label: "Grains", icon: "grid" },
  { value: "canned", label: "Canned", icon: "cube" },
  { value: "frozen", label: "Frozen", icon: "snow" },
  { value: "condiments", label: "Condiments", icon: "flask" },
  { value: "spices", label: "Spices", icon: "sparkles" },
  { value: "bakery", label: "Bakery", icon: "pizza" },
  { value: "other", label: "Other", icon: "ellipsis-horizontal" },
];

const STORAGE_LOCATIONS: { value: StorageLocation; label: string; icon: string }[] = [
  { value: "fridge", label: "Fridge", icon: "thermometer" },
  { value: "freezer", label: "Freezer", icon: "snow" },
  { value: "pantry", label: "Pantry", icon: "home" },
  { value: "counter", label: "Counter", icon: "restaurant" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Quick expiry presets
// ─────────────────────────────────────────────────────────────────────────────

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0]!;
}

const EXPIRY_PRESETS = [
  { label: "Today", days: 0 },
  { label: "2 days", days: 2 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 90 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Expiry status bar
// ─────────────────────────────────────────────────────────────────────────────

function ExpiryStatusBar({ expiryDate }: { expiryDate?: string }) {
  const colors = useColors();
  if (!expiryDate) return null;

  const days = getDaysUntilExpiry(expiryDate);
  const status = getExpiryStatus(expiryDate);
  const label = getExpiryLabel(days);

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
    : "checkmark-circle";

  return (
    <View style={[styles.expiryStatusBar, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={18} color={fg} />
      <Text style={[styles.expiryStatusText, { color: fg }]}>
        {status === "expired"
          ? "This item has expired"
          : status === "critical"
          ? `${label} — use it now!`
          : status === "soon"
          ? `${label} — use it soon`
          : `${label} — good to go`}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PantryItemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, updateItem, removeItem } = usePantry();

  const item = items.find((i) => i.id === id);

  const [name, setName] = useState(item?.name ?? "");
  const [quantity, setQuantity] = useState(item?.quantity ?? "");
  const [expiryDate, setExpiryDate] = useState(item?.expiryDate ?? "");
  const [category, setCategory] = useState<PantryCategory | undefined>(item?.category);
  const [storageLocation, setStorageLocation] = useState<StorageLocation | undefined>(item?.storageLocation);
  const [dateInput, setDateInput] = useState(item?.expiryDate ?? "");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSave = useCallback(() => {
    if (!item) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;

    let parsedExpiry: string | undefined;
    if (dateInput.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(dateInput.trim())) {
        parsedExpiry = dateInput.trim();
      } else {
        Alert.alert("Invalid date", "Please use YYYY-MM-DD format, e.g. 2025-12-31");
        return;
      }
    }

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateItem(item.id, {
      name: trimmedName,
      quantity: quantity.trim() || undefined,
      expiryDate: parsedExpiry,
      category,
      storageLocation,
    });
    router.back();
  }, [item, name, quantity, dateInput, category, storageLocation, updateItem, router]);

  const handleDelete = useCallback(() => {
    if (!item) return;
    if (Platform.OS === "web") {
      removeItem(item.id);
      router.back();
      return;
    }
    Alert.alert(
      "Remove item",
      `Remove "${item.name}" from your pantry?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeItem(item.id);
            router.back();
          },
        },
      ]
    );
  }, [item, removeItem, router]);

  const applyPreset = useCallback((days: number) => {
    const d = addDays(days);
    setDateInput(d);
    setExpiryDate(d);
  }, []);

  useEffect(() => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(dateInput.trim())) {
      setExpiryDate(dateInput.trim());
    } else {
      setExpiryDate("");
    }
  }, [dateInput]);

  if (!item) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Item not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Item</Text>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Expiry Status Bar */}
        <ExpiryStatusBar expiryDate={expiryDate} />

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Name</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken breast"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
          />
        </View>

        {/* Quantity */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Quantity</Text>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="e.g. 2 fillets, 500g, 1 bag…"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="next"
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Small quantities (1, 2, "last one") will trigger a low-stock alert
          </Text>
        </View>

        {/* Expiry Date */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Expiry Date</Text>

          {/* Quick presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
            <View style={styles.presetsRow}>
              {EXPIRY_PRESETS.map((preset) => {
                const presetDate = addDays(preset.days);
                const isActive = dateInput === presetDate;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => applyPreset(preset.days)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.card,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.presetChipText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
              {dateInput ? (
                <Pressable
                  onPress={() => { setDateInput(""); setExpiryDate(""); }}
                  style={[styles.presetChip, { backgroundColor: colors.orangeLight, borderColor: colors.orange + "40" }]}
                >
                  <Ionicons name="close" size={12} color={colors.orange} />
                  <Text style={[styles.presetChipText, { color: colors.orange }]}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>

          <TextInput
            style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            maxLength={10}
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Items expiring within 3 days appear in alerts and are prioritised by the AI
          </Text>
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Category</Text>
          <View style={styles.chipGrid}>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => setCategory(isActive ? undefined : cat.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={isActive ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[styles.chipText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Storage location */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Stored in</Text>
          <View style={styles.locationRow}>
            {STORAGE_LOCATIONS.map((loc) => {
              const isActive = storageLocation === loc.value;
              return (
                <Pressable
                  key={loc.value}
                  onPress={() => setStorageLocation(isActive ? undefined : loc.value)}
                  style={[
                    styles.locationChip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={loc.icon as any}
                    size={15}
                    color={isActive ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[styles.chipText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                    {loc.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Added date */}
        {item.addedAt && (
          <Text style={[styles.addedAt, { color: colors.mutedForeground }]}>
            Added {new Date(item.addedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        )}

        {/* Delete */}
        <Pressable
          onPress={handleDelete}
          style={[styles.deleteBtn, { borderColor: colors.destructive + "40" }]}
        >
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Remove from pantry</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 0,
  },
  expiryStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
    marginBottom: 4,
  },
  expiryStatusText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  fieldGroup: {
    marginTop: 24,
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: -2,
  },
  presetsScroll: {
    marginHorizontal: -4,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  locationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  addedAt: {
    marginTop: 28,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import type { AddMemberParams } from "@/context/FamilyContext";
import { useFamily } from "@/context/FamilyContext";
import { useColors } from "@/hooks/useColors";
import type { AgeGroup, FamilyMember, SpiceLevel } from "@/types";

// ─── Constants ────────────────────────────────────────────────
const BUDGETS = [
  { key: "low" as const, label: "Low" },
  { key: "medium" as const, label: "Medium" },
  { key: "high" as const, label: "High" },
];

const CUISINES = [
  "Italian", "Indian", "Mexican", "Chinese", "Japanese",
  "Mediterranean", "American", "Thai", "French", "Greek",
];

const AGE_GROUPS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: "baby", label: "Baby", emoji: "👶" },
  { value: "toddler", label: "Toddler", emoji: "🧒" },
  { value: "child", label: "Child", emoji: "👦" },
  { value: "teen", label: "Teen", emoji: "🧑" },
  { value: "adult", label: "Adult", emoji: "👩" },
  { value: "senior", label: "Senior", emoji: "👴" },
];

const SPICE_LEVELS: { value: SpiceLevel; label: string; emoji: string }[] = [
  { value: "none", label: "None", emoji: "🌿" },
  { value: "mild", label: "Mild", emoji: "🟡" },
  { value: "medium", label: "Medium", emoji: "🟠" },
  { value: "hot", label: "Hot", emoji: "🌶️" },
  { value: "extra-hot", label: "Extra Hot", emoji: "🔥" },
];

// ─── Shared components ────────────────────────────────────────
function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
  chipColor,
  chipBg,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder: string;
  chipColor?: string;
  chipBg?: string;
}) {
  const colors = useColors();
  const [input, setInput] = useState("");

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onAdd(trimmed);
    setInput("");
  }, [input, tags, onAdd]);

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, flex: 1 }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="done"
        />
        <Pressable
          onPress={handleAdd}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>
      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((t) => (
            <Pressable
              key={t}
              onPress={() => onRemove(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: chipBg ?? colors.muted,
                  borderColor: chipColor ?? colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: chipColor ?? colors.mutedForeground }]}>{t}</Text>
              <Ionicons name="close" size={13} color={chipColor ?? colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Member Avatar ─────────────────────────────────────────────

function MemberAvatar({ member, size = 44 }: { member: FamilyMember; size?: number }) {
  const colors = useColors();
  if (member.photo) {
    return (
      <Image
        source={{ uri: member.photo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const ageInfo = AGE_GROUPS.find((a) => a.value === member.ageGroup);
  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.sageLight,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.42 }}>{ageInfo?.emoji ?? "👤"}</Text>
    </View>
  );
}

// ─── Member Sheet ──────────────────────────────────────────────

const EMPTY_MEMBER_PARAMS: AddMemberParams = {
  name: "",
  ageGroup: "adult",
  likes: [],
  dislikes: [],
  allergies: [],
  spiceLevel: "mild",
  favoriteCuisines: [],
};

function MemberSheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: FamilyMember;
  onClose: () => void;
  onSave: (params: AddMemberParams) => void;
}) {
  const colors = useColors();
  const [form, setForm] = useState<AddMemberParams>(
    initial
      ? {
          name: initial.name,
          photo: initial.photo,
          ageGroup: initial.ageGroup,
          likes: initial.likes,
          dislikes: initial.dislikes,
          allergies: initial.allergies,
          spiceLevel: initial.spiceLevel,
          favoriteCuisines: initial.favoriteCuisines,
        }
      : EMPTY_MEMBER_PARAMS
  );

  const reset = useCallback(() => {
    setForm(
      initial
        ? {
            name: initial.name,
            photo: initial.photo,
            ageGroup: initial.ageGroup,
            likes: initial.likes,
            dislikes: initial.dislikes,
            allergies: initial.allergies,
            spiceLevel: initial.spiceLevel,
            favoriteCuisines: initial.favoriteCuisines,
          }
        : EMPTY_MEMBER_PARAMS
    );
  }, [initial]);

  const pickPhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: false,
    });
    if (!result.canceled && result.assets[0]) {
      setForm((f) => ({ ...f, photo: result.assets[0]!.uri }));
    }
  }, []);

  const patch = useCallback((update: Partial<AddMemberParams>) => {
    setForm((f) => ({ ...f, ...update }));
  }, []);

  const addToList = useCallback((field: "likes" | "dislikes" | "allergies" | "favoriteCuisines", val: string) => {
    setForm((f) => ({ ...f, [field]: [...f[field], val] }));
  }, []);

  const removeFromList = useCallback((field: "likes" | "dislikes" | "allergies" | "favoriteCuisines", val: string) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((x) => x !== val) }));
  }, []);

  const toggleCuisine = useCallback((c: string) => {
    setForm((f) => ({
      ...f,
      favoriteCuisines: f.favoriteCuisines.includes(c)
        ? f.favoriteCuisines.filter((x) => x !== c)
        : [...f.favoriteCuisines, c],
    }));
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(form);
    reset();
    onClose();
  }, [form, onSave, reset, onClose]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={() => {}}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            {initial ? "Edit Member" : "Add Family Member"}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Photo + Name row */}
            <View style={styles.photoNameRow}>
              <Pressable onPress={pickPhoto} style={styles.photoPickerWrap}>
                {form.photo ? (
                  <Image source={{ uri: form.photo }} style={styles.photoPicker} />
                ) : (
                  <View style={[styles.photoPicker, { backgroundColor: colors.sageLight, justifyContent: "center", alignItems: "center" }]}>
                    <Ionicons name="camera-outline" size={24} color={colors.primary} />
                  </View>
                )}
                <View style={[styles.photoEdit, { backgroundColor: colors.primary }]}>
                  <Ionicons name="pencil" size={10} color="#fff" />
                </View>
              </Pressable>
              <TextInput
                style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={form.name}
                onChangeText={(v) => patch({ name: v })}
                placeholder="Member name *"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
                autoFocus={!initial}
              />
            </View>

            {/* Age group */}
            <View style={[styles.fieldGroup]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Age Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {AGE_GROUPS.map((ag) => {
                    const active = form.ageGroup === ag.value;
                    return (
                      <Pressable
                        key={ag.value}
                        onPress={() => patch({ ageGroup: ag.value })}
                        style={[
                          styles.optionChip,
                          {
                            backgroundColor: active ? colors.primary : colors.card,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text style={styles.chipEmoji}>{ag.emoji}</Text>
                        <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                          {ag.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Spice level */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Spice Level</Text>
              <View style={styles.spiceRow}>
                {SPICE_LEVELS.map((sl) => {
                  const active = form.spiceLevel === sl.value;
                  return (
                    <Pressable
                      key={sl.value}
                      onPress={() => patch({ spiceLevel: sl.value })}
                      style={[
                        styles.spiceBtn,
                        {
                          backgroundColor: active ? colors.accent : colors.card,
                          borderColor: active ? colors.accent : colors.border,
                          flex: 1,
                        },
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{sl.emoji}</Text>
                      <Text
                        style={[
                          styles.spiceLabel,
                          { color: active ? colors.accentForeground : colors.mutedForeground },
                        ]}
                      >
                        {sl.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Favourite cuisines */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Favourite Cuisines</Text>
              <View style={styles.chips}>
                {CUISINES.map((c) => {
                  const active = form.favoriteCuisines.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCuisine(c)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? colors.sageLight : colors.muted,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Likes */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Likes</Text>
              <TagInput
                tags={form.likes}
                onAdd={(v) => addToList("likes", v)}
                onRemove={(v) => removeFromList("likes", v)}
                placeholder="e.g. Pasta, Cheese..."
                chipColor={colors.primary}
                chipBg={colors.sageLight}
              />
            </View>

            {/* Dislikes */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Dislikes</Text>
              <TagInput
                tags={form.dislikes}
                onAdd={(v) => addToList("dislikes", v)}
                onRemove={(v) => removeFromList("dislikes", v)}
                placeholder="e.g. Mushrooms, Olives..."
              />
            </View>

            {/* Allergies */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Allergies</Text>
              <TagInput
                tags={form.allergies}
                onAdd={(v) => addToList("allergies", v)}
                onRemove={(v) => removeFromList("allergies", v)}
                placeholder="e.g. Gluten, Nuts..."
                chipColor={colors.orange}
                chipBg={colors.orangeLight}
              />
            </View>

            <View style={{ height: 16 }} />
          </ScrollView>

          <Pressable
            onPress={handleSave}
            disabled={!form.name.trim()}
            style={[
              styles.saveBtn,
              { backgroundColor: form.name.trim() ? colors.primary : colors.muted },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={form.name.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text style={[styles.saveBtnText, { color: form.name.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
              {initial ? "Save Changes" : "Add Member"}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Member Card ───────────────────────────────────────────────

function MemberCard({
  member,
  onEdit,
  onDelete,
  index,
}: {
  member: FamilyMember;
  onEdit: (m: FamilyMember) => void;
  onDelete: (id: string) => void;
  index: number;
}) {
  const colors = useColors();
  const spice = SPICE_LEVELS.find((s) => s.value === member.spiceLevel);
  const ageInfo = AGE_GROUPS.find((a) => a.value === member.ageGroup);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(20)}>
      <Pressable
        onPress={() => onEdit(member)}
        style={[styles.memberCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <MemberAvatar member={member} size={48} />

        <View style={{ flex: 1, gap: 5 }}>
          <View style={styles.memberCardTop}>
            <Text style={[styles.memberName, { color: colors.foreground }]}>{member.name}</Text>
            <View style={[styles.ageBadge, { backgroundColor: colors.sageLight }]}>
              <Text style={[styles.ageBadgeText, { color: colors.primary }]}>
                {ageInfo?.emoji} {ageInfo?.label}
              </Text>
            </View>
          </View>

          <View style={styles.memberMeta}>
            {spice && (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {spice.emoji} {spice.label} spice
              </Text>
            )}
            {member.favoriteCuisines.length > 0 && (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                🍽️ {member.favoriteCuisines.slice(0, 2).join(", ")}
                {member.favoriteCuisines.length > 2 ? ` +${member.favoriteCuisines.length - 2}` : ""}
              </Text>
            )}
            {member.allergies.length > 0 && (
              <Text style={[styles.metaText, { color: colors.orange }]} numberOfLines={1}>
                ⚠️ {member.allergies.join(", ")}
              </Text>
            )}
          </View>
        </View>

        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onDelete(member.id);
          }}
          hitSlop={10}
        >
          <Ionicons name="close-circle" size={22} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, mealHistory } = useApp();
  const { members, addMember, updateMember, removeMember } = useFamily();

  const [name, setName] = useState(profile.name);
  const [allergyInput, setAllergyInput] = useState("");
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | undefined>();

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
    (a: string) => updateProfile({ allergies: profile.allergies.filter((x) => x !== a) }),
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
const handleOpenAdd = useCallback(() => {
    setEditingMember(undefined);
    setSheetVisible(true);
  }, []);

  const handleEdit = useCallback((m: FamilyMember) => {
    setEditingMember(m);
    setSheetVisible(true);
  }, []);

  const handleSaveMember = useCallback(
    (params: AddMemberParams) => {
      if (editingMember) {
        updateMember(editingMember.id, params);
      } else {
        addMember(params);
      }
    },
    [editingMember, addMember, updateMember]
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.pageHeader, { paddingTop: topPad + 16, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22 }]}>
          <Text style={[styles.avatarLetter, { color: colors.primaryForeground }]}>
            {profile.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 }]} showsVerticalScrollIndicator={false}>
        {/* ── Your profile ─────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>YOUR PROFILE</Text>
        {/* Name */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Your name</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, flex: 1 }]}
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
              <Text style={[styles.statValue, { color: colors.primary }]}>{members.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Members</Text>
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
              onPress={() => updateProfile({ familySize: Math.min(12, profile.familySize + 1) })}
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
                    { backgroundColor: isActive ? colors.primary : colors.muted, flex: 1 },
                  ]}
                >
                  <Text style={[styles.budgetText, { color: isActive ? colors.primaryForeground: colors.mutedForeground }]}>
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
            <Pressable onPress={addAllergy} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
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

        {/* Preferred Cuisines */}
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
                      backgroundColor: isActive? colors.sageLight: colors.muted,
                      borderColor: isActive? colors.primary: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
         {/* ── Family Members ────────────────────────── */}
        <View style={styles.familyHeader}>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground, marginBottom: 0 }]}>
            FAMILY MEMBERS
          </Text>
          <Pressable
            onPress={handleOpenAdd}
            style={[styles.addMemberBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="add" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addMemberText, { color: colors.primaryForeground }]}>Add</Text>
          </Pressable>
        </View>

        {members.length === 0 ? (
          <Pressable
            onPress={handleOpenAdd}
            style={[styles.emptyMembersCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name="people-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyMembersTitle, { color: colors.foreground }]}>
              No family members yet
            </Text>
            <Text style={[styles.emptyMembersSub, { color: colors.mutedForeground }]}>
              Add profiles for each family member so CookWise can tailor meals for everyone's tastes and allergies.
            </Text>
            <View style={[styles.emptyMembersAddBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text style={[styles.addMemberText, { color: colors.primaryForeground }]}>Add First Member</Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ gap: 0 }}>
            {members.map((m, idx) => (
              <MemberCard
                key={m.id}
                member={m}
                onEdit={handleEdit}
                onDelete={removeMember}
                index={idx}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <MemberSheet
        visible={sheetVisible}
        initial={editingMember}
        onClose={() => setSheetVisible(false)}
        onSave={handleSaveMember}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
 avatarCircle: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 18, fontFamily: "Inter_700Bold" },

  content: { padding: 20, gap: 14 },

  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 2,
  },
  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 2,
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addMemberText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
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
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
  statValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 40 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 20 },
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
  budgetBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center" },
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
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },// Member cards
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  memberCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  memberName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ageBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  memberMeta: { gap: 3 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  emptyMembersCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyMembersTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyMembersSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyMembersAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 4,
  },

  // Sheet
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "94%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 16 },

  photoNameRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  photoPickerWrap: { position: "relative" },
  photoPicker: { width: 72, height: 72, borderRadius: 36 },
  photoEdit: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },

  fieldGroup: { marginBottom: 18, gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  chipRow: { flexDirection: "row", gap: 8 },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipEmoji: { fontSize: 16 },

  spiceRow: { flexDirection: "row", gap: 6 },
  spiceBtn: {
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 3,
  },
  spiceLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});

import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PrimaryButton from "@/components/PrimaryButton";
import {
  addHomeItem,
  loadInventory,
  updateHomeItem,
} from "@/lib/homeData";
import { generateId } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { HomeItem, ItemCondition } from "@/lib/types";

const CONDITIONS: Array<{ value: ItemCondition; label: string }> = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "replace_soon", label: "Replace soon" },
];

const CONDITION_COLOR: Record<string, { bg: string; fg: string }> = {
  good: { bg: "#d1fae5", fg: "#047857" },
  fair: { bg: "#fef3c7", fg: "#b45309" },
  poor: { bg: "#fee2e2", fg: "#b91c1c" },
  replace_soon: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function InventoryEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    itemId?: string;
    analyzedData?: string;
    photoUri?: string;
  }>();

  const isNew = !params.itemId;

  const [name, setName] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [estimatedAgeYears, setEstimatedAgeYears] = useState("");
  const [typicalLifespanYears, setTypicalLifespanYears] = useState("");
  const [condition, setCondition] = useState<ItemCondition>("fair");
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Fields we keep from analysis but don't expose for editing
  const [category, setCategory] = useState("other");
  const [icon, setIcon] = useState("🏠");
  const [room, setRoom] = useState("");
  const [maintenanceTips, setMaintenanceTips] = useState<string[]>([]);
  const [suggestedReminders, setSuggestedReminders] = useState<
    HomeItem["suggestedReminders"]
  >(undefined);
  const [existingItem, setExistingItem] = useState<HomeItem | null>(null);

  // Load data based on mode (new vs edit)
  useEffect(() => {
    if (params.itemId) {
      // Editing an existing item — load from storage
      loadInventory().then((items) => {
        const found = items.find((i) => i.id === params.itemId);
        if (found) {
          setExistingItem(found);
          setName(found.name);
          setConditionNotes(found.conditionNotes);
          setEstimatedAgeYears(String(found.estimatedAgeYears));
          setTypicalLifespanYears(String(found.typicalLifespanYears));
          setCondition(found.condition);
          setPhotoUri(found.photoUri);
          setCategory(found.category);
          setIcon(found.icon);
          setRoom(found.room);
          setMaintenanceTips(found.maintenanceTips);
          setSuggestedReminders(found.suggestedReminders);
        }
      });
    } else if (params.analyzedData) {
      // New item — populate from Claude analysis
      try {
        const data = JSON.parse(params.analyzedData);
        setName(data.name ?? "");
        setConditionNotes(data.conditionNotes ?? "");
        setEstimatedAgeYears(String(data.estimatedAgeYears ?? 0));
        setTypicalLifespanYears(String(data.typicalLifespanYears ?? 0));
        setCondition(data.condition ?? "fair");
        setCategory(data.category ?? "other");
        setIcon(data.icon ?? "🏠");
        setMaintenanceTips(data.maintenanceTips ?? []);
        setSuggestedReminders(data.suggestedReminders);
        if (params.photoUri) {
          setPhotoUri(params.photoUri);
        }
      } catch {
        // If parsing fails, leave defaults
      }
    }
  }, [params.itemId, params.analyzedData, params.photoUri]);

  const canSave =
    name.trim().length > 0 &&
    estimatedAgeYears.length > 0 &&
    typicalLifespanYears.length > 0;

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const ageNum = Math.max(0, Number(estimatedAgeYears) || 0);
      const lifespanNum = Math.max(1, Number(typicalLifespanYears) || 1);

      if (isNew) {
        const item: HomeItem = {
          id: generateId(),
          name: name.trim(),
          category,
          icon,
          room,
          photoUri,
          estimatedAgeYears: ageNum,
          typicalLifespanYears: lifespanNum,
          condition,
          conditionNotes: conditionNotes.trim(),
          maintenanceTips,
          suggestedReminders,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await addHomeItem(item);
      } else if (params.itemId) {
        await updateHomeItem(params.itemId, {
          name: name.trim(),
          conditionNotes: conditionNotes.trim(),
          estimatedAgeYears: ageNum,
          typicalLifespanYears: lifespanNum,
          condition,
        });
      }
      router.back();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not save item";
      Alert.alert("Something went wrong", msg);
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    saving,
    isNew,
    name,
    category,
    icon,
    room,
    photoUri,
    estimatedAgeYears,
    typicalLifespanYears,
    condition,
    conditionNotes,
    maintenanceTips,
    suggestedReminders,
    params.itemId,
    router,
  ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? "Review Item" : "Edit Item",
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          )}

          {/* Name / Title */}
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Kitchen Refrigerator"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
            />
          </View>

          {/* Description / Condition Notes */}
          <View style={styles.card}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={conditionNotes}
              onChangeText={setConditionNotes}
              placeholder="Notes about the item's current condition"
              placeholderTextColor={colors.textSubtle}
              multiline
              style={styles.textarea}
            />
          </View>

          {/* Condition */}
          <View style={styles.card}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => {
                const active = c.value === condition;
                const col = CONDITION_COLOR[c.value];
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCondition(c.value)}
                    style={[
                      styles.conditionChip,
                      active && { backgroundColor: col.bg, borderColor: col.fg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.conditionChipText,
                        active && { color: col.fg },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Age & Lifespan */}
          <View style={styles.card}>
            <Text style={styles.label}>Estimated Age</Text>
            <View style={styles.numberRow}>
              <TextInput
                value={estimatedAgeYears}
                onChangeText={setEstimatedAgeYears}
                placeholder="0"
                keyboardType="number-pad"
                style={styles.numberInput}
                placeholderTextColor={colors.textSubtle}
              />
              <Text style={styles.unit}>years</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Typical Lifespan</Text>
            <View style={styles.numberRow}>
              <TextInput
                value={typicalLifespanYears}
                onChangeText={setTypicalLifespanYears}
                placeholder="0"
                keyboardType="number-pad"
                style={styles.numberInput}
                placeholderTextColor={colors.textSubtle}
              />
              <Text style={styles.unit}>years</Text>
            </View>
          </View>

          {/* Maintenance tips (read-only preview for new items) */}
          {maintenanceTips.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Maintenance Tips</Text>
              {maintenanceTips.map((tip, i) => (
                <Text key={i} style={styles.tipText}>
                  {"\u2022"} {tip}
                </Text>
              ))}
            </View>
          )}

          <PrimaryButton
            title={isNew ? "Save to Inventory" : "Save Changes"}
            onPress={handleSave}
            disabled={!canSave}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  photo: {
    width: "100%",
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: {
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
  },
  conditionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  conditionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  conditionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  numberInput: {
    width: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unit: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tipText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

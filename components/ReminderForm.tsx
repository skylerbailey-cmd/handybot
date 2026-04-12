import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PrimaryButton from "./PrimaryButton";
import { formatFrequency } from "@/lib/reminders";
import { colors, radius, spacing } from "@/lib/theme";

export interface ReminderFormValues {
  title: string;
  description: string;
  icon: string;
  frequencyDays: number;
  /** Unix ms timestamp. */
  nextDue: number;
}

interface Props {
  /** Initial form values. Pass undefined for a "create" form with defaults. */
  initial?: Partial<ReminderFormValues>;
  /** Label for the primary submit button. */
  submitLabel: string;
  /** Called when the user taps submit with validated values. */
  onSubmit: (values: ReminderFormValues) => Promise<void> | void;
  submitting?: boolean;
  /**
   * When editing, the "start date" presets become "next due" presets
   * that always set the date relative to *now*.
   */
  startLabel?: string;
  /** Optional extra buttons rendered above the submit (e.g. Delete). */
  renderExtraActions?: () => React.ReactNode;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const FREQUENCY_PRESETS: Array<{ label: string; days: number }> = [
  { label: "Weekly", days: 7 },
  { label: "Monthly", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "Yearly", days: 365 },
];

const START_PRESETS: Array<{ label: string; offsetDays: number }> = [
  { label: "Today", offsetDays: 0 },
  { label: "Tomorrow", offsetDays: 1 },
  { label: "In 1 week", offsetDays: 7 },
  { label: "In 1 month", offsetDays: 30 },
];

const ICON_CHOICES = [
  "🛠",
  "🌬",
  "🚰",
  "🔥",
  "🚿",
  "💧",
  "🚽",
  "🍂",
  "🏠",
  "🪟",
  "🚨",
  "🔋",
  "🧯",
  "⚡",
  "🧊",
  "🧺",
  "🍽",
  "🍳",
  "❄️",
  "🌱",
];

function offsetDaysForDate(nextDue: number): number | null {
  const diffDays = Math.round((nextDue - Date.now()) / DAY_MS);
  const match = START_PRESETS.find((p) => p.offsetDays === diffDays);
  return match?.offsetDays ?? null;
}

export default function ReminderForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
  startLabel = "Start on",
  renderExtraActions,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🛠");
  const [frequencyDays, setFrequencyDays] = useState<number>(
    initial?.frequencyDays ?? 90
  );
  // For "start on" we keep track of the user-selected offset preset,
  // defaulting to a sensible one based on the initial nextDue value.
  const initialOffset = useMemo(() => {
    if (initial?.nextDue) {
      const matched = offsetDaysForDate(initial.nextDue);
      if (matched !== null) return matched;
    }
    // Default: start one full frequency-period from now.
    return Math.min(
      START_PRESETS[START_PRESETS.length - 1].offsetDays,
      initial?.frequencyDays ?? 90
    );
  }, [initial?.nextDue, initial?.frequencyDays]);
  const [startOffsetDays, setStartOffsetDays] = useState<number>(initialOffset);

  const isCustomFrequency = !FREQUENCY_PRESETS.some(
    (p) => p.days === frequencyDays
  );

  const canSubmit = title.trim().length > 0 && frequencyDays > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    const nextDue = Date.now() + startOffsetDays * DAY_MS;
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      icon: icon.trim() || "🛠",
      frequencyDays,
      nextDue,
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Replace shower head filter"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="A sentence or two reminding you exactly what to do."
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.textarea}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Icon</Text>
          <View style={styles.iconGrid}>
            {ICON_CHOICES.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={[
                  styles.iconChoice,
                  icon === ic && styles.iconChoiceActive,
                ]}
              >
                <Text style={styles.iconChoiceText}>{ic}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>How often?</Text>
          <View style={styles.presetRow}>
            {FREQUENCY_PRESETS.map((p) => {
              const active = p.days === frequencyDays;
              return (
                <Pressable
                  key={p.days}
                  onPress={() => setFrequencyDays(p.days)}
                  style={[
                    styles.preset,
                    active && styles.presetActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      active && styles.presetTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>Custom:</Text>
            <TextInput
              value={isCustomFrequency ? String(frequencyDays) : ""}
              onChangeText={(v) => {
                const n = parseInt(v, 10);
                if (!Number.isNaN(n) && n > 0) setFrequencyDays(n);
                else if (v === "") setFrequencyDays(0);
              }}
              placeholder="days"
              keyboardType="number-pad"
              style={styles.customInput}
              placeholderTextColor={colors.textSubtle}
            />
            <Text style={styles.customUnit}>days</Text>
          </View>
          {frequencyDays > 0 && (
            <Text style={styles.preview}>
              Repeats {formatFrequency(frequencyDays).toLowerCase()}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{startLabel}</Text>
          <View style={styles.presetRow}>
            {START_PRESETS.map((p) => {
              const active = p.offsetDays === startOffsetDays;
              return (
                <Pressable
                  key={p.offsetDays}
                  onPress={() => setStartOffsetDays(p.offsetDays)}
                  style={[
                    styles.preset,
                    active && styles.presetActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetText,
                      active && styles.presetTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {renderExtraActions?.()}

        <PrimaryButton
          title={submitLabel}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
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
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  iconChoiceActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
    borderWidth: 2,
  },
  iconChoiceText: {
    fontSize: 22,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  preset: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  presetActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  presetText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  presetTextActive: {
    color: "#ffffff",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  customLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  customInput: {
    width: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  customUnit: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  preview: {
    fontSize: 12,
    color: colors.textSubtle,
    fontStyle: "italic",
  },
});

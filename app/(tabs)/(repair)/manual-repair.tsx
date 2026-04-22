import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ImagePickerButton from "@/components/ImagePickerButton";
import PrimaryButton from "@/components/PrimaryButton";
import { ClaudeQuotaError, verifyManualRepair } from "@/lib/claude";
import { readImageAsBase64 } from "@/lib/image";
import { generateId, upsertIssue } from "@/lib/storage";
import { colors, radius, spacing } from "@/lib/theme";
import type { Issue, RepairPlan } from "@/lib/types";

export default function ManualRepairScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [repairDate, setRepairDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || submitting) return;

    setSubmitting(true);
    try {
      const costNum = parseFloat(cost) || 0;
      const hasPhotos = !!beforePhoto && !!afterPhoto;
      let verified = false;
      let verifyFeedback = "";

      // If both before and after photos are provided, run AI verification
      if (hasPhotos) {
        const beforeBase64 = await readImageAsBase64(beforePhoto!);
        const afterBase64 = await readImageAsBase64(afterPhoto!);
        const result = await verifyManualRepair({
          title: trimmedTitle,
          description: description.trim(),
          beforeImageBase64: beforeBase64,
          afterImageBase64: afterBase64,
        });
        verified = result.verified;
        verifyFeedback = result.feedback;
      }

      const plan: RepairPlan = {
        difficulty: "Medium",
        estimatedMinutes: 0,
        estimatedSavingsUsd: costNum,
        tools: [],
        materials: [],
        steps: [
          {
            id: generateId(),
            title: "Repair completed",
            detail: description.trim() || "Manually logged repair.",
            completed: true,
          },
        ],
        safetyNotes: [],
        verificationResult: hasPhotos
          ? {
              verified,
              feedback: verifyFeedback,
              verifiedAt: Date.now(),
              photoUri: afterPhoto!,
            }
          : undefined,
      };

      const issue: Issue = {
        id: generateId(),
        title: trimmedTitle,
        summary: description.trim() || "Manually added repair.",
        status: verified ? "verified" : "completed",
        createdAt: repairDate.getTime(),
        updatedAt: Date.now(),
        coverImageUri: beforePhoto ?? afterPhoto ?? undefined,
        plan,
        messages: [],
      };

      await upsertIssue(issue);

      if (hasPhotos) {
        Alert.alert(
          verified ? "Repair verified!" : "Repair added",
          verified
            ? `HandyBot confirmed the fix looks good.\n\n${verifyFeedback}`
            : `HandyBot couldn't confirm the fix from the photos. The repair has been logged as Completed but not Verified.\n\n${verifyFeedback}`,
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else {
        router.back();
      }
    } catch (err) {
      if (err instanceof ClaudeQuotaError) {
        Alert.alert(
          "Free limit reached",
          err.userMessage,
          [
            { text: "OK", style: "cancel" },
            {
              text: "Upgrade to Pro",
              onPress: () => router.push("/(tabs)/(settings)"),
            },
          ]
        );
        setSubmitting(false);
        return;
      }
      const msg =
        err instanceof Error ? err.message : "Could not save repair.";
      Alert.alert("Something went wrong", msg);
      setSubmitting(false);
    }
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
          <Text style={styles.label}>What did you fix?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Fixed leaking kitchen faucet"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Date of repair</Text>
          <Text style={styles.help}>
            When did this repair happen? Defaults to today.
          </Text>
          {Platform.OS === "web" ? (
            <input
              type="date"
              value={repairDate.toISOString().split("T")[0]}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e: any) => {
                const d = new Date(e.target.value + "T12:00:00");
                if (!isNaN(d.getTime())) setRepairDate(d);
              }}
              style={{
                marginTop: 8,
                fontSize: 15,
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${colors.borderStrong}`,
                color: colors.text,
                backgroundColor: colors.surface,
              }}
            />
          ) : (
            <>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              >
                <Text style={styles.dateButtonText}>
                  {repairDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.dateChangeHint}>Tap to change</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={repairDate}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_event: any, selectedDate?: Date) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) setRepairDate(selectedDate);
                  }}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was wrong and what you did to fix it..."
            placeholderTextColor={colors.textSubtle}
            multiline
            style={styles.textarea}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>
            How much would a pro have charged? (optional)
          </Text>
          <Text style={styles.help}>
            Labor cost only — this goes toward your total saved.
          </Text>
          <View style={styles.costRow}>
            <Text style={styles.costPrefix}>$</Text>
            <TextInput
              value={cost}
              onChangeText={setCost}
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              keyboardType="numeric"
              style={styles.costInput}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Before photo (optional)</Text>
          <Text style={styles.help}>
            What did the problem look like before you fixed it?
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <ImagePickerButton value={beforePhoto} onChange={setBeforePhoto} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>After photo (optional)</Text>
          <Text style={styles.help}>
            What does it look like now that it&apos;s fixed?
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <ImagePickerButton value={afterPhoto} onChange={setAfterPhoto} />
          </View>
        </View>

        {beforePhoto && afterPhoto && (
          <View style={styles.verifyNote}>
            <Text style={styles.verifyNoteIcon}>🔍</Text>
            <Text style={styles.verifyNoteText}>
              Since you&apos;re providing before and after photos, HandyBot will
              verify the repair and mark it as <Text style={{ fontWeight: "800" }}>Verified</Text> if
              the fix looks good.
            </Text>
          </View>
        )}

        {!beforePhoto || !afterPhoto ? (
          <View style={styles.noVerifyNote}>
            <Text style={styles.noVerifyNoteText}>
              Without both before and after photos, this repair will be saved
              as <Text style={{ fontWeight: "800" }}>Completed</Text> but not Verified.
            </Text>
          </View>
        ) : null}

        <PrimaryButton
          title={
            submitting
              ? beforePhoto && afterPhoto
                ? "Verifying..."
                : "Saving..."
              : beforePhoto && afterPhoto
                ? "Save & verify repair"
                : "Save repair"
          }
          onPress={handleSubmit}
          disabled={!title.trim()}
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
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  help: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
  },
  textarea: {
    marginTop: spacing.sm,
    minHeight: 80,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  costPrefix: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  costInput: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  verifyNote: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  verifyNoteIcon: {
    fontSize: 20,
  },
  verifyNoteText: {
    flex: 1,
    fontSize: 13,
    color: "#047857",
    lineHeight: 19,
  },
  dateButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  dateChangeHint: {
    fontSize: 12,
    color: colors.textSubtle,
  },
  noVerifyNote: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: colors.border,
  },
  noVerifyNoteText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    textAlign: "center",
  },
});
